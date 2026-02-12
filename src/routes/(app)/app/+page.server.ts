import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.membership) {
		throw redirect(303, '/app/staff');
	}

	throw redirect(303, '/app/onboarding');
};
