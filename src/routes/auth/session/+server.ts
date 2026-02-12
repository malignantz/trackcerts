import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface SessionPayload {
	accessToken?: unknown;
	refreshToken?: unknown;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const payload = (await request.json().catch(() => null)) as SessionPayload | null;
	const accessToken = typeof payload?.accessToken === 'string' ? payload.accessToken : null;
	const refreshToken = typeof payload?.refreshToken === 'string' ? payload.refreshToken : null;

	if (!accessToken || !refreshToken) {
		return json(
			{
				message: 'Missing access or refresh token.'
			},
			{ status: 400 }
		);
	}

	const { error } = await locals.supabase.auth.setSession({
		access_token: accessToken,
		refresh_token: refreshToken
	});

	if (error) {
		return json(
			{
				message: 'Invalid or expired sign-in link.'
			},
			{ status: 400 }
		);
	}

	return json({ success: true });
};
