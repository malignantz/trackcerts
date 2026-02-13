import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { FIXED_CERTIFICATION_CODES } from '$lib/certifications';
import { getStaffById, updateStaffRecord } from '$lib/server/staff/repository';
import { listStaffMatrixRows, toggleStaffRequirement } from '$lib/server/staff/requirements';
import { toggleRequirementSchema, updateStaffNameSchema } from '$lib/validation/requirements';

function parseFilterCodes(url: URL) {
	const selected = url.searchParams.getAll('show');
	if (selected.includes('ALL') || selected.length === 0) {
		return [];
	}

	return FIXED_CERTIFICATION_CODES.filter((code) => selected.includes(code));
}

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.membership) {
		return {
			staffRows: [],
			selectedFilters: ['ALL']
		};
	}

	const filterCodes = parseFilterCodes(url);
	const staffRows = await listStaffMatrixRows(locals.membership.organizationId, filterCodes);
	const selectedFilters = filterCodes.length > 0 ? filterCodes : ['ALL'];

	return {
		staffRows,
		selectedFilters
	};
};

export const actions: Actions = {
	toggleRequirement: async ({ request, locals }) => {
		if (!locals.membership) {
			throw redirect(303, '/app/onboarding');
		}

		const formData = await request.formData();
		const parsed = toggleRequirementSchema.safeParse({
			staffId: formData.get('staffId'),
			certCode: formData.get('certCode'),
			isRequired: formData.get('isRequired') === 'true'
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'toggleRequirement',
				error: parsed.error.issues[0]?.message ?? 'Invalid requirement input.'
			});
		}

		await toggleStaffRequirement(
			locals.membership.organizationId,
			parsed.data.staffId,
			parsed.data.certCode,
			!parsed.data.isRequired
		);

		return { success: true };
	},
	updateStaffName: async ({ request, locals }) => {
		if (!locals.membership) {
			throw redirect(303, '/app/onboarding');
		}

		const formData = await request.formData();
		const parsed = updateStaffNameSchema.safeParse({
			staffId: formData.get('staffId'),
			firstName: formData.get('firstName'),
			middleName: formData.get('middleName'),
			lastName: formData.get('lastName')
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'updateStaffName',
				error: parsed.error.issues[0]?.message ?? 'Invalid staff name update.'
			});
		}

		const current = await getStaffById(locals.membership.organizationId, parsed.data.staffId);
		if (!current) {
			return fail(404, {
				action: 'updateStaffName',
				error: 'Staff member not found.'
			});
		}

		await updateStaffRecord(locals.membership.organizationId, parsed.data.staffId, {
			firstName: parsed.data.firstName,
			middleName: parsed.data.middleName,
			lastName: parsed.data.lastName,
			isActive: current.isActive
		});

		return { success: true };
	}
};
