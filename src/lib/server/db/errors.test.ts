import { describe, expect, it } from 'vitest';

import { isUniqueViolation } from './errors';

describe('isUniqueViolation', () => {
	it('returns true for postgres unique constraint errors', () => {
		expect(
			isUniqueViolation({
				code: '23505',
				constraint: 'organizations_slug_unique'
			})
		).toBe(true);
	});

	it('matches specific constraints when provided', () => {
		expect(
			isUniqueViolation(
				{
					code: '23505',
					constraint: 'certification_types_org_code_unique'
				},
				'certification_types_org_code_unique'
			)
		).toBe(true);
		expect(
			isUniqueViolation(
				{
					code: '23505',
					constraint: 'organizations_slug_unique'
				},
				'certification_types_org_code_unique'
			)
		).toBe(false);
	});

	it('returns false for non-unique errors', () => {
		expect(isUniqueViolation({ code: '23503' })).toBe(false);
		expect(isUniqueViolation(new Error('boom'))).toBe(false);
		expect(isUniqueViolation(null)).toBe(false);
	});
});
