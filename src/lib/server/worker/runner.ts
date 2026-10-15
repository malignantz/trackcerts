import { randomUUID } from 'node:crypto';

import { getServerEnv } from '$lib/server/env';
import { ecardProviderClient, ProviderAutomationError } from '$lib/server/services/ecard-provider';

import {
	claimAdditionalVerifyJobs,
	claimOldestPendingJob,
	completeJobsAsFailed,
	completeLookupJobFailure,
	completeLookupJobSuccess,
	completeVerifyJobs,
	markSubmissionsProcessing,
	rollupDirectSubmissionStatuses
} from './repository';
import type {
	ClaimedVerificationJob,
	JobCompletionResult,
	VerifyBatchInput,
	VerifyBatchResult,
	WorkerErrorCategory
} from './types';

export interface WorkerConfig {
	concurrency: number;
	pollIntervalMs: number;
	directBatchSize: number;
	maxAttempts: number;
	instanceId: string;
}

export interface WorkerRunStats {
	claimed: number;
	lookupProcessed: number;
	verifyProcessed: number;
	verified: number;
	failed: number;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function getDefaultConfig(): WorkerConfig {
	const env = getServerEnv();
	return {
		concurrency: env.WORKER_CONCURRENCY,
		pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
		directBatchSize: env.WORKER_DIRECT_BATCH_SIZE,
		maxAttempts: env.WORKER_MAX_ATTEMPTS,
		instanceId: `worker-${process.pid}-${randomUUID().slice(0, 8)}`
	};
}

function logWorkerEvent(event: string, details: Record<string, unknown>): void {
	console.warn(
		JSON.stringify({
			timestamp: new Date().toISOString(),
			event,
			...details
		})
	);
}

function classifyUnexpectedError(error: unknown): WorkerErrorCategory {
	const message =
		error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
	if (message.includes('timeout')) {
		return 'timeout_error';
	}
	if (
		message.includes('network') ||
		message.includes('socket') ||
		message.includes('econn') ||
		message.includes('enotfound')
	) {
		return 'network_error';
	}
	return 'provider_error';
}

function summarize(results: VerifyBatchResult[]): Pick<WorkerRunStats, 'verified' | 'failed'> {
	return {
		verified: results.filter((result) => result.status === 'verified').length,
		failed: results.filter((result) => result.status === 'failed').length
	};
}

async function processLookupJob(job: ClaimedVerificationJob): Promise<WorkerRunStats> {
	if (!job.submittedEmail) {
		await completeLookupJobFailure({
			jobId: job.id,
			submissionId: job.submissionId,
			errorMessage: 'Submission email is required for lookup jobs',
			errorCategory: 'validation_error'
		});
		return {
			claimed: 1,
			lookupProcessed: 1,
			verifyProcessed: 0,
			verified: 0,
			failed: 1
		};
	}

	await markSubmissionsProcessing([job.submissionId]);

	try {
		const result = await ecardProviderClient.lookupStudentByNameEmail({
			siteCode: job.sourceSiteCode,
			firstName: job.submittedFirstName,
			lastName: job.submittedLastName,
			email: job.submittedEmail
		});

		if (result.certs.length === 0) {
			await completeLookupJobFailure({
				jobId: job.id,
				submissionId: job.submissionId,
				errorMessage: 'Provider lookup returned zero certifications',
				errorCategory: 'no_certs_found'
			});
			return {
				claimed: 1,
				lookupProcessed: 1,
				verifyProcessed: 0,
				verified: 0,
				failed: 1
			};
		}

		await completeLookupJobSuccess({
			jobId: job.id,
			submissionId: job.submissionId,
			organizationId: job.organizationId,
			certs: result.certs
		});

		return {
			claimed: 1,
			lookupProcessed: 1,
			verifyProcessed: 0,
			verified: 1,
			failed: 0
		};
	} catch (error) {
		const category =
			error instanceof ProviderAutomationError ? error.category : classifyUnexpectedError(error);
		await completeLookupJobFailure({
			jobId: job.id,
			submissionId: job.submissionId,
			errorMessage: error instanceof Error ? error.message : String(error),
			errorCategory: category
		});
		return {
			claimed: 1,
			lookupProcessed: 1,
			verifyProcessed: 0,
			verified: 0,
			failed: 1
		};
	}
}

function makeTerminalFailure(job: ClaimedVerificationJob, message: string): JobCompletionResult {
	return {
		jobId: job.id,
		status: 'failed',
		errorMessage: message,
		errorCategory: 'validation_error'
	};
}

async function processVerifyBatch(
	firstJob: ClaimedVerificationJob,
	config: WorkerConfig
): Promise<WorkerRunStats> {
	const additional = await claimAdditionalVerifyJobs(
		config.instanceId,
		Math.max(0, config.directBatchSize - 1),
		config.maxAttempts
	);
	const claimedJobs = [firstJob, ...additional];
	const submissionIds = Array.from(new Set(claimedJobs.map((job) => job.submissionId)));
	await markSubmissionsProcessing(submissionIds);

	const readyInputs: VerifyBatchInput[] = [];
	const invalidJobs: JobCompletionResult[] = [];
	for (const job of claimedJobs) {
		if (!job.ecardEntryId || !job.ecardCode) {
			invalidJobs.push(makeTerminalFailure(job, 'Missing eCard reference for verify_ecard job'));
			continue;
		}
		readyInputs.push({
			jobId: job.id,
			ecardEntryId: job.ecardEntryId,
			ecardCode: job.ecardCode
		});
	}

	if (invalidJobs.length > 0) {
		await completeJobsAsFailed(invalidJobs);
	}

	if (readyInputs.length === 0) {
		await rollupDirectSubmissionStatuses(submissionIds);
		return {
			claimed: claimedJobs.length,
			lookupProcessed: 0,
			verifyProcessed: claimedJobs.length,
			verified: 0,
			failed: claimedJobs.length
		};
	}

	let results: VerifyBatchResult[];
	try {
		results = await ecardProviderClient.verifyEmployerBatch(readyInputs);
	} catch (error) {
		const category = classifyUnexpectedError(error);
		results = readyInputs.map((input) => ({
			jobId: input.jobId,
			ecardEntryId: input.ecardEntryId,
			status: 'failed',
			errorMessage: error instanceof Error ? error.message : String(error),
			errorCategory: category
		}));
	}

	const resultByJobId = new Map(results.map((result) => [result.jobId, result]));
	for (const input of readyInputs) {
		if (resultByJobId.has(input.jobId)) {
			continue;
		}
		results.push({
			jobId: input.jobId,
			ecardEntryId: input.ecardEntryId,
			status: 'failed',
			errorMessage: 'Provider omitted result for claimed job',
			errorCategory: 'provider_error'
		});
	}

	await completeVerifyJobs(results);
	await rollupDirectSubmissionStatuses(submissionIds);

	const summary = summarize(results);
	return {
		claimed: claimedJobs.length,
		lookupProcessed: 0,
		verifyProcessed: claimedJobs.length,
		verified: summary.verified,
		failed: summary.failed + invalidJobs.length
	};
}

async function processNextJob(config: WorkerConfig): Promise<WorkerRunStats> {
	const claimed = await claimOldestPendingJob(config.instanceId, config.maxAttempts);
	if (!claimed) {
		return {
			claimed: 0,
			lookupProcessed: 0,
			verifyProcessed: 0,
			verified: 0,
			failed: 0
		};
	}

	if (claimed.jobType === 'lookup_name_email') {
		return processLookupJob(claimed);
	}

	return processVerifyBatch(claimed, config);
}

function mergeStats(items: WorkerRunStats[]): WorkerRunStats {
	return items.reduce<WorkerRunStats>(
		(acc, item) => ({
			claimed: acc.claimed + item.claimed,
			lookupProcessed: acc.lookupProcessed + item.lookupProcessed,
			verifyProcessed: acc.verifyProcessed + item.verifyProcessed,
			verified: acc.verified + item.verified,
			failed: acc.failed + item.failed
		}),
		{ claimed: 0, lookupProcessed: 0, verifyProcessed: 0, verified: 0, failed: 0 }
	);
}

export async function runWorkerOnce(
	overrides: Partial<WorkerConfig> = {}
): Promise<WorkerRunStats> {
	const config = {
		...getDefaultConfig(),
		...overrides
	};

	const workers = Array.from({ length: config.concurrency }, async () => processNextJob(config));
	const results = await Promise.all(workers);
	const stats = mergeStats(results);
	logWorkerEvent('worker_once_complete', {
		instanceId: config.instanceId,
		claimed: stats.claimed,
		lookupProcessed: stats.lookupProcessed,
		verifyProcessed: stats.verifyProcessed,
		verified: stats.verified,
		failed: stats.failed,
		maxAttempts: config.maxAttempts
	});
	return stats;
}

export async function runWorkerLoop(overrides: Partial<WorkerConfig> = {}): Promise<void> {
	const config = {
		...getDefaultConfig(),
		...overrides
	};

	logWorkerEvent('worker_loop_started', {
		instanceId: config.instanceId,
		concurrency: config.concurrency,
		pollIntervalMs: config.pollIntervalMs,
		directBatchSize: config.directBatchSize,
		maxAttempts: config.maxAttempts
	});

	for (;;) {
		const stats = await runWorkerOnce(config);
		if (stats.claimed === 0) {
			await sleep(config.pollIntervalMs);
		}
	}
}
