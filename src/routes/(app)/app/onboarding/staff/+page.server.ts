import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { FIXED_CERTIFICATION_CODES } from '$lib/certifications';
import { setStaffOnboardingComplete } from '$lib/server/org/service';
import { parseCommitRows } from '$lib/server/staff/import-commit';
import { parseStaffImport } from '$lib/server/staff/import-parser';
import { clearStaffForOrganizationTesting, importStaffRowsWithRequirements } from '$lib/server/staff/onboarding';
import { listStaff } from '$lib/server/staff/repository';
import { importCommitSchema, importPreviewSchema } from '$lib/validation/requirements';
import type { CertificationCode } from '$lib/types';
import type { NameOrderDecision } from '$lib/server/staff/import-parser';

const ALL_CERTS = [...FIXED_CERTIFICATION_CODES];

function parseSelectedCerts(formData: FormData): CertificationCode[] {
	const rawValues = formData
		.getAll('requiredCerts')
		.map((value) => String(value))
		.filter(Boolean);
	if (rawValues.includes('ALL')) {
		return ALL_CERTS;
	}

	return FIXED_CERTIFICATION_CODES.filter((code) => rawValues.includes(code));
}

function parsePatternDecisions(formData: FormData): Record<string, NameOrderDecision> {
	const decisions: Record<string, NameOrderDecision> = {};
	for (const [key, value] of formData.entries()) {
		if (!key.startsWith('patternDecision.')) {
			continue;
		}
		const patternId = key.slice('patternDecision.'.length).trim();
		const rawDecision = String(value ?? '').trim();
		if (!patternId || (rawDecision !== 'first_last' && rawDecision !== 'last_first')) {
			continue;
		}
		decisions[patternId] = rawDecision;
	}
	return decisions;
}

function parseDuplicateDecisions(formData: FormData): Record<string, 'yes' | 'no'> {
	const decisions: Record<string, 'yes' | 'no'> = {};
	for (const [key, value] of formData.entries()) {
		if (!key.startsWith('duplicateDecision.')) {
			continue;
		}
		const encoded = key.slice('duplicateDecision.'.length).trim();
		if (!encoded) {
			continue;
		}
		let decoded = encoded;
		try {
			decoded = decodeURIComponent(encoded);
		} catch {
			decoded = encoded;
		}
		const normalized = String(value ?? '').trim().toLowerCase();
		decisions[decoded] = normalized === 'yes' ? 'yes' : 'no';
	}
	return decisions;
}

function normalizeFirstLastKey(firstName: string, lastName: string): string {
	return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

function formatDuplicateNameFromKey(key: string): string {
	const [first = '', last = ''] = key.split('|');
	const toTitle = (value: string) =>
		value
			.split(/\s+/)
			.filter(Boolean)
			.map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
			.join(' ');
	return `${toTitle(first)} ${toTitle(last)}`.trim();
}

function validateConfirmedDuplicateRows(
	rows: Array<{ firstName: string; middleName: string; lastName: string }>,
	duplicateDecisions: Record<string, 'yes' | 'no'>
): string | null {
	for (const [firstLastKey, decision] of Object.entries(duplicateDecisions)) {
		if (decision !== 'yes') {
			continue;
		}
		const matchingRows = rows.filter(
			(row) => normalizeFirstLastKey(row.firstName, row.lastName) === firstLastKey
		);
		if (matchingRows.length < 2) {
			continue;
		}

		const normalizedMiddles = matchingRows.map((row) => row.middleName.trim().toLowerCase());
		if (normalizedMiddles.some((value) => !value)) {
			return `Confirmed duplicate ${formatDuplicateNameFromKey(
				firstLastKey
			)} requires middle initial/name for each selected row.`;
		}
		if (new Set(normalizedMiddles).size !== normalizedMiddles.length) {
			return `Confirmed duplicate ${formatDuplicateNameFromKey(
				firstLastKey
			)} requires unique middle values for each selected row.`;
		}
	}
	return null;
}

interface PreviewRow {
	id: string;
	firstName: string;
	middleName: string | null;
	lastName: string;
	requiredCertCodes: CertificationCode[];
	includeByDefault: boolean;
	statusLabel: string;
	highlightClass: string;
}

function isE2EBypassOrg(organizationId: string): boolean {
	return (
		process.env.NODE_ENV !== 'production' &&
		process.env.E2E_AUTH_BYPASS === 'true' &&
		organizationId === 'e2e-org'
	);
}

function buildPreviewRows(
	resolved: ReturnType<typeof parseStaffImport>['resolved'],
	unresolved: ReturnType<typeof parseStaffImport>['unresolved']
): PreviewRow[] {
	const rows: PreviewRow[] = [];
	let counter = 0;

	for (const row of resolved) {
		rows.push({
			id: `r${counter++}`,
			firstName: row.firstName,
			middleName: row.middleName,
			lastName: row.lastName,
			requiredCertCodes: row.requiredCertCodes,
			includeByDefault: true,
			statusLabel: `Resolved (${Math.round((row.confidence ?? 1) * 100)}%)`,
			highlightClass: 'resolved'
		});
	}

	for (const row of unresolved) {
		rows.push({
			id: `r${counter++}`,
			firstName: row.suggestion.firstName,
			middleName: row.suggestion.middleName,
			lastName: row.suggestion.lastName,
			requiredCertCodes: row.requiredCertCodes,
			includeByDefault: false,
			statusLabel: row.reason,
			highlightClass: 'unresolved'
		});
	}

	return rows;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.membership) {
		throw redirect(303, '/app/onboarding');
	}

	const existingStaff = isE2EBypassOrg(locals.membership.organizationId)
		? []
		: await listStaff({
				organizationId: locals.membership.organizationId
			});

	return {
		existingCount: existingStaff.length,
		certCodes: FIXED_CERTIFICATION_CODES,
		showTestingTools: process.env.NODE_ENV !== 'production'
	};
};

export const actions: Actions = {
	importPreview: async ({ request, locals }) => {
		if (!locals.membership) {
			throw redirect(303, '/app/onboarding');
		}
		const useE2EBypass = isE2EBypassOrg(locals.membership.organizationId);

		const formData = await request.formData();
		const requiredCertCodes = parseSelectedCerts(formData);
		const parsedInput = importPreviewSchema.safeParse({
			rawText: String(formData.get('rawText') ?? ''),
			requiredCertCodes,
			patternDecisions: parsePatternDecisions(formData)
		});

		if (!parsedInput.success) {
			return fail(400, {
				action: 'importPreview',
				error: parsedInput.error.issues[0]?.message ?? 'Invalid input'
			});
		}

		const existingStaff = useE2EBypass
			? []
			: await listStaff({
					organizationId: locals.membership.organizationId
				});

		const preview = parseStaffImport({
			rawText: parsedInput.data.rawText,
			requiredCertCodes: parsedInput.data.requiredCertCodes,
			patternDecisions: parsedInput.data.patternDecisions,
			existingStaff: existingStaff.map((person) => ({
				firstName: person.firstName,
				middleName: person.middleName ?? null,
				lastName: person.lastName
			}))
		});

		return {
			action: 'importPreview',
			success: true,
			rawText: parsedInput.data.rawText,
			requiredCertCodes: parsedInput.data.requiredCertCodes,
			patternDecisions: parsedInput.data.patternDecisions ?? {},
			pendingPatternDecisions: preview.pendingPatternDecisions,
			detectedSourceType: preview.detectedSourceType,
			previewRows: buildPreviewRows(preview.resolved, preview.unresolved)
		};
	},
	importCommit: async ({ request, locals }) => {
		if (!locals.membership) {
			throw redirect(303, '/app/onboarding');
		}
		const useE2EBypass = isE2EBypassOrg(locals.membership.organizationId);

		const formData = await request.formData();
		const commitRows = parseCommitRows(formData);
		const duplicateDecisions = parseDuplicateDecisions(formData);
		if (commitRows.invalidIncludedIndexes.length > 0) {
			return fail(400, {
				action: 'importCommit',
				error: `Missing first/last name in selected row(s): ${commitRows.invalidIncludedIndexes.join(
					', '
				)}`
			});
		}
		const duplicateValidationError = validateConfirmedDuplicateRows(
			commitRows.rows,
			duplicateDecisions
		);
		if (duplicateValidationError) {
			return fail(400, {
				action: 'importCommit',
				error: duplicateValidationError
			});
		}

		const parsed = importCommitSchema.safeParse({
			rows: commitRows.rows
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'importCommit',
				error: parsed.error.issues[0]?.message ?? 'Unable to save import rows.'
			});
		}

		if (useE2EBypass) {
			return {
				action: 'importCommit',
				success: true
			};
		}

		try {
			await importStaffRowsWithRequirements(locals.membership.organizationId, parsed.data.rows);
		} catch (error) {
			return fail(409, {
				action: 'importCommit',
				error:
					error instanceof Error
						? error.message
						: 'Could not save rows. Please resolve duplicate-name conflicts.'
			});
		}

		await setStaffOnboardingComplete(locals.membership.organizationId, true);
		throw redirect(303, '/app/staff');
	},
	clearStaffTesting: async ({ locals }) => {
		if (!locals.membership) {
			throw redirect(303, '/app/onboarding');
		}
		if (process.env.NODE_ENV === 'production') {
			return fail(403, {
				action: 'clearStaffTesting',
				error: 'Clear staff is disabled in production.'
			});
		}

		try {
			const result = await clearStaffForOrganizationTesting(locals.membership.organizationId);
			return {
				action: 'clearStaffTesting',
				success: true,
				clearedCount: result.deletedCount
			};
		} catch (error) {
			return fail(409, {
				action: 'clearStaffTesting',
				error:
					error instanceof Error
						? error.message
						: 'Could not clear staff. Existing verification records may block deletion.'
			});
		}
	}
};
