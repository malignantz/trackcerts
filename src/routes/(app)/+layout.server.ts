import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

import { logAccessDenied } from '$lib/server/audit/logger';
import { resolveAppAccess } from '$lib/server/auth/access-policy';
import {
	canUserBootstrapOrganization,
	getActiveMembershipForUser,
	upsertUserProfile
} from '$lib/server/auth/memberships';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isOnboardingPath = url.pathname.startsWith('/app/onboarding');

	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const canBootstrap = await canUserBootstrapOrganization();

	if (locals.user.email) {
		await upsertUserProfile(locals.user.id, locals.user.email);
	}

	const membership = await getActiveMembershipForUser(locals.user.id);
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

	if (access === 'redirect_onboarding') {
		throw redirect(303, '/app/onboarding');
	}

	if (access === 'deny_missing_membership') {
		await logAccessDenied({
			actorId: locals.user?.id,
			organizationId: null,
			path: url.pathname,
			reason: 'missing_membership'
		});
		throw error(403, 'Your account is not assigned to an organization.');
	}

	return {
		userEmail: locals.user?.email ?? null,
		membership
	};
};
