import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

import { resolveAppAccess } from '$lib/server/auth/access-policy';
import { canUserBootstrapOrganization, upsertUserProfile } from '$lib/server/auth/memberships';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isOnboardingPath = url.pathname === '/app/onboarding';
	const isStaffOnboardingPath = url.pathname.startsWith('/app/onboarding/staff');
	const isE2EBypassMembership =
		process.env.NODE_ENV !== 'production' &&
		process.env.E2E_AUTH_BYPASS === 'true' &&
		locals.membership?.organizationId === 'e2e-org';

	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const canBootstrap = isE2EBypassMembership ? false : await canUserBootstrapOrganization();

	if (locals.user.email && !isE2EBypassMembership) {
		await upsertUserProfile(locals.user.id, locals.user.email);
	}

	const membership = locals.membership;
	locals.membership = membership;

	const access = resolveAppAccess({
		hasUser: Boolean(locals.user),
		hasMembership: Boolean(membership),
		canBootstrap,
		isOnboardingPath
	});

	if (access === 'redirect_login') {
		throw redirect(303, '/login');
	}

	if (access === 'redirect_to_onboarding') {
		throw redirect(303, '/app/onboarding');
	}

	if (access === 'redirect_to_staff') {
		throw redirect(303, '/app/staff');
	}

	if (membership && !membership.staffOnboardingComplete) {
		const isAllowedPath =
			isStaffOnboardingPath ||
			url.pathname.startsWith('/app/logout') ||
			url.pathname.startsWith('/app/onboarding');
		if (!isAllowedPath) {
			throw redirect(303, '/app/onboarding/staff');
		}
	}

	return {
		userEmail: locals.user?.email ?? null,
		membership
	};
};
