import { describe, expect, it } from 'vitest';

import { deriveOrganizationSlug, normalizeOrganizationSlug } from './slug';

describe('organization slug utilities', () => {
	it('normalizes mixed case and symbols', () => {
		expect(normalizeOrganizationSlug(' Mercy General Hospital ')).toBe('mercy-general-hospital');
		expect(normalizeOrganizationSlug('A&B Health!!!')).toBe('a-b-health');
	});

	it('returns fallback for empty normalized names', () => {
		expect(deriveOrganizationSlug('***')).toBe('organization');
	});
});
