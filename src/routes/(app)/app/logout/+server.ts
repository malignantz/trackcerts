import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	await locals.supabase.auth.signOut();
	cookies.delete('e2e_bypass_auth', { path: '/' });
	throw redirect(303, '/login');
};
