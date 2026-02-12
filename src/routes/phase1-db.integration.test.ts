import { randomUUID } from 'node:crypto';

import { eq, ilike, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { getDb } from '$lib/server/db';
import {
	certificationTypes,
	documents,
	ecardEntries,
	organizationMemberships,
	organizations,
	staff,
	submissions,
	userProfiles,
	verificationJobs
} from '$lib/server/db/schema';
import {
	createCertificationType,
	listCertificationTypes,
	setCertificationTypeActive,
	updateCertificationType
} from '$lib/server/org/certification-types';
import { createOrganizationForOwner } from '$lib/server/org/service';
import {
	createStaffRecord,
	getStaffById,
	listStaff,
	updateStaffRecord
} from '$lib/server/staff/repository';

import { POST as dispatchSubmission } from './api/internal/submissions/[id]/dispatch/+server';

const TEST_PREFIX = 'itp1db-';

function createTag(): string {
	return `${TEST_PREFIX}${randomUUID().slice(0, 8)}`;
}

function createEmail(tag: string): string {
	return `${tag}@example.test`;
}

async function cleanupTestRows(): Promise<void> {
	const db = getDb();
	const orgRows = await db
		.select({ id: organizations.id })
		.from(organizations)
		.where(ilike(organizations.slug, `${TEST_PREFIX}%`));
	const organizationIds = orgRows.map((row) => row.id);

	if (organizationIds.length > 0) {
		const submissionRows = await db
			.select({ id: submissions.id })
			.from(submissions)
			.where(inArray(submissions.organizationId, organizationIds));
		const submissionIds = submissionRows.map((row) => row.id);

		if (submissionIds.length > 0) {
			const ecardRows = await db
				.select({ id: ecardEntries.id })
				.from(ecardEntries)
				.where(inArray(ecardEntries.submissionId, submissionIds));
			const ecardIds = ecardRows.map((row) => row.id);

			if (ecardIds.length > 0) {
				await db.delete(verificationJobs).where(inArray(verificationJobs.ecardEntryId, ecardIds));
			}

			await db.delete(ecardEntries).where(inArray(ecardEntries.submissionId, submissionIds));
			await db.delete(submissions).where(inArray(submissions.id, submissionIds));
		}

		await db.delete(documents).where(inArray(documents.organizationId, organizationIds));
		await db.delete(staff).where(inArray(staff.organizationId, organizationIds));
		await db
			.delete(certificationTypes)
			.where(inArray(certificationTypes.organizationId, organizationIds));
		await db
			.delete(organizationMemberships)
			.where(inArray(organizationMemberships.organizationId, organizationIds));
		await db.delete(organizations).where(inArray(organizations.id, organizationIds));
	}

	await db.delete(userProfiles).where(ilike(userProfiles.email, `${TEST_PREFIX}%@example.test`));
}

async function createOrganizationFixture() {
	const tag = createTag();
	const userId = randomUUID();

	await createOrganizationForOwner({
		userId,
		email: createEmail(tag),
		name: `${tag} Medical`,
		slug: tag
	});

	const db = getDb();
	const [organization] = await db
		.select({ id: organizations.id, slug: organizations.slug })
		.from(organizations)
		.where(eq(organizations.slug, tag))
		.limit(1);

	if (!organization) {
		throw new Error(`Expected organization fixture ${tag} to exist`);
	}

	return {
		organizationId: organization.id,
		userId
	};
}

async function createSubmissionFixture(organizationId: string) {
	const db = getDb();
	const [staffRecord] = await db
		.insert(staff)
		.values({
			organizationId,
			firstName: 'Nina',
			lastName: 'Diaz',
			isActive: true
		})
		.returning({ id: staff.id });

	const [submission] = await db
		.insert(submissions)
		.values({
			organizationId,
			staffId: staffRecord.id,
			submittedFirstName: 'Nina',
			submittedLastName: 'Diaz',
			status: 'pending'
		})
		.returning({ id: submissions.id });

	return {
		submissionId: submission.id
	};
}

describe.sequential('phase 1 db-backed integration', () => {
	beforeEach(async () => {
		await cleanupTestRows();
	});

	afterAll(async () => {
		await cleanupTestRows();
	});

	it('creates organization, user profile, and owner membership transactionally', async () => {
		const tag = createTag();
		const userId = randomUUID();
		const email = createEmail(tag);

		await createOrganizationForOwner({
			userId,
			email,
			name: `${tag} Hospital`,
			slug: tag
		});

		const db = getDb();
		const [organization] = await db
			.select({ id: organizations.id, slug: organizations.slug })
			.from(organizations)
			.where(eq(organizations.slug, tag))
			.limit(1);
		expect(organization).toBeTruthy();

		const [profile] = await db
			.select({ id: userProfiles.id, email: userProfiles.email })
			.from(userProfiles)
			.where(eq(userProfiles.id, userId))
			.limit(1);
		expect(profile).toEqual({
			id: userId,
			email
		});

		const [membership] = await db
			.select({
				organizationId: organizationMemberships.organizationId,
				userId: organizationMemberships.userId,
				role: organizationMemberships.role,
				isActive: organizationMemberships.isActive
			})
			.from(organizationMemberships)
			.where(eq(organizationMemberships.userId, userId))
			.limit(1);
		expect(membership).toEqual({
			organizationId: organization?.id,
			userId,
			role: 'owner',
			isActive: true
		});
	});

	it('enforces organization scoping in staff repository operations', async () => {
		const firstOrg = await createOrganizationFixture();
		const secondOrg = await createOrganizationFixture();

		await createStaffRecord(firstOrg.organizationId, {
			firstName: 'Alice',
			lastName: 'Andrews'
		});
		await createStaffRecord(secondOrg.organizationId, {
			firstName: 'Bob',
			lastName: 'Bishop'
		});

		const firstOrgStaff = await listStaff({ organizationId: firstOrg.organizationId });
		expect(firstOrgStaff).toHaveLength(1);
		expect(firstOrgStaff[0]).toMatchObject({
			firstName: 'Alice',
			lastName: 'Andrews'
		});

		const firstOrgSearch = await listStaff({
			organizationId: firstOrg.organizationId,
			search: 'ali'
		});
		expect(firstOrgSearch).toHaveLength(1);

		const firstOrgStaffId = firstOrgStaff[0].id;
		expect(await getStaffById(secondOrg.organizationId, firstOrgStaffId)).toBeNull();

		await updateStaffRecord(secondOrg.organizationId, firstOrgStaffId, {
			firstName: 'Wrong',
			lastName: 'Org',
			isActive: false
		});
		expect(await getStaffById(firstOrg.organizationId, firstOrgStaffId)).toMatchObject({
			firstName: 'Alice',
			lastName: 'Andrews',
			isActive: true
		});

		await updateStaffRecord(firstOrg.organizationId, firstOrgStaffId, {
			firstName: 'Alicia',
			lastName: 'Andrews',
			isActive: false
		});
		expect(await getStaffById(firstOrg.organizationId, firstOrgStaffId)).toMatchObject({
			firstName: 'Alicia',
			lastName: 'Andrews',
			isActive: false
		});
	});

	it('enforces organization scoping in certification type operations', async () => {
		const firstOrg = await createOrganizationFixture();
		const secondOrg = await createOrganizationFixture();

		await createCertificationType(firstOrg.organizationId, {
			code: 'BLS',
			label: 'Basic Life Support'
		});
		await createCertificationType(secondOrg.organizationId, {
			code: 'BLS',
			label: 'Second Org BLS'
		});

		const firstOrgCerts = await listCertificationTypes(firstOrg.organizationId);
		expect(firstOrgCerts).toHaveLength(1);
		const firstOrgCertId = firstOrgCerts[0].id;

		await updateCertificationType(secondOrg.organizationId, firstOrgCertId, {
			code: 'SHOULD_NOT_CHANGE',
			label: 'Wrong Org Update'
		});
		expect((await listCertificationTypes(firstOrg.organizationId))[0]).toMatchObject({
			code: 'BLS',
			label: 'Basic Life Support'
		});

		await updateCertificationType(firstOrg.organizationId, firstOrgCertId, {
			code: 'BLS_RENEWAL',
			label: 'BLS Renewal'
		});
		await setCertificationTypeActive(firstOrg.organizationId, firstOrgCertId, false);

		expect((await listCertificationTypes(firstOrg.organizationId))[0]).toMatchObject({
			code: 'BLS_RENEWAL',
			label: 'BLS Renewal',
			isActive: false
		});
	});

	it('dispatch endpoint enforces auth and organization ownership', async () => {
		const firstOrg = await createOrganizationFixture();
		const secondOrg = await createOrganizationFixture();
		const firstSubmission = await createSubmissionFixture(firstOrg.organizationId);
		const secondSubmission = await createSubmissionFixture(secondOrg.organizationId);

		await expect(
			dispatchSubmission({
				locals: {
					user: null,
					membership: null
				},
				params: {
					id: firstSubmission.submissionId
				}
			} as never)
		).rejects.toMatchObject({ status: 401 });

		await expect(
			dispatchSubmission({
				locals: {
					user: { id: firstOrg.userId },
					membership: { organizationId: firstOrg.organizationId }
				},
				params: {
					id: secondSubmission.submissionId
				}
			} as never)
		).rejects.toMatchObject({ status: 404 });

		const response = await dispatchSubmission({
			locals: {
				user: { id: firstOrg.userId },
				membership: { organizationId: firstOrg.organizationId }
			},
			params: {
				id: firstSubmission.submissionId
			}
		} as never);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			status: 'queued_stub',
			submissionId: firstSubmission.submissionId
		});
	});
});
