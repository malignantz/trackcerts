import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import type { Handle } from '@sveltejs/kit';

import { getActiveMembershipForUser } from '$lib/server/auth/memberships';
import { ensureLocalDevDatabaseReachable } from '$lib/server/db';
import { getServerEnv } from '$lib/server/env';

function isE2EAuthBypassEnabled(): boolean {
	return process.env.NODE_ENV !== 'production' && process.env.E2E_AUTH_BYPASS === 'true';
}

function resolveE2EBypassUser(userId: string, email: string): User {
	return {
		id: userId,
		email
	} as User;
}

function resolveE2EBypassMembership() {
	return {
		membershipId: 'e2e-membership',
		organizationId: 'e2e-org',
		organizationName: 'E2E Organization',
		organizationSlug: 'e2e-org',
		organizationSiteCode: 'e2e0001',
		staffOnboardingComplete: false,
		role: 'owner' as const
	};
}

export const handle: Handle = async ({ event, resolve }) => {
	const env = getServerEnv();
	await ensureLocalDevDatabaseReachable();

	event.locals.supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
		global: {
			fetch: event.fetch
		},
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();

		if (!session) {
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	const { session, user } = await event.locals.safeGetSession();
	let resolvedSession = session;
	let resolvedUser = user;
	let resolvedMembership = null;

	if (!resolvedUser && isE2EAuthBypassEnabled()) {
		const bypassCookie = event.cookies.get('e2e_bypass_auth');
		if (bypassCookie === '1') {
			resolvedSession = null;
			resolvedUser = resolveE2EBypassUser('e2e-user', 'e2e@example.test');
			resolvedMembership = resolveE2EBypassMembership();
		}
	}

	event.locals.session = resolvedSession;
	event.locals.user = resolvedUser;
	event.locals.membership =
		resolvedMembership ?? (resolvedUser ? await getActiveMembershipForUser(resolvedUser.id) : null);

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};
