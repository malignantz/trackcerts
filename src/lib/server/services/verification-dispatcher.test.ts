import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueSubmissionJobsMock = vi.fn();

vi.mock('$lib/server/worker/repository', () => ({
	enqueueSubmissionJobs: enqueueSubmissionJobsMock
}));

describe('verificationDispatcher', () => {
	beforeEach(() => {
		enqueueSubmissionJobsMock.mockReset();
	});

	it('enqueues submission jobs via repository', async () => {
		const { verificationDispatcher } = await import('./verification-dispatcher');
		await verificationDispatcher.enqueueSubmission('sub-123');

		expect(enqueueSubmissionJobsMock).toHaveBeenCalledTimes(1);
		expect(enqueueSubmissionJobsMock).toHaveBeenCalledWith('sub-123');
	});
});
