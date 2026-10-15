import { enqueueSubmissionJobs } from '$lib/server/worker/repository';

export interface VerificationDispatcher {
	enqueueSubmission(submissionId: string): Promise<void>;
}

class QueueingVerificationDispatcher implements VerificationDispatcher {
	async enqueueSubmission(submissionId: string): Promise<void> {
		await enqueueSubmissionJobs(submissionId);
	}
}

export const verificationDispatcher: VerificationDispatcher = new QueueingVerificationDispatcher();
