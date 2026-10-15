import type { JobStatus } from '$lib/types';

export interface EntryStatusRollupInput {
	statuses: JobStatus[];
}

export function rollupSubmissionStatus(input: EntryStatusRollupInput): JobStatus {
	if (input.statuses.some((status) => status === 'failed')) {
		return 'failed';
	}

	if (input.statuses.length > 0 && input.statuses.every((status) => status === 'verified')) {
		return 'verified';
	}

	if (input.statuses.some((status) => status === 'processing')) {
		return 'processing';
	}

	return 'pending';
}
