import { env as privateEnv } from '$env/dynamic/private';

export function isDevLoginLinksEnabled(): boolean {
	const rawFlag =
		privateEnv.DEV_LOGIN_LINKS_ENABLED && privateEnv.DEV_LOGIN_LINKS_ENABLED.length > 0
			? privateEnv.DEV_LOGIN_LINKS_ENABLED
			: process.env.DEV_LOGIN_LINKS_ENABLED;

	return process.env.NODE_ENV !== 'production' && rawFlag === 'true';
}
