import { FIXED_CERTIFICATION_CODES } from '$lib/certifications';

interface CommitRowDraft {
	firstName: string;
	middleName: string;
	lastName: string;
	certs: string[];
	include: boolean;
	order: number;
}

export interface ParsedCommitRow {
	firstName: string;
	middleName: string;
	lastName: string;
	requiredCertCodes: ('ACLS' | 'BLS' | 'PALS')[];
}

export interface ParsedCommitRowsResult {
	rows: ParsedCommitRow[];
	invalidIncludedIndexes: number[];
}

export function parseCommitRows(formData: FormData): ParsedCommitRowsResult {
	const rows = new Map<string, CommitRowDraft>();
	const orderedRowIds: string[] = [];

	for (const [key, value] of formData.entries()) {
		const match = key.match(/^rows\.([^./]+)\.(include|firstName|middleName|lastName|certs)$/);
		if (!match) {
			continue;
		}

		const rowId = match[1];
		const field = match[2];
		if (!rows.has(rowId)) {
			rows.set(rowId, {
				firstName: '',
				middleName: '',
				lastName: '',
				certs: [],
				include: false,
				order: orderedRowIds.length
			});
			orderedRowIds.push(rowId);
		}

		const target = rows.get(rowId);
		if (!target) {
			continue;
		}

		if (field === 'include') {
			target.include = true;
			continue;
		}
		if (field === 'certs') {
			target.certs.push(String(value));
			continue;
		}

		const normalizedValue = String(value ?? '');
		if (field === 'firstName') {
			target.firstName = normalizedValue;
		} else if (field === 'middleName') {
			target.middleName = normalizedValue;
		} else if (field === 'lastName') {
			target.lastName = normalizedValue;
		}
	}

	const invalidIncludedIndexes: number[] = [];
	const parsedRows = [...rows.values()]
		.sort((a, b) => a.order - b.order)
		.flatMap((row, index) => {
			if (!row.include) {
				return [];
			}

			const firstName = row.firstName.trim();
			const middleName = row.middleName.trim();
			const lastName = row.lastName.trim();
			if (!firstName || !lastName) {
				invalidIncludedIndexes.push(index + 1);
				return [];
			}

			return [
				{
					firstName,
					middleName,
					lastName,
					requiredCertCodes: FIXED_CERTIFICATION_CODES.filter((code) => row.certs.includes(code))
				}
			];
		});

	return {
		rows: parsedRows,
		invalidIncludedIndexes
	};
}
