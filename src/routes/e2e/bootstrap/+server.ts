import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function isE2EAuthBypassEnabled(): boolean {
	return process.env.NODE_ENV !== 'production' && process.env.E2E_AUTH_BYPASS === 'true';
}

export const GET: RequestHandler = async ({ cookies }) => {
	if (!isE2EAuthBypassEnabled()) {
		throw error(404, 'Not found');
	}

	cookies.set('e2e_bypass_auth', '1', {
		path: '/',
		httpOnly: true,
		sameSite: 'lax'
	});

	throw redirect(303, '/app/onboarding/staff');
};
