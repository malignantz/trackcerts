export type AppAccessDecision =
	| 'redirect_login'
	| 'redirect_to_onboarding'
	| 'redirect_to_staff'
	| 'allow';

interface ResolveAppAccessInput {
	hasUser: boolean;
	hasMembership: boolean;
	canBootstrap: boolean;
	isOnboardingPath: boolean;
}

export function resolveAppAccess(input: ResolveAppAccessInput): AppAccessDecision {
	if (!input.hasUser) {
		return 'redirect_login';
	}

	if (input.hasMembership && input.isOnboardingPath) {
		return 'redirect_to_staff';
	}

	if (input.hasMembership) {
		return 'allow';
	}

	if (!input.hasMembership && input.isOnboardingPath && input.canBootstrap) {
		return 'allow';
	}

	if (!input.hasMembership && input.isOnboardingPath && !input.canBootstrap) {
		return 'allow';
	}

	return 'redirect_to_onboarding';
}
