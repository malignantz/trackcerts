import { randomUUID } from 'node:crypto';

import { and, eq, ilike, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { getDb } from '$lib/server/db';
import {
	certificationTypes,
	ecardEntries,
	organizationMemberships,
	organizations,
	staff,
	staffCertificationRequirements,
	submissions,
	userProfiles,
	verificationJobs
} from '$lib/server/db/schema';
import { createOrganizationForOwner } from '$lib/server/org/service';
import { setStaffRequirements } from '$lib/server/staff/requirements';
import { createStaffRecord } from '$lib/server/staff/repository';
import { enqueueSubmissionJobs } from '$lib/server/worker/repository';
import { runWorkerOnce } from '$lib/server/worker/runner';

import { actions as verifyActions } from './verify/[siteCode]/+page.server';

const TEST_PREFIX = 'itp3worker-';

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
			await db
				.delete(verificationJobs)
				.where(inArray(verificationJobs.submissionId, submissionIds));
			await db.delete(ecardEntries).where(inArray(ecardEntries.submissionId, submissionIds));
			await db.delete(submissions).where(inArray(submissions.id, submissionIds));
		}

		await db
			.delete(staffCertificationRequirements)
			.where(inArray(staffCertificationRequirements.organizationId, organizationIds));
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

	const organization = await createOrganizationForOwner({
		userId,
		email: createEmail(tag),
		name: `${tag} Medical`,
		slug: tag
	});

	const db = getDb();
	const [record] = await db
		.select({ id: organizations.id, siteCode: organizations.siteCode })
		.from(organizations)
		.where(eq(organizations.id, organization.organizationId))
		.limit(1);
	if (!record) {
		throw new Error('Expected organization fixture to exist');
	}

	return {
		organizationId: record.id,
		siteCode: record.siteCode
	};
}

async function createStaffFixture(
	organizationId: string,
	input: { firstName: string; middleName?: string | null; lastName: string }
): Promise<string> {
	await createStaffRecord(organizationId, {
		firstName: input.firstName,
		middleName: input.middleName ?? null,
		lastName: input.lastName
	});

	const [record] = await getDb()
		.select({ id: staff.id })
		.from(staff)
		.where(
			and(
				eq(staff.organizationId, organizationId),
				eq(staff.firstName, input.firstName),
				eq(staff.lastName, input.lastName)
			)
		)
		.orderBy(sql`${staff.createdAt} DESC`)
		.limit(1);

	if (!record) {
		throw new Error('Expected staff fixture to exist');
	}
	return record.id;
}

describe.sequential('phase 3 worker integration', () => {
	beforeEach(async () => {
		await cleanupTestRows();
	});

	afterAll(async () => {
		await cleanupTestRows();
	});

	it('lookup worker stores returned certifications including unknown provider labels', async () => {
		const fixture = await createOrganizationFixture();
		const staffId = await createStaffFixture(fixture.organizationId, {
			firstName: 'Jamie',
			middleName: 'A',
			lastName: 'Lee'
		});
		await setStaffRequirements(fixture.organizationId, staffId, ['BLS']);

		const form = new FormData();
		form.set('firstName', 'Jamie');
		form.set('middleName', 'A');
		form.set('lastName', 'Lee');
		form.set('email', `${createTag()}-unknown@example.test`);

		const response = await verifyActions.lookupByEmail({
			request: new Request('http://localhost', { method: 'POST', body: form }),
			params: { siteCode: fixture.siteCode }
		} as never);
		expect(response).toMatchObject({ success: true });

		const [submission] = await getDb()
			.select({ id: submissions.id, status: submissions.status })
			.from(submissions)
			.where(eq(submissions.organizationId, fixture.organizationId))
			.limit(1);
		expect(submission.status).toBe('pending');

		await runWorkerOnce({
			concurrency: 1,
			directBatchSize: 20,
			maxAttempts: 1,
			instanceId: 'itp3-lookup-success'
		});

		const [finalSubmission] = await getDb()
			.select({ status: submissions.status })
			.from(submissions)
			.where(eq(submissions.id, submission.id))
			.limit(1);
		expect(finalSubmission?.status).toBe('verified');

		const [lookupJob] = await getDb()
			.select({ status: verificationJobs.status })
			.from(verificationJobs)
			.where(eq(verificationJobs.submissionId, submission.id))
			.limit(1);
		expect(lookupJob?.status).toBe('verified');

		const rows = await getDb()
			.select({
				ecardCode: ecardEntries.ecardCode,
				providerCertLabel: ecardEntries.providerCertLabel,
				certificationTypeId: ecardEntries.certificationTypeId,
				status: ecardEntries.status
			})
			.from(ecardEntries)
			.where(eq(ecardEntries.submissionId, submission.id));
		expect(rows.length).toBeGreaterThanOrEqual(4);
		expect(rows.every((row) => row.status === 'verified')).toBe(true);
		const unknown = rows.find((row) => row.providerCertLabel === 'NRP');
		expect(unknown).toBeTruthy();
		expect(unknown?.certificationTypeId).toBeNull();
	});

	it('lookup worker marks terminal failure when zero certifications are found', async () => {
		const fixture = await createOrganizationFixture();
		const staffId = await createStaffFixture(fixture.organizationId, {
			firstName: 'Maya',
			middleName: null,
			lastName: 'Jones'
		});
		await setStaffRequirements(fixture.organizationId, staffId, ['BLS']);

		const form = new FormData();
		form.set('firstName', 'Maya');
		form.set('lastName', 'Jones');
		form.set('email', `${createTag()}-nocerts@example.test`);

		await verifyActions.lookupByEmail({
			request: new Request('http://localhost', { method: 'POST', body: form }),
			params: { siteCode: fixture.siteCode }
		} as never);

		await runWorkerOnce({
			concurrency: 1,
			directBatchSize: 20,
			maxAttempts: 1,
			instanceId: 'itp3-lookup-none'
		});

		const [job] = await getDb()
			.select({
				status: verificationJobs.status,
				errorCategory: verificationJobs.errorCategory
			})
			.from(verificationJobs)
			.where(eq(verificationJobs.jobType, 'lookup_name_email'))
			.limit(1);
		expect(job).toMatchObject({ status: 'failed', errorCategory: 'no_certs_found' });

		const [submission] = await getDb()
			.select({ status: submissions.status })
			.from(submissions)
			.where(eq(submissions.organizationId, fixture.organizationId))
			.limit(1);
		expect(submission?.status).toBe('failed');
	});

	it('lookup worker fails terminally on captcha with one attempt', async () => {
		const fixture = await createOrganizationFixture();
		const staffId = await createStaffFixture(fixture.organizationId, {
			firstName: 'Lena',
			middleName: null,
			lastName: 'Ward'
		});
		await setStaffRequirements(fixture.organizationId, staffId, ['BLS']);

		const form = new FormData();
		form.set('firstName', 'Lena');
		form.set('lastName', 'Ward');
		form.set('email', `${createTag()}-captcha@example.test`);

		await verifyActions.lookupByEmail({
			request: new Request('http://localhost', { method: 'POST', body: form }),
			params: { siteCode: fixture.siteCode }
		} as never);

		await runWorkerOnce({
			concurrency: 1,
			directBatchSize: 20,
			maxAttempts: 1,
			instanceId: 'itp3-lookup-captcha'
		});

		const [job] = await getDb()
			.select({
				status: verificationJobs.status,
				errorCategory: verificationJobs.errorCategory,
				attemptCount: verificationJobs.attemptCount
			})
			.from(verificationJobs)
			.where(eq(verificationJobs.jobType, 'lookup_name_email'))
			.limit(1);
		expect(job).toMatchObject({
			status: 'failed',
			errorCategory: 'captcha_detected',
			attemptCount: 1
		});
	});

	it('processes direct ecard jobs in batches greater than 20 across worker passes', async () => {
		const fixture = await createOrganizationFixture();
		const staffId = await createStaffFixture(fixture.organizationId, {
			firstName: 'Noah',
			middleName: null,
			lastName: 'Stone'
		});

		const [submission] = await getDb()
			.insert(submissions)
			.values({
				organizationId: fixture.organizationId,
				staffId,
				submittedFirstName: 'Noah',
				submittedLastName: 'Stone',
				submittedEmail: null,
				intakeMethod: 'ecard_direct',
				sourceSiteCode: fixture.siteCode,
				status: 'pending'
			})
			.returning({ id: submissions.id });

		const entryRows = await getDb()
			.insert(ecardEntries)
			.values(
				Array.from({ length: 25 }, (_, index) => ({
					submissionId: submission.id,
					certificationTypeId: null,
					ecardCode: `BLS-${index + 1}`,
					status: 'pending' as const
				}))
			)
			.returning({ id: ecardEntries.id });
		expect(entryRows).toHaveLength(25);

		await enqueueSubmissionJobs(submission.id);

		const preJobs = await getDb()
			.select({ id: verificationJobs.id, status: verificationJobs.status })
			.from(verificationJobs)
			.where(eq(verificationJobs.submissionId, submission.id));
		expect(preJobs).toHaveLength(25);
		expect(preJobs.every((row) => row.status === 'pending')).toBe(true);

		await runWorkerOnce({
			concurrency: 1,
			directBatchSize: 20,
			maxAttempts: 1,
			instanceId: 'itp3-direct-1'
		});

		const afterFirstPass = await getDb()
			.select({ status: verificationJobs.status })
			.from(verificationJobs)
			.where(eq(verificationJobs.submissionId, submission.id));
		expect(afterFirstPass.filter((row) => row.status === 'verified').length).toBeGreaterThan(0);
		expect(afterFirstPass.filter((row) => row.status === 'verified').length).toBeLessThan(25);
		expect(afterFirstPass.filter((row) => row.status === 'pending').length).toBeGreaterThan(0);

		for (let attempt = 0; attempt < 5; attempt += 1) {
			await runWorkerOnce({
				concurrency: 1,
				directBatchSize: 20,
				maxAttempts: 1,
				instanceId: `itp3-direct-drain-${attempt}`
			});

			const pendingCount = (
				await getDb()
					.select({ id: verificationJobs.id })
					.from(verificationJobs)
					.where(
						and(
							eq(verificationJobs.submissionId, submission.id),
							eq(verificationJobs.status, 'pending')
						)
					)
			).length;
			if (pendingCount === 0) {
				break;
			}
		}

		const finalJobs = await getDb()
			.select({ status: verificationJobs.status })
			.from(verificationJobs)
			.where(eq(verificationJobs.submissionId, submission.id));
		expect(finalJobs.every((row) => row.status === 'verified')).toBe(true);

		const [finalSubmission] = await getDb()
			.select({ status: submissions.status })
			.from(submissions)
			.where(eq(submissions.id, submission.id))
			.limit(1);
		expect(finalSubmission?.status).toBe('verified');
	});

	it('enqueues idempotent active jobs for direct submissions', async () => {
		const fixture = await createOrganizationFixture();
		const staffId = await createStaffFixture(fixture.organizationId, {
			firstName: 'Ari',
			middleName: null,
			lastName: 'Voss'
		});

		const [submission] = await getDb()
			.insert(submissions)
			.values({
				organizationId: fixture.organizationId,
				staffId,
				submittedFirstName: 'Ari',
				submittedLastName: 'Voss',
				submittedEmail: null,
				intakeMethod: 'ecard_direct',
				sourceSiteCode: fixture.siteCode,
				status: 'pending'
			})
			.returning({ id: submissions.id });

		await getDb()
			.insert(ecardEntries)
			.values([
				{
					submissionId: submission.id,
					certificationTypeId: null,
					ecardCode: 'BLS-ONE',
					status: 'pending'
				},
				{
					submissionId: submission.id,
					certificationTypeId: null,
					ecardCode: 'BLS-TWO',
					status: 'pending'
				}
			]);

		await enqueueSubmissionJobs(submission.id);
		await enqueueSubmissionJobs(submission.id);

		const jobs = await getDb()
			.select({ id: verificationJobs.id, status: verificationJobs.status })
			.from(verificationJobs)
			.where(eq(verificationJobs.submissionId, submission.id));
		expect(jobs).toHaveLength(2);
		expect(jobs.every((job) => job.status === 'pending')).toBe(true);
	});
});
