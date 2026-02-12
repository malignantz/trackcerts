import { describe, expect, it } from 'vitest';

import { isDevLoginLinksEnabled } from './dev-login';

describe('isDevLoginLinksEnabled', () => {
	it('returns false in production', () => {
		const originalNodeEnv = process.env.NODE_ENV;
		const originalFlag = process.env.DEV_LOGIN_LINKS_ENABLED;

		process.env.NODE_ENV = 'production';
		process.env.DEV_LOGIN_LINKS_ENABLED = 'true';

		expect(isDevLoginLinksEnabled()).toBe(false);

		process.env.NODE_ENV = originalNodeEnv;
		process.env.DEV_LOGIN_LINKS_ENABLED = originalFlag;
	});

	it('returns true only when enabled outside production', () => {
		const originalNodeEnv = process.env.NODE_ENV;
		const originalFlag = process.env.DEV_LOGIN_LINKS_ENABLED;

		process.env.NODE_ENV = 'development';
		process.env.DEV_LOGIN_LINKS_ENABLED = 'true';
		expect(isDevLoginLinksEnabled()).toBe(true);

		process.env.DEV_LOGIN_LINKS_ENABLED = 'false';
		expect(isDevLoginLinksEnabled()).toBe(false);

		process.env.NODE_ENV = originalNodeEnv;
		process.env.DEV_LOGIN_LINKS_ENABLED = originalFlag;
	});
});
