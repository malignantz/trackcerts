import type { PoolClient, QueryResultRow } from 'pg';

import { getPool } from '$lib/server/db';

import { rollupSubmissionStatus } from './rollup';
import type {
	ClaimedVerificationJob,
	JobCompletionResult,
	ProviderLookupCert,
	VerificationJobType,
	VerifyBatchResult,
	WorkerErrorCategory
} from './types';

interface SubmissionRow extends QueryResultRow {
	id: string;
	intake_method: 'ecard_direct' | 'email_lookup';
}

interface ClaimedJobRow extends QueryResultRow {
	id: string;
	job_type: VerificationJobType;
	submission_id: string;
	ecard_entry_id: string | null;
	organization_id: string;
	source_site_code: string;
	submitted_first_name: string;
	submitted_last_name: string;
	submitted_email: string | null;
	ecard_code: string | null;
	queued_at: Date;
	attempt_count: number;
}

interface CertTypeRow extends QueryResultRow {
	id: string;
	code: string;
	label: string;
}

function normalizeToken(value: string | null | undefined): string {
	return (value ?? '')
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '');
}

function hydrateClaimedJob(row: ClaimedJobRow): ClaimedVerificationJob {
	return {
		id: row.id,
		jobType: row.job_type,
		submissionId: row.submission_id,
		ecardEntryId: row.ecard_entry_id,
		organizationId: row.organization_id,
		sourceSiteCode: row.source_site_code,
		submittedFirstName: row.submitted_first_name,
		submittedLastName: row.submitted_last_name,
		submittedEmail: row.submitted_email,
		ecardCode: row.ecard_code,
		queuedAt: new Date(row.queued_at),
		attemptCount: Number(row.attempt_count)
	};
}

async function loadClaimedJobs(
	client: PoolClient,
	jobIds: string[]
): Promise<ClaimedVerificationJob[]> {
	if (jobIds.length === 0) {
		return [];
	}

	const result = await client.query<ClaimedJobRow>(
		`SELECT
			j.id,
			j.job_type,
			j.submission_id,
			j.ecard_entry_id,
			j.queued_at,
			j.attempt_count,
			s.organization_id,
			s.source_site_code,
			s.submitted_first_name,
			s.submitted_last_name,
			s.submitted_email,
			e.ecard_code
		FROM verification_jobs j
		JOIN submissions s ON s.id = j.submission_id
		LEFT JOIN ecard_entries e ON e.id = j.ecard_entry_id
		WHERE j.id = ANY($1::uuid[])
		ORDER BY j.queued_at ASC, j.created_at ASC`,
		[jobIds]
	);

	return result.rows.map(hydrateClaimedJob);
}

async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
	const client = await getPool().connect();
	try {
		await client.query('BEGIN');
		const result = await callback(client);
		await client.query('COMMIT');
		return result;
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

export async function enqueueSubmissionJobs(submissionId: string): Promise<void> {
	await withTransaction(async (client) => {
		const submissionResult = await client.query<SubmissionRow>(
			`SELECT id, intake_method FROM submissions WHERE id = $1 LIMIT 1`,
			[submissionId]
		);
		const submission = submissionResult.rows[0];
		if (!submission) {
			return;
		}

		if (submission.intake_method === 'ecard_direct') {
			await client.query(
				`INSERT INTO verification_jobs
					(job_type, submission_id, ecard_entry_id, status, queued_at, created_at, updated_at)
				 SELECT
					'verify_ecard',
					e.submission_id,
					e.id,
					'pending',
					NOW(),
					NOW(),
					NOW()
				 FROM ecard_entries e
				 WHERE e.submission_id = $1
				 ON CONFLICT DO NOTHING`,
				[submissionId]
			);
			return;
		}

		await client.query(
			`INSERT INTO verification_jobs
				(job_type, submission_id, ecard_entry_id, status, queued_at, created_at, updated_at)
			 VALUES
				('lookup_name_email', $1, NULL, 'pending', NOW(), NOW(), NOW())
			 ON CONFLICT DO NOTHING`,
			[submissionId]
		);
	});
}

export async function claimOldestPendingJob(
	claimedBy: string,
	maxAttempts: number
): Promise<ClaimedVerificationJob | null> {
	return withTransaction(async (client) => {
		const claimed = await client.query<{ id: string }>(
			`WITH next_job AS (
				SELECT id
				FROM verification_jobs
				WHERE status = 'pending'
					AND attempt_count < $2
				ORDER BY queued_at ASC, created_at ASC
				FOR UPDATE SKIP LOCKED
				LIMIT 1
			)
			UPDATE verification_jobs j
			SET
				status = 'processing',
				attempt_count = j.attempt_count + 1,
				started_at = COALESCE(j.started_at, NOW()),
				updated_at = NOW(),
				claimed_by = $1,
				last_error = NULL,
				error_category = NULL
			FROM next_job
			WHERE j.id = next_job.id
			RETURNING j.id`,
			[claimedBy, maxAttempts]
		);
		if (!claimed.rows[0]) {
			return null;
		}

		const jobs = await loadClaimedJobs(client, [claimed.rows[0].id]);
		return jobs[0] ?? null;
	});
}

export async function claimAdditionalVerifyJobs(
	claimedBy: string,
	limit: number,
	maxAttempts: number
): Promise<ClaimedVerificationJob[]> {
	if (limit <= 0) {
		return [];
	}

	return withTransaction(async (client) => {
		const claimed = await client.query<{ id: string }>(
			`WITH next_jobs AS (
				SELECT id
				FROM verification_jobs
				WHERE status = 'pending' AND job_type = 'verify_ecard' AND attempt_count < $2
				ORDER BY queued_at ASC, created_at ASC
				FOR UPDATE SKIP LOCKED
				LIMIT $1
			)
			UPDATE verification_jobs j
			SET
				status = 'processing',
				attempt_count = j.attempt_count + 1,
				started_at = COALESCE(j.started_at, NOW()),
				updated_at = NOW(),
				claimed_by = $3,
				last_error = NULL,
				error_category = NULL
			FROM next_jobs
			WHERE j.id = next_jobs.id
			RETURNING j.id`,
			[limit, maxAttempts, claimedBy]
		);

		const jobIds = claimed.rows.map((row) => row.id);
		return loadClaimedJobs(client, jobIds);
	});
}

export async function markSubmissionsProcessing(submissionIds: string[]): Promise<void> {
	if (submissionIds.length === 0) {
		return;
	}

	await getPool().query(
		`UPDATE submissions
		 SET status = 'processing', updated_at = NOW()
		 WHERE id = ANY($1::uuid[])
			AND status = 'pending'`,
		[submissionIds]
	);
}

export async function completeVerifyJobs(results: VerifyBatchResult[]): Promise<void> {
	if (results.length === 0) {
		return;
	}

	await withTransaction(async (client) => {
		for (const result of results) {
			await client.query(
				`UPDATE verification_jobs
				 SET
					status = $2,
					last_error = $3,
					error_category = $4,
					finished_at = NOW(),
					updated_at = NOW()
				 WHERE id = $1`,
				[result.jobId, result.status, result.errorMessage ?? null, result.errorCategory ?? null]
			);

			await client.query(
				`UPDATE ecard_entries
				 SET
					status = $2,
					last_error = $3,
					updated_at = NOW()
				 WHERE id = $1`,
				[result.ecardEntryId, result.status, result.errorMessage ?? null]
			);
		}
	});
}

export async function completeLookupJobFailure(input: {
	jobId: string;
	submissionId: string;
	errorMessage: string;
	errorCategory: WorkerErrorCategory;
}): Promise<void> {
	await withTransaction(async (client) => {
		await client.query(
			`UPDATE verification_jobs
			 SET
				status = 'failed',
				last_error = $2,
				error_category = $3,
				finished_at = NOW(),
				updated_at = NOW()
			 WHERE id = $1`,
			[input.jobId, input.errorMessage, input.errorCategory]
		);

		await client.query(
			`UPDATE submissions
			 SET status = 'failed', updated_at = NOW()
			 WHERE id = $1`,
			[input.submissionId]
		);
	});
}

export async function completeLookupJobSuccess(input: {
	jobId: string;
	submissionId: string;
	organizationId: string;
	certs: ProviderLookupCert[];
}): Promise<void> {
	await withTransaction(async (client) => {
		const certTypesResult = await client.query<CertTypeRow>(
			`SELECT id, code, label
			 FROM certification_types
			 WHERE organization_id = $1`,
			[input.organizationId]
		);
		const certTypeIdByCode = new Map<string, string>();
		const certTypeIdByLabel = new Map<string, string>();
		for (const certType of certTypesResult.rows) {
			certTypeIdByCode.set(normalizeToken(certType.code), certType.id);
			certTypeIdByLabel.set(normalizeToken(certType.label), certType.id);
		}

		const existingRows = await client.query<{
			ecard_code: string;
			provider_cert_label: string | null;
		}>(
			`SELECT ecard_code, provider_cert_label
			 FROM ecard_entries
			 WHERE submission_id = $1`,
			[input.submissionId]
		);
		const existingKeys = new Set(
			existingRows.rows.map(
				(row) => `${normalizeToken(row.ecard_code)}::${normalizeToken(row.provider_cert_label)}`
			)
		);

		for (const cert of input.certs) {
			const normalizedCode = normalizeToken(cert.certCode);
			const normalizedLabel = normalizeToken(cert.providerCertLabel);
			const dedupeKey = `${normalizeToken(cert.ecardCode)}::${normalizedLabel}`;
			if (existingKeys.has(dedupeKey)) {
				continue;
			}
			existingKeys.add(dedupeKey);

			const certificationTypeId =
				certTypeIdByCode.get(normalizedCode) ?? certTypeIdByLabel.get(normalizedLabel) ?? null;

			await client.query(
				`INSERT INTO ecard_entries
					(submission_id, certification_type_id, ecard_code, provider_cert_label, status, last_error, created_at, updated_at)
				 VALUES
					($1, $2, $3, $4, 'verified', NULL, NOW(), NOW())`,
				[input.submissionId, certificationTypeId, cert.ecardCode, cert.providerCertLabel]
			);
		}

		await client.query(
			`UPDATE verification_jobs
			 SET
				status = 'verified',
				last_error = NULL,
				error_category = NULL,
				finished_at = NOW(),
				updated_at = NOW()
			 WHERE id = $1`,
			[input.jobId]
		);

		await client.query(
			`UPDATE submissions
			 SET status = 'verified', updated_at = NOW()
			 WHERE id = $1`,
			[input.submissionId]
		);
	});
}

export async function rollupDirectSubmissionStatuses(submissionIds: string[]): Promise<void> {
	if (submissionIds.length === 0) {
		return;
	}

	await withTransaction(async (client) => {
		const rows = await client.query<{
			submission_id: string;
			status: 'pending' | 'processing' | 'verified' | 'failed';
		}>(
			`SELECT submission_id, status
			 FROM ecard_entries
			 WHERE submission_id = ANY($1::uuid[])
			 ORDER BY submission_id`,
			[submissionIds]
		);

		const statusesBySubmission = new Map<
			string,
			Array<'pending' | 'processing' | 'verified' | 'failed'>
		>();
		for (const row of rows.rows) {
			const statuses = statusesBySubmission.get(row.submission_id) ?? [];
			statuses.push(row.status);
			statusesBySubmission.set(row.submission_id, statuses);
		}

		for (const submissionId of submissionIds) {
			const statuses = statusesBySubmission.get(submissionId) ?? [];
			const nextStatus = rollupSubmissionStatus({ statuses });
			await client.query(`UPDATE submissions SET status = $2, updated_at = NOW() WHERE id = $1`, [
				submissionId,
				nextStatus
			]);
		}
	});
}

export async function completeJobsAsFailed(results: JobCompletionResult[]): Promise<void> {
	if (results.length === 0) {
		return;
	}

	await withTransaction(async (client) => {
		for (const result of results) {
			await client.query(
				`UPDATE verification_jobs
				 SET
					status = 'failed',
					last_error = $2,
					error_category = $3,
					finished_at = NOW(),
					updated_at = NOW()
				 WHERE id = $1`,
				[result.jobId, result.errorMessage ?? null, result.errorCategory ?? 'provider_error']
			);
		}
	});
}
