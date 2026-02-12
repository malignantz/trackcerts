import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type');
	const code = url.searchParams.get('code');

	if (tokenHash && type) {
		const { error } = await locals.supabase.auth.verifyOtp({
			type: type as EmailOtpType,
			token_hash: tokenHash
		});

		if (error) {
			throw redirect(303, `/login?error=${encodeURIComponent(error.message)}`);
		}
	}

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (error) {
			throw redirect(303, `/login?error=${encodeURIComponent(error.message)}`);
		}
	}

	throw redirect(303, '/app');
};
