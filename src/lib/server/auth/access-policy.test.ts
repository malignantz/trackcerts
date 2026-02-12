import { describe, expect, it } from 'vitest';

import { resolveAppAccess } from './access-policy';

describe('resolveAppAccess', () => {
	it('redirects unauthenticated users to login', () => {
		expect(
			resolveAppAccess({
				hasUser: false,
				hasMembership: false,
				canBootstrap: false,
				isOnboardingPath: false
			})
		).toBe('redirect_login');
	});

	it('allows first user to access onboarding', () => {
		expect(
			resolveAppAccess({
				hasUser: true,
				hasMembership: false,
				canBootstrap: true,
				isOnboardingPath: true
			})
		).toBe('allow');
	});

	it('redirects members away from onboarding to staff', () => {
		expect(
			resolveAppAccess({
				hasUser: true,
				hasMembership: true,
				canBootstrap: false,
				isOnboardingPath: true
			})
		).toBe('redirect_to_staff');
	});

	it('allows onboarding view for unassigned users after bootstrap', () => {
		expect(
			resolveAppAccess({
				hasUser: true,
				hasMembership: false,
				canBootstrap: false,
				isOnboardingPath: true
			})
		).toBe('allow');
	});
});
