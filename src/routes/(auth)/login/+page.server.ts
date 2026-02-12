import { createClient } from '@supabase/supabase-js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { getServerEnv } from '$lib/server/env';
import { magicLinkEmailSchema } from '$lib/validation/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/app/staff');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const parsed = magicLinkEmailSchema.safeParse({
			email: formData.get('email')
		});

		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Invalid email address',
				email: String(formData.get('email') ?? '')
			});
		}

		const env = getServerEnv();
		const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});

		const redirectTo = `${env.APP_URL}/auth/callback`;
		const { error } = await authClient.auth.signInWithOtp({
			email: parsed.data.email,
			options: {
				emailRedirectTo: redirectTo
			}
		});

		if (error) {
			return fail(400, {
				error: error.message,
				email: parsed.data.email
			});
		}

		return {
			success: true,
			message: 'Magic link sent. Check your inbox to continue.',
			email: parsed.data.email
		};
	}
};
