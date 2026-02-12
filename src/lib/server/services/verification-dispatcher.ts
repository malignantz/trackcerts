export interface VerificationDispatcher {
	enqueueSubmission(submissionId: string): Promise<void>;
}

class NoopVerificationDispatcher implements VerificationDispatcher {
	async enqueueSubmission(submissionId: string): Promise<void> {
		console.warn('NoopVerificationDispatcher.enqueueSubmission called', { submissionId });
	}
}

export const verificationDispatcher: VerificationDispatcher = new NoopVerificationDispatcher();
