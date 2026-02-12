import { describe, expect, it } from 'vitest';

import { resolveAppAccess } from '$lib/server/auth/access-policy';

describe('app route access policy integration scenarios', () => {
	it('redirects authenticated users without memberships to onboarding', () => {
		expect(
			resolveAppAccess({
				hasUser: true,
				hasMembership: false,
				canBootstrap: true,
				isOnboardingPath: false
			})
		).toBe('redirect_onboarding');
	});

	it('allows authenticated users with memberships on app routes', () => {
		expect(
			resolveAppAccess({
				hasUser: true,
				hasMembership: true,
				canBootstrap: false,
				isOnboardingPath: false
			})
		).toBe('allow');
	});

	it('redirects members away from onboarding', () => {
		expect(
			resolveAppAccess({
				hasUser: true,
				hasMembership: true,
				canBootstrap: false,
				isOnboardingPath: true
			})
		).toBe('redirect_onboarding');
	});
});
