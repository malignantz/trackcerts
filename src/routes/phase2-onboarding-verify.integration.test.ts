import { randomUUID } from 'node:crypto';

import { and, eq, ilike, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { getDb } from '$lib/server/db';
import {
	certificationTypes,
	documents,
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
import { createStaffRecord, listStaff } from '$lib/server/staff/repository';
import { setStaffRequirements } from '$lib/server/staff/requirements';

import { actions as onboardingActions } from './(app)/app/onboarding/staff/+page.server';
import { actions as verifyActions } from './verify/[siteCode]/+page.server';

const TEST_PREFIX = 'itp2-';

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
		throw new Error(`Expected organization fixture ${tag} to exist`);
	}

	return {
		organizationId: record.id,
		siteCode: record.siteCode
	};
}

describe.sequential('phase 2 onboarding and verify integration', () => {
	beforeEach(async () => {
		await cleanupTestRows();
	});

	afterAll(async () => {
		await cleanupTestRows();
	});

	it('preview action returns prefilled rows for TSV with header labels', async () => {
		const fixture = await createOrganizationFixture();
		const formData = new FormData();
		formData.set('rawText', 'First Name\tLast Name\nKathy\tJohnson\nJames\tJackson');
		formData.append('requiredCerts', 'BLS');

		const result = await onboardingActions.importPreview({
			request: new Request('http://localhost', { method: 'POST', body: formData }),
			locals: {
				membership: {
					organizationId: fixture.organizationId
				}
			}
		} as never);

		expect(result).toMatchObject({
			action: 'importPreview',
			success: true
		});
		expect((result as { detectedSourceType: string }).detectedSourceType).toBe('table_tsv');
		expect((result as { pendingPatternDecisions: unknown[] }).pendingPatternDecisions).toHaveLength(
			0
		);
		const previewRows = (result as { previewRows: Array<Record<string, unknown>> }).previewRows;
		expect(previewRows).toHaveLength(2);
		expect(previewRows[0]).toMatchObject({
			firstName: 'Kathy',
			lastName: 'Johnson'
		});
		expect(previewRows[1]).toMatchObject({
			firstName: 'James',
			lastName: 'Jackson'
		});
	});

	it('preview action returns a pending name-order decision for ambiguous TSV and resolves after re-submit', async () => {
		const fixture = await createOrganizationFixture();
		const initialForm = new FormData();
		initialForm.set('rawText', 'James\tJackson\nAmy\tChen');
		initialForm.append('requiredCerts', 'BLS');

		const firstResult = await onboardingActions.importPreview({
			request: new Request('http://localhost', { method: 'POST', body: initialForm }),
			locals: {
				membership: {
					organizationId: fixture.organizationId
				}
			}
		} as never);

		const pending = (
			firstResult as {
				pendingPatternDecisions: Array<{ patternId: string }>;
			}
		).pendingPatternDecisions;
		expect(pending).toHaveLength(1);

		const secondForm = new FormData();
		secondForm.set('rawText', 'James\tJackson\nAmy\tChen');
		secondForm.append('requiredCerts', 'BLS');
		secondForm.set(`patternDecision.${pending[0]!.patternId}`, 'first_last');

		const secondResult = await onboardingActions.importPreview({
			request: new Request('http://localhost', { method: 'POST', body: secondForm }),
			locals: {
				membership: {
					organizationId: fixture.organizationId
				}
			}
		} as never);

		expect(
			(secondResult as { pendingPatternDecisions: unknown[] }).pendingPatternDecisions
		).toHaveLength(0);
		const resolvedRows = (secondResult as { previewRows: Array<Record<string, unknown>> })
			.previewRows;
		expect(resolvedRows).toHaveLength(2);
		expect(resolvedRows[0]).toMatchObject({
			firstName: 'James',
			lastName: 'Jackson'
		});
		expect(resolvedRows[1]).toMatchObject({
			firstName: 'Amy',
			lastName: 'Chen'
		});
	});

	it('preview action requests all detected name-order patterns for mixed TSV input', async () => {
		const fixture = await createOrganizationFixture();
		const initialForm = new FormData();
		initialForm.set('rawText', 'James\tJackson\nMary Ann\tChen\nLopez, Maria');
		initialForm.append('requiredCerts', 'BLS');

		const firstResult = await onboardingActions.importPreview({
			request: new Request('http://localhost', { method: 'POST', body: initialForm }),
			locals: {
				membership: {
					organizationId: fixture.organizationId
				}
			}
		} as never);

		const pending = (
			firstResult as {
				pendingPatternDecisions: Array<{ patternId: string }>;
			}
		).pendingPatternDecisions;
		expect(pending).toHaveLength(2);

		const secondForm = new FormData();
		secondForm.set('rawText', 'James\tJackson\nMary Ann\tChen\nLopez, Maria');
		secondForm.append('requiredCerts', 'BLS');
		for (const pattern of pending) {
			secondForm.set(`patternDecision.${pattern.patternId}`, 'first_last');
		}

		const secondResult = await onboardingActions.importPreview({
			request: new Request('http://localhost', { method: 'POST', body: secondForm }),
			locals: {
				membership: {
					organizationId: fixture.organizationId
				}
			}
		} as never);

		expect(
			(secondResult as { pendingPatternDecisions: unknown[] }).pendingPatternDecisions
		).toHaveLength(0);
		const resolvedRows = (secondResult as { previewRows: Array<Record<string, unknown>> })
			.previewRows;
		expect(resolvedRows).toHaveLength(3);
		expect(resolvedRows[0]).toMatchObject({
			firstName: 'James',
			lastName: 'Jackson'
		});
		expect(resolvedRows[1]).toMatchObject({
			firstName: 'Mary Ann',
			lastName: 'Chen'
		});
		expect(resolvedRows[2]).toMatchObject({
			firstName: 'Maria',
			lastName: 'Lopez'
		});
	});

	it('clearStaffTesting action deletes all staff rows for the organization in non-production', async () => {
		const fixture = await createOrganizationFixture();
		await createStaffRecord(fixture.organizationId, {
			firstName: 'Nora',
			middleName: null,
			lastName: 'Diaz'
		});
		await createStaffRecord(fixture.organizationId, {
			firstName: 'James',
			middleName: 'A',
			lastName: 'Jackson'
		});

		const before = await listStaff({ organizationId: fixture.organizationId });
		expect(before).toHaveLength(2);

		const result = await onboardingActions.clearStaffTesting({
			request: new Request('http://localhost', { method: 'POST' }),
			locals: {
				membership: {
					organizationId: fixture.organizationId
				}
			}
		} as never);

		expect(result).toMatchObject({
			action: 'clearStaffTesting',
			success: true,
			clearedCount: 2
		});

		const after = await listStaff({ organizationId: fixture.organizationId });
		expect(after).toHaveLength(0);
	});

	it('commit action writes selected rows and requirements', async () => {
		const fixture = await createOrganizationFixture();
		const formData = new FormData();
		formData.set('rows.r0.include', 'on');
		formData.set('rows.r0.firstName', 'Nora');
		formData.set('rows.r0.middleName', 'L');
		formData.set('rows.r0.lastName', 'Diaz');
		formData.append('rows.r0.certs', 'BLS');
		formData.append('rows.r0.certs', 'ACLS');

		await expect(
			onboardingActions.importCommit({
				request: new Request('http://localhost', { method: 'POST', body: formData }),
				locals: {
					membership: {
						organizationId: fixture.organizationId
					}
				}
			} as never)
		).rejects.toMatchObject({ status: 303, location: '/app/staff' });

		const db = getDb();
		const [staffRow] = await db
			.select({
				id: staff.id,
				firstName: staff.firstName,
				middleName: staff.middleName,
				lastName: staff.lastName
			})
			.from(staff)
			.where(eq(staff.organizationId, fixture.organizationId))
			.limit(1);

		expect(staffRow).toMatchObject({
			firstName: 'Nora',
			middleName: 'L',
			lastName: 'Diaz'
		});

		const requirementRows = await db
			.select({ certCode: staffCertificationRequirements.certCode })
			.from(staffCertificationRequirements)
			.where(eq(staffCertificationRequirements.organizationId, fixture.organizationId));
		expect(requirementRows.map((row) => row.certCode).sort()).toEqual(['ACLS', 'BLS']);
	});

	it('commit action enforces unique middle values for confirmed duplicate names', async () => {
		const fixture = await createOrganizationFixture();
		const duplicateKey = encodeURIComponent('john|smith');

		const formData = new FormData();
		formData.set('rows.r0.include', 'on');
		formData.set('rows.r0.firstName', 'John');
		formData.set('rows.r0.middleName', '');
		formData.set('rows.r0.lastName', 'Smith');
		formData.append('rows.r0.certs', 'BLS');

		formData.set('rows.r1.include', 'on');
		formData.set('rows.r1.firstName', 'John');
		formData.set('rows.r1.middleName', '');
		formData.set('rows.r1.lastName', 'Smith');
		formData.append('rows.r1.certs', 'BLS');

		formData.set(`duplicateDecision.${duplicateKey}`, 'yes');

		const result = await onboardingActions.importCommit({
			request: new Request('http://localhost', { method: 'POST', body: formData }),
			locals: {
				membership: {
					organizationId: fixture.organizationId
				}
			}
		} as never);

		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'importCommit'
			}
		});
		expect((result as { data: { error: string } }).data.error).toContain(
			'requires middle initial/name'
		);
	});

	it('verify submitEcard creates queued records for required certs', async () => {
		const fixture = await createOrganizationFixture();
		await createStaffRecord(fixture.organizationId, {
			firstName: 'Ari',
			middleName: null,
			lastName: 'Stone'
		});

		const db = getDb();
		const [person] = await db
			.select({ id: staff.id })
			.from(staff)
			.where(eq(staff.organizationId, fixture.organizationId))
			.limit(1);
		if (!person) {
			throw new Error('Expected staff fixture');
		}
		await setStaffRequirements(fixture.organizationId, person.id, ['BLS', 'PALS']);

		const formData = new FormData();
		formData.set('firstName', 'Ari');
		formData.set('lastName', 'Stone');
		formData.set('ecardBLS', 'BLS-1234');
		formData.set('ecardPALS', 'PALS-8888');

		const result = await verifyActions.submitEcard({
			request: new Request('http://localhost', { method: 'POST', body: formData }),
			params: { siteCode: fixture.siteCode }
		} as never);

		expect(result).toMatchObject({
			action: 'submitEcard',
			success: true
		});

		const [submission] = await db
			.select({
				id: submissions.id,
				intakeMethod: submissions.intakeMethod,
				sourceSiteCode: submissions.sourceSiteCode
			})
			.from(submissions)
			.where(eq(submissions.organizationId, fixture.organizationId))
			.limit(1);
		expect(submission).toMatchObject({
			intakeMethod: 'ecard_direct',
			sourceSiteCode: fixture.siteCode
		});

		const entryRows = await db
			.select({ status: ecardEntries.status })
			.from(ecardEntries)
			.where(eq(ecardEntries.submissionId, submission.id));
		expect(entryRows).toHaveLength(2);
		expect(entryRows.every((row) => row.status === 'verified')).toBe(true);
	});

	it('verify lookupByEmail stores email and rejects ambiguous duplicate names without middle', async () => {
		const fixture = await createOrganizationFixture();
		await createStaffRecord(fixture.organizationId, {
			firstName: 'Jamie',
			middleName: 'A',
			lastName: 'Lee'
		});
		await createStaffRecord(fixture.organizationId, {
			firstName: 'Jamie',
			middleName: 'B',
			lastName: 'Lee'
		});

		const ambiguousForm = new FormData();
		ambiguousForm.set('firstName', 'Jamie');
		ambiguousForm.set('lastName', 'Lee');
		ambiguousForm.set('email', 'jamie@example.test');

		const ambiguous = await verifyActions.lookupByEmail({
			request: new Request('http://localhost', { method: 'POST', body: ambiguousForm }),
			params: { siteCode: fixture.siteCode }
		} as never);
		expect(ambiguous).toMatchObject({
			status: 404
		});

		const disambiguatedForm = new FormData();
		disambiguatedForm.set('firstName', 'Jamie');
		disambiguatedForm.set('middleName', 'A');
		disambiguatedForm.set('lastName', 'Lee');
		disambiguatedForm.set('email', 'jamie@example.test');

		const [targetStaff] = await getDb()
			.select({ id: staff.id })
			.from(staff)
			.where(
				and(
					eq(staff.organizationId, fixture.organizationId),
					eq(staff.firstName, 'Jamie'),
					eq(staff.middleName, 'A'),
					eq(staff.lastName, 'Lee')
				)
			)
			.limit(1);
		if (!targetStaff) {
			throw new Error('Expected staff row for lookup test');
		}
		await setStaffRequirements(fixture.organizationId, targetStaff.id, ['BLS']);

		const success = await verifyActions.lookupByEmail({
			request: new Request('http://localhost', { method: 'POST', body: disambiguatedForm }),
			params: { siteCode: fixture.siteCode }
		} as never);

		expect(success).toMatchObject({
			action: 'lookupByEmail',
			success: true
		});

		const [submission] = await getDb()
			.select({
				submittedEmail: submissions.submittedEmail,
				intakeMethod: submissions.intakeMethod
			})
			.from(submissions)
			.where(eq(submissions.organizationId, fixture.organizationId))
			.orderBy(submissions.createdAt)
			.limit(1);
		expect(submission).toMatchObject({
			submittedEmail: 'jamie@example.test',
			intakeMethod: 'email_lookup'
		});
	});
});
