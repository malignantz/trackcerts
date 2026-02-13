import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createStaffRecord } from '$lib/server/staff/repository';
import { createStaffSchema } from '$lib/validation/staff';

export const load: PageServerLoad = async () => ({
	title: 'Create staff member'
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.membership) {
			throw redirect(303, '/app/onboarding');
		}

		const formData = await request.formData();
		const parsed = createStaffSchema.safeParse({
			firstName: formData.get('firstName'),
			middleName: formData.get('middleName'),
			lastName: formData.get('lastName')
		});

		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Invalid input',
				firstName: String(formData.get('firstName') ?? ''),
				middleName: String(formData.get('middleName') ?? ''),
				lastName: String(formData.get('lastName') ?? '')
			});
		}

		await createStaffRecord(locals.membership.organizationId, parsed.data);

		throw redirect(303, '/app/staff');
	}
};
