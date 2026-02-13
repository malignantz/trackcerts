import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.membership) {
		if (!locals.membership.staffOnboardingComplete) {
			throw redirect(303, '/app/onboarding/staff');
		}
		throw redirect(303, '/app/staff');
	}

	throw redirect(303, '/app/onboarding');
};
