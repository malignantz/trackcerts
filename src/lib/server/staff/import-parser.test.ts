import { describe, expect, it } from 'vitest';

import { parseStaffImport } from './import-parser';

describe('parseStaffImport', () => {
	it('keeps list-text parsing behavior and deduplicates exact duplicate names', () => {
		const preview = parseStaffImport({
			rawText: 'Kathy Johnson\tKathy Johnson\nLopez, Maria',
			requiredCertCodes: ['BLS'],
			existingStaff: []
		});

		expect(preview.detectedSourceType).toBe('list_text');
		expect(preview.pendingPatternDecisions).toHaveLength(0);
		expect(preview.unresolved).toHaveLength(0);
		expect(preview.resolved).toHaveLength(2);
		expect(preview.resolved[0]).toMatchObject({
			firstName: 'Kathy',
			lastName: 'Johnson'
		});
		expect(preview.resolved[1]).toMatchObject({
			firstName: 'Maria',
			lastName: 'Lopez'
		});
	});

	it('parses TSV with First/Last header and skips the header row', () => {
		const preview = parseStaffImport({
			rawText: 'First Name\tLast Name\nJames\tJackson\nAmy\tChen',
			requiredCertCodes: ['BLS'],
			existingStaff: []
		});

		expect(preview.detectedSourceType).toBe('table_tsv');
		expect(preview.pendingPatternDecisions).toHaveLength(0);
		expect(preview.unresolved).toHaveLength(0);
		expect(preview.resolved.map((row) => `${row.firstName} ${row.lastName}`)).toEqual([
			'James Jackson',
			'Amy Chen'
		]);
	});

	it('parses TSV with reversed Last/First headers by label mapping', () => {
		const preview = parseStaffImport({
			rawText: 'Last Name\tFirst Name\nJackson\tJames\nChen\tAmy',
			requiredCertCodes: ['BLS'],
			existingStaff: []
		});

		expect(preview.detectedSourceType).toBe('table_tsv');
		expect(preview.pendingPatternDecisions).toHaveLength(0);
		expect(preview.unresolved).toHaveLength(0);
		expect(preview.resolved.map((row) => `${row.firstName} ${row.lastName}`)).toEqual([
			'James Jackson',
			'Amy Chen'
		]);
	});

	it('returns a one-time pending decision for ambiguous no-header TSV', () => {
		const preview = parseStaffImport({
			rawText: 'James\tJackson\nAmy\tChen',
			requiredCertCodes: ['BLS'],
			existingStaff: []
		});

		expect(preview.detectedSourceType).toBe('table_tsv');
		expect(preview.resolved).toHaveLength(0);
		expect(preview.unresolved).toHaveLength(0);
		expect(preview.pendingPatternDecisions).toHaveLength(1);
		expect(preview.pendingPatternDecisions[0]).toMatchObject({
			sampleFirstToken: 'James',
			sampleSecondToken: 'Jackson'
		});
	});

	it('applies a provided pattern decision to all matching no-header TSV rows', () => {
		const previewWithoutDecision = parseStaffImport({
			rawText: 'James\tJackson\nAmy\tChen',
			requiredCertCodes: ['BLS'],
			existingStaff: []
		});
		const pending = previewWithoutDecision.pendingPatternDecisions[0];
		expect(pending).toBeDefined();

		const preview = parseStaffImport({
			rawText: 'James\tJackson\nAmy\tChen',
			requiredCertCodes: ['BLS'],
			existingStaff: [],
			patternDecisions: {
				[pending!.patternId]: 'first_last'
			}
		});

		expect(preview.pendingPatternDecisions).toHaveLength(0);
		expect(preview.unresolved).toHaveLength(0);
		expect(preview.resolved.map((row) => `${row.firstName} ${row.lastName}`)).toEqual([
			'James Jackson',
			'Amy Chen'
		]);
	});

	it('returns pending decisions for every ambiguous TSV pattern in a mixed paste', () => {
		const preview = parseStaffImport({
			rawText: 'James\tJackson\nMary Ann\tChen\nAria\tLopez',
			requiredCertCodes: ['BLS'],
			existingStaff: []
		});

		expect(preview.pendingPatternDecisions).toHaveLength(2);
		expect(preview.pendingPatternDecisions.map((pattern) => pattern.sampleFirstToken)).toEqual([
			'James',
			'Mary Ann'
		]);
	});

	it('parses mixed TSV rows with single-cell "Last, First" entries after order confirmation', () => {
		const previewWithoutDecision = parseStaffImport({
			rawText: 'James\tJackson\nLopez, Maria\nAmy\tChen',
			requiredCertCodes: ['BLS'],
			existingStaff: []
		});

		const pending = previewWithoutDecision.pendingPatternDecisions[0];
		expect(pending).toBeDefined();

		const preview = parseStaffImport({
			rawText: 'James\tJackson\nLopez, Maria\nAmy\tChen',
			requiredCertCodes: ['BLS'],
			existingStaff: [],
			patternDecisions: {
				[pending!.patternId]: 'first_last'
			}
		});

		expect(preview.pendingPatternDecisions).toHaveLength(0);
		expect(preview.unresolved).toHaveLength(0);
		expect(preview.resolved.map((row) => `${row.firstName} ${row.lastName}`)).toEqual([
			'James Jackson',
			'Maria Lopez',
			'Amy Chen'
		]);
	});

	it('does not split suffix-style comma rows into pseudo names', () => {
		const preview = parseStaffImport({
			rawText: 'Jackson, James, RN',
			requiredCertCodes: ['BLS'],
			existingStaff: []
		});

		expect(preview.pendingPatternDecisions).toHaveLength(0);
		expect(preview.resolved).toHaveLength(1);
		expect(preview.unresolved).toHaveLength(0);
		expect(preview.resolved[0]).toMatchObject({
			firstName: 'James',
			lastName: 'Jackson'
		});
	});

	it('moves duplicate first+last rows without middle name into unresolved queue', () => {
		const preview = parseStaffImport({
			rawText: 'James Jackson',
			requiredCertCodes: ['ACLS'],
			existingStaff: [
				{
					firstName: 'James',
					middleName: 'A',
					lastName: 'Jackson'
				}
			]
		});

		expect(preview.resolved).toHaveLength(0);
		expect(preview.unresolved).toHaveLength(1);
		expect(preview.unresolved[0]?.reason).toContain('Duplicate first+last');
	});
});
