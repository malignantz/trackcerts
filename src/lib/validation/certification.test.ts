import { describe, expect, it } from 'vitest';

import { createCertificationTypeSchema } from './certification';

describe('createCertificationTypeSchema', () => {
	it('normalizes uppercase code', () => {
		const parsed = createCertificationTypeSchema.parse({
			code: 'bls_core',
			label: 'Basic Life Support'
		});

		expect(parsed.code).toBe('BLS_CORE');
	});

	it('rejects invalid code characters', () => {
		const parsed = createCertificationTypeSchema.safeParse({
			code: 'bls-core',
			label: 'Basic Life Support'
		});

		expect(parsed.success).toBe(false);
	});
});
