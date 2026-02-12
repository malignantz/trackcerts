import { describe, expect, it } from 'vitest';

import { createStaffSchema } from './staff';

describe('createStaffSchema', () => {
	it('accepts valid names', () => {
		const parsed = createStaffSchema.safeParse({
			firstName: 'Ana-Maria',
			lastName: "O'Neil"
		});

		expect(parsed.success).toBe(true);
	});

	it('rejects numeric names', () => {
		const parsed = createStaffSchema.safeParse({
			firstName: 'John2',
			lastName: 'Smith'
		});

		expect(parsed.success).toBe(false);
	});
});
