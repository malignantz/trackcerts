import { getDb, ecardEntries, submissions } from '$lib/server/db';
import { ensureFixedCertificationTypes } from '$lib/server/org/certification-types';
import type { CertificationCode } from '$lib/types';

interface EcardCodeInput {
	certCode: CertificationCode;
	ecardCode: string;
}

interface CreateSubmissionInput {
	organizationId: string;
	staffId: string;
	submittedFirstName: string;
	submittedLastName: string;
	submittedEmail?: string | null;
	intakeMethod: 'ecard_direct' | 'email_lookup';
	sourceSiteCode: string;
	ecardCodes: EcardCodeInput[];
}

export async function createSubmissionWithEcards(input: CreateSubmissionInput): Promise<string> {
	const db = getDb();
	const certTypeMap = await ensureFixedCertificationTypes(input.organizationId);

	const [submission] = await db
		.insert(submissions)
		.values({
			organizationId: input.organizationId,
			staffId: input.staffId,
			submittedFirstName: input.submittedFirstName,
			submittedLastName: input.submittedLastName,
			submittedEmail: input.submittedEmail ?? null,
			intakeMethod: input.intakeMethod,
			sourceSiteCode: input.sourceSiteCode,
			status: 'pending'
		})
		.returning({ id: submissions.id });

	if (input.ecardCodes.length > 0) {
		await db.insert(ecardEntries).values(
			input.ecardCodes.map((item) => ({
				submissionId: submission.id,
				certificationTypeId: certTypeMap[item.certCode] || null,
				ecardCode: item.ecardCode,
				status: 'pending' as const
			}))
		);
	}

	return submission.id;
}
