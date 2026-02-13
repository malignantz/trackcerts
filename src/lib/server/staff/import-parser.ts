import type { CertificationCode } from '$lib/types';

export interface ExistingStaffName {
	firstName: string;
	middleName: string | null;
	lastName: string;
}

export interface ParsedStaffRow {
	raw: string;
	firstName: string;
	middleName: string | null;
	lastName: string;
	requiredCertCodes: CertificationCode[];
	confidence: number;
}

export interface UnresolvedStaffRow {
	raw: string;
	reason: string;
	suggestion: {
		firstName: string;
		middleName: string | null;
		lastName: string;
	};
	requiredCertCodes: CertificationCode[];
}

export type ImportSourceType = 'table_tsv' | 'list_text';
export type NameOrderDecision = 'first_last' | 'last_first';

export interface PendingPatternDecision {
	patternId: string;
	sampleFirstToken: string;
	sampleSecondToken: string;
	question: string;
	options: Array<{ value: NameOrderDecision; label: string }>;
}

export interface StaffImportPreview {
	resolved: ParsedStaffRow[];
	unresolved: UnresolvedStaffRow[];
	pendingPatternDecisions: PendingPatternDecision[];
	detectedSourceType: ImportSourceType;
}

interface ParseInput {
	rawText: string;
	requiredCertCodes: CertificationCode[];
	existingStaff: ExistingStaffName[];
	patternDecisions?: Record<string, NameOrderDecision>;
}

interface HeaderMapping {
	firstIndex: number;
	middleIndex: number | null;
	lastIndex: number;
}

function toTitleCase(input: string): string {
	if (!input) {
		return '';
	}

	return input
		.toLowerCase()
		.split(/([ -])/)
		.map((part) => {
			if (part === ' ' || part === '-') {
				return part;
			}
			return part[0]?.toUpperCase() + part.slice(1);
		})
		.join('')
		.replace(/'+/g, "'");
}

function cleanToken(token: string): string {
	return token
		.replace(/[^A-Za-z' -]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function splitRawRows(rawText: string): string[] {
	const normalized = rawText.replace(/\t/g, '\n').replace(/;+/g, '\n').replace(/\r/g, '\n');

	return normalized
		.split('\n')
		.map((row) => row.trim())
		.flatMap((row) => {
			if (!row) {
				return [];
			}
			if (!row.includes(',')) {
				return [row];
			}

			const commaParts = row
				.split(',')
				.map((part) => part.trim())
				.filter(Boolean);
			if (commaParts.length === 2) {
				const bothLookLikeFullNames = commaParts.every(
					(part) => part.split(/\s+/).filter(Boolean).length >= 2
				);
				if (bothLookLikeFullNames) {
					return commaParts;
				}
				return [row];
			}

			const looksLikeAlternatingLastFirst =
				commaParts.length % 2 === 0 &&
				commaParts.every((part) => part.split(/\s+/).filter(Boolean).length === 1);
			if (looksLikeAlternatingLastFirst) {
				const pairedRows: string[] = [];
				for (let index = 0; index < commaParts.length; index += 2) {
					pairedRows.push(`${commaParts[index]}, ${commaParts[index + 1]}`);
				}
				return pairedRows;
			}

			const allLookLikeFullNames = commaParts.every(
				(part) => part.split(/\s+/).filter(Boolean).length >= 2
			);
			if (allLookLikeFullNames) {
				return commaParts;
			}

			return [row];
		});
}

function normalizeHeaderToken(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function detectSourceType(rawText: string): ImportSourceType {
	const lines = rawText
		.replace(/\r/g, '\n')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length === 0) {
		return 'list_text';
	}

	const tabRows = lines.filter(
		(line) => line.includes('\t') && line.split('\t').length >= 2
	).length;
	return tabRows / lines.length > 0.5 ? 'table_tsv' : 'list_text';
}

const HEADER_FIRST_ALIASES = new Set(['first', 'first name', 'fname', 'given name']);
const HEADER_MIDDLE_ALIASES = new Set(['middle', 'middle name', 'mi', 'm i']);
const HEADER_LAST_ALIASES = new Set(['last', 'last name', 'lname', 'surname', 'family name']);

function detectHeaderMapping(firstRow: string[]): HeaderMapping | null {
	let firstIndex = -1;
	let middleIndex = -1;
	let lastIndex = -1;

	for (let index = 0; index < firstRow.length; index += 1) {
		const normalized = normalizeHeaderToken(firstRow[index] ?? '');
		if (HEADER_FIRST_ALIASES.has(normalized) && firstIndex === -1) {
			firstIndex = index;
			continue;
		}
		if (HEADER_LAST_ALIASES.has(normalized) && lastIndex === -1) {
			lastIndex = index;
			continue;
		}
		if (HEADER_MIDDLE_ALIASES.has(normalized) && middleIndex === -1) {
			middleIndex = index;
		}
	}

	if (firstIndex === -1 || lastIndex === -1 || firstIndex === lastIndex) {
		return null;
	}

	return {
		firstIndex,
		middleIndex: middleIndex === -1 ? null : middleIndex,
		lastIndex
	};
}

function isTextLike(value: string): boolean {
	return /[A-Za-z]/.test(value);
}

function getCandidateColumns(rows: string[][]): number[] {
	const maxColumns = rows.reduce((current, row) => Math.max(current, row.length), 0);
	const scored: Array<{ index: number; nonEmpty: number; textLike: number }> = [];

	for (let index = 0; index < maxColumns; index += 1) {
		let nonEmpty = 0;
		let textLike = 0;
		for (const row of rows) {
			const value = (row[index] ?? '').trim();
			if (!value) {
				continue;
			}
			nonEmpty += 1;
			if (isTextLike(value)) {
				textLike += 1;
			}
		}
		if (nonEmpty > 0 && textLike > 0) {
			scored.push({ index, nonEmpty, textLike });
		}
	}

	return scored
		.sort((left, right) => {
			if (right.textLike !== left.textLike) {
				return right.textLike - left.textLike;
			}
			if (right.nonEmpty !== left.nonEmpty) {
				return right.nonEmpty - left.nonEmpty;
			}
			return left.index - right.index;
		})
		.map((entry) => entry.index);
}

function estimateMiddleColumn(rows: string[][], usedIndexes: Set<number>): number | null {
	const candidates = getCandidateColumns(rows).filter((index) => !usedIndexes.has(index));
	if (candidates.length === 0) {
		return null;
	}

	for (const index of candidates) {
		const values = rows.map((row) => (row[index] ?? '').trim()).filter((value) => Boolean(value));
		if (values.length === 0) {
			continue;
		}

		const singleTokenRatio =
			values.filter((value) => value.split(/\s+/).filter(Boolean).length <= 1).length /
			values.length;
		if (singleTokenRatio >= 0.75) {
			return index;
		}
	}

	return null;
}

function tokenCount(value: string): number {
	return cleanToken(value).split(/\s+/).filter(Boolean).length;
}

function buildRowPatternId(
	firstColumnIndex: number,
	lastColumnIndex: number,
	middleColumnIndex: number | null,
	firstCell: string,
	lastCell: string
): string {
	const describeCell = (value: string) => {
		const trimmed = value.trim();
		if (!trimmed) {
			return 'empty';
		}
		const tokens = tokenCount(trimmed);
		const commaFlag = trimmed.includes(',') ? 'comma' : 'plain';
		const tokenBucket = tokens <= 1 ? '1' : tokens === 2 ? '2' : '3plus';
		return `${commaFlag}_${tokenBucket}`;
	};

	return `table_tsv:${firstColumnIndex}:${middleColumnIndex ?? 'none'}:${lastColumnIndex}:${describeCell(
		firstCell
	)}:${describeCell(lastCell)}`;
}

function parseSingleCellInTableRow(
	rawCell: string,
	rawRow: string,
	requiredCertCodes: CertificationCode[]
): Pick<StaffImportPreview, 'resolved' | 'unresolved'> {
	const parsed = parseSingleRow(rawCell, requiredCertCodes);
	if (parsed.resolved.length > 0) {
		return {
			resolved: parsed.resolved.map((row) => ({ ...row, raw: rawRow })),
			unresolved: []
		};
	}

	return {
		resolved: [],
		unresolved: parsed.unresolved.map((row) => ({ ...row, raw: rawRow }))
	};
}

function buildFallbackSuggestion(raw: string) {
	const relaxed = raw
		.replace(/[^A-Za-z0-9' -]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	const tokens = relaxed.split(' ').filter(Boolean);
	if (tokens.length === 0) {
		return {
			firstName: '',
			middleName: null,
			lastName: ''
		};
	}

	const firstName = toTitleCase(tokens[0] ?? '');
	const middleName = tokens.length > 2 ? toTitleCase(tokens.slice(1, -1).join(' ')) || null : null;
	const lastName = tokens.length > 1 ? toTitleCase(tokens[tokens.length - 1] ?? '') : '';

	return {
		firstName,
		middleName,
		lastName
	};
}

function parseSingleRow(raw: string, requiredCertCodes: CertificationCode[]): StaffImportPreview {
	const fallback = {
		raw,
		reason: 'Could not parse this name.',
		suggestion: buildFallbackSuggestion(raw),
		requiredCertCodes
	};

	if (!raw.trim()) {
		return {
			resolved: [],
			unresolved: [],
			pendingPatternDecisions: [],
			detectedSourceType: 'list_text'
		};
	}

	const compact = raw.replace(/\s+/g, ' ').trim();

	if (compact.includes(',')) {
		const [lastPart, firstPart = ''] = compact.split(',', 2);
		const firstTokens = cleanToken(firstPart).split(' ').filter(Boolean);
		const lastName = toTitleCase(cleanToken(lastPart));
		if (firstTokens.length === 0 || !lastName) {
			return {
				resolved: [],
				unresolved: [fallback],
				pendingPatternDecisions: [],
				detectedSourceType: 'list_text'
			};
		}

		const firstName = toTitleCase(cleanToken(firstTokens[0] ?? ''));
		const middleName =
			firstTokens.length > 1
				? toTitleCase(cleanToken(firstTokens.slice(1).join(' '))) || null
				: null;

		return {
			resolved: [
				{
					raw,
					firstName,
					middleName,
					lastName,
					requiredCertCodes,
					confidence: 0.95
				}
			],
			unresolved: [],
			pendingPatternDecisions: [],
			detectedSourceType: 'list_text'
		};
	}

	const tokens = cleanToken(compact).split(' ').filter(Boolean);
	if (tokens.length < 2) {
		return {
			resolved: [],
			unresolved: [
				{
					...fallback,
					reason: 'Name requires at least first and last.'
				}
			],
			pendingPatternDecisions: [],
			detectedSourceType: 'list_text'
		};
	}

	if (tokens.length === 2) {
		return {
			resolved: [
				{
					raw,
					firstName: toTitleCase(tokens[0] ?? ''),
					middleName: null,
					lastName: toTitleCase(tokens[1] ?? ''),
					requiredCertCodes,
					confidence: 0.85
				}
			],
			unresolved: [],
			pendingPatternDecisions: [],
			detectedSourceType: 'list_text'
		};
	}

	const firstName = toTitleCase(tokens[0] ?? '');
	const lastName = toTitleCase(tokens[tokens.length - 1] ?? '');
	const middleName = toTitleCase(tokens.slice(1, -1).join(' ')) || null;

	if (!firstName || !lastName) {
		return {
			resolved: [],
			unresolved: [fallback],
			pendingPatternDecisions: [],
			detectedSourceType: 'list_text'
		};
	}

	const confidence = tokens.length <= 4 ? 0.75 : 0.6;
	if (confidence < 0.7) {
		return {
			resolved: [],
			unresolved: [
				{
					raw,
					reason: 'Low confidence parse. Please confirm first/middle/last.',
					suggestion: { firstName, middleName, lastName },
					requiredCertCodes
				}
			],
			pendingPatternDecisions: [],
			detectedSourceType: 'list_text'
		};
	}

	return {
		resolved: [
			{
				raw,
				firstName,
				middleName,
				lastName,
				requiredCertCodes,
				confidence
			}
		],
		unresolved: [],
		pendingPatternDecisions: [],
		detectedSourceType: 'list_text'
	};
}

function keyForName(firstName: string, middleName: string | null, lastName: string): string {
	return `${firstName.toLowerCase()}|${(middleName ?? '').toLowerCase()}|${lastName.toLowerCase()}`;
}

function keyForFirstLast(firstName: string, lastName: string): string {
	return `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
}

function parseTableRows(input: ParseInput): StaffImportPreview {
	const lines = input.rawText
		.replace(/\r/g, '\n')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
	const parsedRows = lines.map((line) => line.split('\t').map((cell) => cell.trim()));

	if (parsedRows.length === 0) {
		return {
			resolved: [],
			unresolved: [],
			pendingPatternDecisions: [],
			detectedSourceType: 'table_tsv'
		};
	}

	const headerMapping = detectHeaderMapping(parsedRows[0] ?? []);
	let dataRows = parsedRows;
	let firstColumnIndex = -1;
	let lastColumnIndex = -1;
	let middleColumnIndex: number | null = null;
	let confidence = 0.8;
	const rowPatternByIndex = new Map<number, string>();

	if (headerMapping) {
		dataRows = parsedRows.slice(1);
		firstColumnIndex = headerMapping.firstIndex;
		middleColumnIndex = headerMapping.middleIndex;
		lastColumnIndex = headerMapping.lastIndex;
		confidence = 0.95;
	} else {
		const candidates = getCandidateColumns(parsedRows);
		if (candidates.length < 2) {
			const fallback = parseSingleRow(lines.join('\n'), input.requiredCertCodes);
			return {
				...fallback,
				detectedSourceType: 'table_tsv'
			};
		}

		firstColumnIndex = candidates[0] ?? -1;
		lastColumnIndex = candidates[1] ?? -1;
		middleColumnIndex = estimateMiddleColumn(
			parsedRows,
			new Set([firstColumnIndex, lastColumnIndex])
		);

		const pendingByPatternId = new Map<string, PendingPatternDecision>();
		for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
			const cells = dataRows[rowIndex] ?? [];
			const firstCell = (cells[firstColumnIndex] ?? '').trim();
			const lastCell = (cells[lastColumnIndex] ?? '').trim();
			if (!firstCell || !lastCell) {
				continue;
			}
			if (!isTextLike(firstCell) || !isTextLike(lastCell)) {
				continue;
			}
			if (firstCell.includes(',') || lastCell.includes(',')) {
				continue;
			}

			const patternId = buildRowPatternId(
				firstColumnIndex,
				lastColumnIndex,
				middleColumnIndex,
				firstCell,
				lastCell
			);
			rowPatternByIndex.set(rowIndex, patternId);
			if (input.patternDecisions?.[patternId]) {
				continue;
			}
			if (pendingByPatternId.has(patternId)) {
				continue;
			}

			pendingByPatternId.set(patternId, {
				patternId,
				sampleFirstToken: firstCell,
				sampleSecondToken: lastCell,
				question: 'Which name order is correct for rows in this format?',
				options: [
					{ value: 'first_last', label: 'First token then second token' },
					{ value: 'last_first', label: 'Second token then first token' }
				]
			});
		}

		if (pendingByPatternId.size > 0) {
			return {
				resolved: [],
				unresolved: [],
				pendingPatternDecisions: [...pendingByPatternId.values()],
				detectedSourceType: 'table_tsv'
			};
		}
	}

	const resolved: ParsedStaffRow[] = [];
	const unresolved: UnresolvedStaffRow[] = [];

	for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
		const cells = dataRows[rowIndex] ?? [];
		const rawRow = cells.join('\t');
		const firstCellRaw = (cells[firstColumnIndex] ?? '').trim();
		const lastCellRaw = (cells[lastColumnIndex] ?? '').trim();
		const middleNameRaw =
			middleColumnIndex === null ? '' : cleanToken(cells[middleColumnIndex] ?? '');
		const middleName = middleNameRaw ? toTitleCase(middleNameRaw) : null;

		if (!headerMapping) {
			if (firstCellRaw && !lastCellRaw) {
				const parsed = parseSingleCellInTableRow(firstCellRaw, rawRow, input.requiredCertCodes);
				resolved.push(...parsed.resolved);
				unresolved.push(...parsed.unresolved);
				continue;
			}
			if (!firstCellRaw && lastCellRaw) {
				const parsed = parseSingleCellInTableRow(lastCellRaw, rawRow, input.requiredCertCodes);
				resolved.push(...parsed.resolved);
				unresolved.push(...parsed.unresolved);
				continue;
			}
		}

		if (!firstCellRaw && !middleName && !lastCellRaw) {
			continue;
		}

		let mappedFirstRaw = firstCellRaw;
		let mappedLastRaw = lastCellRaw;

		if (!headerMapping && firstCellRaw && lastCellRaw) {
			const firstHasComma = firstCellRaw.includes(',');
			const lastHasComma = lastCellRaw.includes(',');
			if (firstHasComma !== lastHasComma) {
				mappedFirstRaw = firstHasComma ? lastCellRaw : firstCellRaw;
				mappedLastRaw = firstHasComma ? firstCellRaw : lastCellRaw;
			} else {
				const patternId = rowPatternByIndex.get(rowIndex);
				const decision =
					patternId && input.patternDecisions?.[patternId] === 'last_first'
						? 'last_first'
						: 'first_last';
				if (decision === 'last_first') {
					mappedFirstRaw = lastCellRaw;
					mappedLastRaw = firstCellRaw;
				}
			}
		}

		const firstName = toTitleCase(cleanToken(mappedFirstRaw));
		const lastName = toTitleCase(cleanToken(mappedLastRaw));

		if (!firstName || !lastName) {
			unresolved.push({
				raw: rawRow,
				reason: 'Missing first or last name from mapped columns.',
				suggestion: {
					firstName,
					middleName,
					lastName
				},
				requiredCertCodes: input.requiredCertCodes
			});
			continue;
		}

		resolved.push({
			raw: rawRow,
			firstName,
			middleName,
			lastName,
			requiredCertCodes: input.requiredCertCodes,
			confidence:
				!headerMapping && firstCellRaw.includes(',') !== lastCellRaw.includes(',')
					? 0.92
					: confidence
		});
	}

	return {
		resolved,
		unresolved,
		pendingPatternDecisions: [],
		detectedSourceType: 'table_tsv'
	};
}

export function parseStaffImport(input: ParseInput): StaffImportPreview {
	const detectedSourceType = detectSourceType(input.rawText);
	const preview =
		detectedSourceType === 'table_tsv'
			? parseTableRows(input)
			: (() => {
					const rows = splitRawRows(input.rawText);
					const resolved: ParsedStaffRow[] = [];
					const unresolved: UnresolvedStaffRow[] = [];

					for (const row of rows) {
						const parsed = parseSingleRow(row, input.requiredCertCodes);
						resolved.push(...parsed.resolved);
						unresolved.push(...parsed.unresolved);
					}

					return {
						resolved,
						unresolved,
						pendingPatternDecisions: [],
						detectedSourceType: 'list_text' as const
					};
				})();

	if (preview.pendingPatternDecisions.length > 0) {
		return preview;
	}

	const deduped: ParsedStaffRow[] = [];
	const seen = new Set<string>();
	for (const row of preview.resolved) {
		const key = keyForName(row.firstName, row.middleName, row.lastName);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduped.push(row);
	}

	const firstLastCounts = new Map<string, number>();
	for (const existing of input.existingStaff) {
		const firstLastKey = keyForFirstLast(existing.firstName, existing.lastName);
		firstLastCounts.set(firstLastKey, (firstLastCounts.get(firstLastKey) ?? 0) + 1);
	}
	for (const row of deduped) {
		const firstLastKey = keyForFirstLast(row.firstName, row.lastName);
		firstLastCounts.set(firstLastKey, (firstLastCounts.get(firstLastKey) ?? 0) + 1);
	}

	const finalResolved: ParsedStaffRow[] = [];
	const unresolved: UnresolvedStaffRow[] = [...preview.unresolved];
	for (const row of deduped) {
		const firstLastKey = keyForFirstLast(row.firstName, row.lastName);
		const collisionCount = firstLastCounts.get(firstLastKey) ?? 0;
		if (collisionCount > 1 && !row.middleName) {
			unresolved.push({
				raw: row.raw,
				reason: 'Duplicate first+last requires middle name or initial.',
				suggestion: {
					firstName: row.firstName,
					middleName: row.middleName,
					lastName: row.lastName
				},
				requiredCertCodes: row.requiredCertCodes
			});
			continue;
		}

		finalResolved.push(row);
	}

	return {
		resolved: finalResolved,
		unresolved,
		pendingPatternDecisions: [],
		detectedSourceType
	};
}
