import { and, eq } from 'drizzle-orm';

import { getDb, organizationMemberships, organizations, userProfiles } from '$lib/server/db';

interface CreateOrganizationForOwnerInput {
	userId: string;
	email: string;
	name: string;
	slug: string;
}

export async function organizationSlugExists(slug: string): Promise<boolean> {
	const db = getDb();
	const [record] = await db
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, slug))
		.limit(1);

	return Boolean(record);
}

export async function createOrganizationForOwner(
	input: CreateOrganizationForOwnerInput
): Promise<void> {
	const db = getDb();

	await db.transaction(async (tx) => {
		await tx
			.insert(userProfiles)
			.values({
				id: input.userId,
				email: input.email
			})
			.onConflictDoUpdate({
				target: userProfiles.id,
				set: {
					email: input.email,
					updatedAt: new Date()
				}
			});

		const [organization] = await tx
			.insert(organizations)
			.values({
				name: input.name,
				slug: input.slug
			})
			.returning({ id: organizations.id });

		await tx.insert(organizationMemberships).values({
			organizationId: organization.id,
			userId: input.userId,
			role: 'owner',
			isActive: true
		});
	});
}

export async function userBelongsToOrganization(
	userId: string,
	organizationId: string
): Promise<boolean> {
	const db = getDb();
	const [record] = await db
		.select({ id: organizationMemberships.id })
		.from(organizationMemberships)
		.where(
			and(
				eq(organizationMemberships.userId, userId),
				eq(organizationMemberships.organizationId, organizationId),
				eq(organizationMemberships.isActive, true)
			)
		)
		.limit(1);

	return Boolean(record);
}
