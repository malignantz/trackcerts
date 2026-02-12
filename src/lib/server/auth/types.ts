import type { Role } from '$lib/types';

export interface ActiveMembership {
	membershipId: string;
	organizationId: string;
	organizationName: string;
	organizationSlug: string;
	role: Role;
}
