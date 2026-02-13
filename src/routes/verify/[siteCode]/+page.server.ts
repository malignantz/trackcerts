import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { FIXED_CERTIFICATION_CODES } from '$lib/certifications';
import { getOrganizationBySiteCode } from '$lib/server/org/service';
import { findStaffByName } from '$lib/server/staff/repository';
import { getRequiredCertCodesForStaff } from '$lib/server/staff/requirements';
import { createSubmissionWithEcards } from '$lib/server/submissions/service';
import { ecardProviderClient } from '$lib/server/services/ecard-provider';
import { verificationDispatcher } from '$lib/server/services/verification-dispatcher';
import { lookupByEmailSchema } from '$lib/validation/verify';
import { createStaffSchema } from '$lib/validation/staff';
import type { CertificationCode } from '$lib/types';

async function resolveStaffMember(input: {
	organizationId: string;
	firstName: string;
	middleName?: string | null;
	lastName: string;
}) {
	const matches = await findStaffByName({
		organizationId: input.organizationId,
		firstName: input.firstName,
		middleName: input.middleName,
		lastName: input.lastName,
		activeOnly: true
	});

	if (matches.length === 1) {
		return { staff: matches[0], error: null };
	}

	if (!input.middleName && matches.length > 1) {
		return {
			staff: null,
			error: 'Multiple staff members match that name. Enter middle name or initial.'
		};
	}

	return {
		staff: null,
		error: 'Staff member not found. Check spelling and try again.'
	};
}

function parseEcardForm(formData: FormData): Record<CertificationCode, string> {
	return {
		ACLS: String(formData.get('ecardACLS') ?? '').trim(),
		BLS: String(formData.get('ecardBLS') ?? '').trim(),
		PALS: String(formData.get('ecardPALS') ?? '').trim()
	};
}

export const load: PageServerLoad = async ({ params }) => {
	const organization = await getOrganizationBySiteCode(params.siteCode);
	if (!organization) {
		throw error(404, 'Invalid site code');
	}

	return {
		organizationName: organization.name,
		siteCode: organization.siteCode,
		certCodes: FIXED_CERTIFICATION_CODES
	};
};

export const actions: Actions = {
	submitEcard: async ({ request, params }) => {
		const organization = await getOrganizationBySiteCode(params.siteCode);
		if (!organization) {
			throw error(404, 'Invalid site code');
		}

		const formData = await request.formData();
		const middleName = formData.get('middleName');
		const parsedName = createStaffSchema.safeParse({
			firstName: formData.get('firstName'),
			middleName: typeof middleName === 'string' ? middleName : undefined,
			lastName: formData.get('lastName')
		});

		if (!parsedName.success) {
			return fail(400, {
				action: 'submitEcard',
				error: parsedName.error.issues[0]?.message ?? 'Invalid name input.'
			});
		}

		const resolved = await resolveStaffMember({
			organizationId: organization.id,
			firstName: parsedName.data.firstName,
			middleName: parsedName.data.middleName,
			lastName: parsedName.data.lastName
		});
		if (!resolved.staff) {
			return fail(404, {
				action: 'submitEcard',
				error: resolved.error
			});
		}

		const requiredCertCodes = await getRequiredCertCodesForStaff(
			organization.id,
			resolved.staff.id
		);
		if (requiredCertCodes.length === 0) {
			return fail(400, {
				action: 'submitEcard',
				error: 'No required certifications are configured for this staff member.'
			});
		}

		const ecardForm = parseEcardForm(formData);
		const missing = requiredCertCodes.filter((certCode) => !ecardForm[certCode]);
		if (missing.length > 0) {
			return fail(400, {
				action: 'submitEcard',
				error: `Missing eCard code for: ${missing.join(', ')}`
			});
		}

		const submissionId = await createSubmissionWithEcards({
			organizationId: organization.id,
			staffId: resolved.staff.id,
			submittedFirstName: parsedName.data.firstName,
			submittedLastName: parsedName.data.lastName,
			submittedEmail: null,
			intakeMethod: 'ecard_direct',
			sourceSiteCode: organization.siteCode,
			ecardCodes: requiredCertCodes.map((certCode) => ({
				certCode,
				ecardCode: ecardForm[certCode]
			}))
		});
		await verificationDispatcher.enqueueSubmission(submissionId);

		return {
			action: 'submitEcard',
			success: true,
			receiptId: submissionId
		};
	},
	lookupByEmail: async ({ request, params }) => {
		const organization = await getOrganizationBySiteCode(params.siteCode);
		if (!organization) {
			throw error(404, 'Invalid site code');
		}

		const formData = await request.formData();
		const middleName = formData.get('middleName');
		const parsed = lookupByEmailSchema.safeParse({
			firstName: formData.get('firstName'),
			middleName: typeof middleName === 'string' ? middleName : undefined,
			lastName: formData.get('lastName'),
			email: formData.get('email')
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'lookupByEmail',
				error: parsed.error.issues[0]?.message ?? 'Invalid lookup input.'
			});
		}

		const resolved = await resolveStaffMember({
			organizationId: organization.id,
			firstName: parsed.data.firstName,
			middleName: parsed.data.middleName,
			lastName: parsed.data.lastName
		});
		if (!resolved.staff) {
			return fail(404, {
				action: 'lookupByEmail',
				error: resolved.error
			});
		}

		const requiredCertCodes = await getRequiredCertCodesForStaff(
			organization.id,
			resolved.staff.id
		);
		if (requiredCertCodes.length === 0) {
			return fail(400, {
				action: 'lookupByEmail',
				error: 'No required certifications are configured for this staff member.'
			});
		}

		const lookupResults = await ecardProviderClient.lookupEcardsByNameEmail({
			organizationId: organization.id,
			siteCode: organization.siteCode,
			firstName: parsed.data.firstName,
			middleName: parsed.data.middleName,
			lastName: parsed.data.lastName,
			email: parsed.data.email
		});

		const resultMap = new Map(lookupResults.map((row) => [row.certCode, row.ecardCode]));
		const missing = requiredCertCodes.filter((certCode) => !resultMap.get(certCode));
		if (missing.length > 0) {
			return fail(400, {
				action: 'lookupByEmail',
				error: `Could not find eCard codes for: ${missing.join(', ')}`
			});
		}

		const submissionId = await createSubmissionWithEcards({
			organizationId: organization.id,
			staffId: resolved.staff.id,
			submittedFirstName: parsed.data.firstName,
			submittedLastName: parsed.data.lastName,
			submittedEmail: parsed.data.email,
			intakeMethod: 'email_lookup',
			sourceSiteCode: organization.siteCode,
			ecardCodes: requiredCertCodes.map((certCode) => ({
				certCode,
				ecardCode: resultMap.get(certCode) ?? ''
			}))
		});
		await verificationDispatcher.enqueueSubmission(submissionId);

		return {
			action: 'lookupByEmail',
			success: true,
			receiptId: submissionId
		};
	}
};
