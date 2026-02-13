import { and, eq } from 'drizzle-orm';

import { getDb, organizationMemberships, organizations, userProfiles } from '$lib/server/db';
import { deriveSiteCodeFromSlug, generateRandomSiteCode, normalizeSiteCode } from './site-code';

interface CreateOrganizationForOwnerInput {
	userId: string;
	email: string;
	name: string;
	slug: string;
	siteCode?: string;
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

export async function organizationSiteCodeExists(siteCode: string): Promise<boolean> {
	const db = getDb();
	const [record] = await db
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.siteCode, siteCode))
		.limit(1);

	return Boolean(record);
}

async function createUniqueSiteCode(seed: string): Promise<string> {
	const firstCandidate = deriveSiteCodeFromSlug(seed);
	if (!(await organizationSiteCodeExists(firstCandidate))) {
		return firstCandidate;
	}

	for (let attempts = 0; attempts < 20; attempts += 1) {
		const candidate = generateRandomSiteCode();
		if (!(await organizationSiteCodeExists(candidate))) {
			return candidate;
		}
	}

	throw new Error('Unable to generate a unique site code');
}

export async function createOrganizationForOwner(
	input: CreateOrganizationForOwnerInput
): Promise<{ organizationId: string; siteCode: string }> {
	const db = getDb();
	const requestedSiteCode = input.siteCode ? normalizeSiteCode(input.siteCode) : '';
	if (requestedSiteCode && (await organizationSiteCodeExists(requestedSiteCode))) {
		throw new Error('Site code already exists');
	}
	const siteCode =
		requestedSiteCode.length > 0 ? requestedSiteCode : await createUniqueSiteCode(input.slug);

	return db.transaction(async (tx) => {
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
				slug: input.slug,
				siteCode,
				staffOnboardingComplete: false
			})
			.returning({ id: organizations.id });

		await tx.insert(organizationMemberships).values({
			organizationId: organization.id,
			userId: input.userId,
			role: 'owner',
			isActive: true
		});

		return {
			organizationId: organization.id,
			siteCode
		};
	});
}

export async function setStaffOnboardingComplete(
	organizationId: string,
	isComplete: boolean
): Promise<void> {
	const db = getDb();
	await db
		.update(organizations)
		.set({
			staffOnboardingComplete: isComplete,
			updatedAt: new Date()
		})
		.where(eq(organizations.id, organizationId));
}

export async function getOrganizationBySiteCode(siteCode: string) {
	const db = getDb();
	const normalized = normalizeSiteCode(siteCode);
	if (!normalized) {
		return null;
	}

	const [record] = await db
		.select({
			id: organizations.id,
			name: organizations.name,
			slug: organizations.slug,
			siteCode: organizations.siteCode,
			staffOnboardingComplete: organizations.staffOnboardingComplete
		})
		.from(organizations)
		.where(eq(organizations.siteCode, normalized))
		.limit(1);

	return record ?? null;
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
