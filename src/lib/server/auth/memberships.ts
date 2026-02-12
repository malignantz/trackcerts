import { and, count, eq } from 'drizzle-orm';

import { getDb } from '$lib/server/db';
import {
	organizationMemberships,
	organizations,
	userProfiles,
	type roleEnum
} from '$lib/server/db/schema';

import type { ActiveMembership } from './types';

type MembershipRole = (typeof roleEnum.enumValues)[number];

export async function upsertUserProfile(userId: string, email: string): Promise<void> {
	const db = getDb();

	await db
		.insert(userProfiles)
		.values({
			id: userId,
			email
		})
		.onConflictDoUpdate({
			target: userProfiles.id,
			set: {
				email,
				updatedAt: new Date()
			}
		});
}

export async function getActiveMembershipForUser(userId: string): Promise<ActiveMembership | null> {
	const db = getDb();

	const [record] = await db
		.select({
			membershipId: organizationMemberships.id,
			organizationId: organizations.id,
			organizationName: organizations.name,
			organizationSlug: organizations.slug,
			role: organizationMemberships.role
		})
		.from(organizationMemberships)
		.innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
		.where(
			and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.isActive, true))
		)
		.limit(1);

	if (!record) {
		return null;
	}

	return {
		membershipId: record.membershipId,
		organizationId: record.organizationId,
		organizationName: record.organizationName,
		organizationSlug: record.organizationSlug,
		role: record.role as MembershipRole
	};
}

export async function canUserBootstrapOrganization(): Promise<boolean> {
	const db = getDb();
	const [result] = await db.select({ total: count() }).from(organizations);

	return (result?.total ?? 0) === 0;
}
