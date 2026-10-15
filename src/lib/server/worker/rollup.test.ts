import { describe, expect, it } from 'vitest';

import { rollupSubmissionStatus } from './rollup';

describe('rollupSubmissionStatus', () => {
	it('returns failed if any entry failed', () => {
		expect(rollupSubmissionStatus({ statuses: ['verified', 'failed'] })).toBe('failed');
	});

	it('returns verified when all entries are verified', () => {
		expect(rollupSubmissionStatus({ statuses: ['verified', 'verified'] })).toBe('verified');
	});

	it('returns processing when active work exists', () => {
		expect(rollupSubmissionStatus({ statuses: ['verified', 'processing'] })).toBe('processing');
	});

	it('returns pending otherwise', () => {
		expect(rollupSubmissionStatus({ statuses: ['pending', 'verified'] })).toBe('pending');
		expect(rollupSubmissionStatus({ statuses: [] })).toBe('pending');
	});
});
