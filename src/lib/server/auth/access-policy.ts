export type AppAccessDecision =
	| 'redirect_login'
	| 'redirect_onboarding'
	| 'allow'
	| 'deny_missing_membership';

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
		return 'redirect_onboarding';
	}

	if (input.hasMembership) {
		return 'allow';
	}

	if (!input.hasMembership && input.isOnboardingPath && input.canBootstrap) {
		return 'allow';
	}

	if (!input.hasMembership && input.isOnboardingPath && !input.canBootstrap) {
		return 'deny_missing_membership';
	}

	return 'redirect_onboarding';
}
