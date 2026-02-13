import { describe, expect, it } from 'vitest';

import { parseCommitRows } from './import-commit';

function makeFormData(entries: Array<[string, string]>) {
	const formData = new FormData();
	for (const [key, value] of entries) {
		formData.append(key, value);
	}
	return formData;
}

describe('parseCommitRows', () => {
	it('keeps deterministic row order and parses selected rows', () => {
		const formData = makeFormData([
			['rows.r2.include', 'on'],
			['rows.r2.firstName', 'Sam'],
			['rows.r2.middleName', 'J'],
			['rows.r2.lastName', 'Hill'],
			['rows.r2.certs', 'BLS'],
			['rows.r1.include', 'on'],
			['rows.r1.firstName', 'Alex'],
			['rows.r1.middleName', ''],
			['rows.r1.lastName', 'King'],
			['rows.r1.certs', 'ACLS']
		]);

		const parsed = parseCommitRows(formData);
		expect(parsed.invalidIncludedIndexes).toEqual([]);
		expect(parsed.rows).toEqual([
			{
				firstName: 'Sam',
				middleName: 'J',
				lastName: 'Hill',
				requiredCertCodes: ['BLS']
			},
			{
				firstName: 'Alex',
				middleName: '',
				lastName: 'King',
				requiredCertCodes: ['ACLS']
			}
		]);
	});

	it('returns invalid indexes for selected rows with missing first/last names', () => {
		const formData = makeFormData([
			['rows.r1.include', 'on'],
			['rows.r1.firstName', ''],
			['rows.r1.lastName', ''],
			['rows.r1.certs', 'BLS']
		]);

		const parsed = parseCommitRows(formData);
		expect(parsed.rows).toEqual([]);
		expect(parsed.invalidIncludedIndexes).toEqual([1]);
	});
});
