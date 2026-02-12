import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { getStaffById, updateStaffRecord } from '$lib/server/staff/repository';
import { updateStaffSchema } from '$lib/validation/staff';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.membership) {
		throw redirect(303, '/app/onboarding');
	}

	const record = await getStaffById(locals.membership.organizationId, params.id);
	if (!record) {
		throw redirect(303, '/app/staff');
	}

	return {
		record
	};
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		if (!locals.membership) {
			throw redirect(303, '/app/onboarding');
		}

		const formData = await request.formData();
		const parsed = updateStaffSchema.safeParse({
			firstName: formData.get('firstName'),
			lastName: formData.get('lastName'),
			isActive: formData.get('isActive') === 'on'
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'update',
				error: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}

		await updateStaffRecord(locals.membership.organizationId, params.id, parsed.data);
		throw redirect(303, '/app/staff');
	},
	deactivate: async ({ params, locals }) => {
		if (!locals.membership) {
			throw redirect(303, '/app/onboarding');
		}

		const record = await getStaffById(locals.membership.organizationId, params.id);
		if (!record) {
			throw redirect(303, '/app/staff');
		}

		await updateStaffRecord(locals.membership.organizationId, params.id, {
			firstName: record.firstName,
			lastName: record.lastName,
			isActive: false
		});

		throw redirect(303, '/app/staff');
	}
};
