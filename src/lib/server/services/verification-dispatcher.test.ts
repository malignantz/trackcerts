import { describe, expect, it } from 'vitest';

import { chunkEntries, MAX_ECARD_BATCH_SIZE } from './verification-dispatcher';

describe('chunkEntries', () => {
	it('splits arrays into max 20-sized chunks', () => {
		const values = Array.from({ length: 45 }, (_, index) => index + 1);
		const chunks = chunkEntries(values, MAX_ECARD_BATCH_SIZE);

		expect(chunks).toHaveLength(3);
		expect(chunks[0]).toHaveLength(20);
		expect(chunks[1]).toHaveLength(20);
		expect(chunks[2]).toHaveLength(5);
	});
});
