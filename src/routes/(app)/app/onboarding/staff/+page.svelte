<script lang="ts">
	import { browser } from '$app/environment';
	import { FIXED_CERTIFICATION_CODES } from '$lib/certifications';
	import { onMount } from 'svelte';

	type PreviewRow = {
		id: string;
		firstName: string;
		middleName: string | null;
		lastName: string;
		requiredCertCodes: string[];
		includeByDefault: boolean;
		statusLabel: string;
		highlightClass: string;
	};

	type PendingPatternDecision = {
		patternId: string;
		sampleFirstToken: string;
		sampleSecondToken: string;
		question: string;
	};

	type DuplicateGroup = {
		key: string;
		displayName: string;
	};

	const ROWS_PER_PAGE = 10;
	const LOCAL_STORAGE_DRAFT_KEY = 'trackcerts.onboarding.staff-import-draft.v1';

	type StoredImportDraft = {
		rows: PreviewRow[];
		duplicateDecisions: Record<string, 'yes' | 'no'>;
		savedAtIso: string;
	};

	let { data, form } = $props();
	let duplicateDecisions = $state<Record<string, 'yes' | 'no'>>({});
	let rowDrafts = $state<PreviewRow[]>([]);
	let previewDraftSignature = '';
	let currentPage = $state(1);
	let restoreCandidate = $state<StoredImportDraft | null>(null);

	const parsedPreviewRows = () =>
		form && 'previewRows' in form && Array.isArray(form.previewRows)
			? (form.previewRows as PreviewRow[])
			: [];

	const showTestingTools = () =>
		Boolean(data && 'showTestingTools' in data && data.showTestingTools);

	const buildPreviewSignature = (rows: PreviewRow[]) =>
		rows
			.map(
				(row) =>
					`${row.id}|${row.firstName}|${row.middleName ?? ''}|${row.lastName}|${row.requiredCertCodes.join(
						','
					)}|${row.includeByDefault ? '1' : '0'}|${row.statusLabel}|${row.highlightClass}`
			)
			.join('||');

	const cloneRows = (rows: PreviewRow[]) =>
		rows.map((row) => ({
			...row,
			requiredCertCodes: [...row.requiredCertCodes]
		}));

	const readStoredDraft = (): StoredImportDraft | null => {
		if (!browser) {
			return null;
		}
		const raw = window.localStorage.getItem(LOCAL_STORAGE_DRAFT_KEY);
		if (!raw) {
			return null;
		}
		try {
			const parsed = JSON.parse(raw) as StoredImportDraft;
			if (!parsed || !Array.isArray(parsed.rows) || typeof parsed.savedAtIso !== 'string') {
				return null;
			}
			const rows = parsed.rows
				.filter(
					(row) =>
						typeof row?.id === 'string' &&
						typeof row?.firstName === 'string' &&
						(typeof row?.middleName === 'string' || row?.middleName === null) &&
						typeof row?.lastName === 'string' &&
						Array.isArray(row?.requiredCertCodes) &&
						typeof row?.includeByDefault === 'boolean' &&
						typeof row?.statusLabel === 'string' &&
						typeof row?.highlightClass === 'string'
				)
				.map((row) => ({
					...row,
					requiredCertCodes: FIXED_CERTIFICATION_CODES.filter((code) =>
						(row.requiredCertCodes as string[]).includes(code)
					)
				})) as PreviewRow[];
			if (rows.length === 0) {
				return null;
			}

			const normalizedDuplicateDecisions: Record<string, 'yes' | 'no'> = {};
			if (parsed.duplicateDecisions && typeof parsed.duplicateDecisions === 'object') {
				for (const [key, value] of Object.entries(parsed.duplicateDecisions)) {
					normalizedDuplicateDecisions[key] = value === 'yes' ? 'yes' : 'no';
				}
			}

			return {
				rows,
				duplicateDecisions: normalizedDuplicateDecisions,
				savedAtIso: parsed.savedAtIso
			};
		} catch {
			return null;
		}
	};

	const clearStoredDraft = () => {
		if (!browser) {
			return;
		}
		window.localStorage.removeItem(LOCAL_STORAGE_DRAFT_KEY);
	};

	const pendingPatternDecisions = () =>
		form && 'pendingPatternDecisions' in form && Array.isArray(form.pendingPatternDecisions)
			? (form.pendingPatternDecisions as PendingPatternDecision[])
			: [];

	const requiredCertCodes = () =>
		form && 'requiredCertCodes' in form && Array.isArray(form.requiredCertCodes)
			? (form.requiredCertCodes as string[])
			: [];

	const selectedPatternDecision = (patternId: string) => {
		if (!form || !('patternDecisions' in form) || !form.patternDecisions) {
			return 'first_last';
		}
		const decisions = form.patternDecisions as Record<string, string>;
		return decisions[patternId] === 'last_first' ? 'last_first' : 'first_last';
	};

	const includeAll = (codes: string[]) =>
		FIXED_CERTIFICATION_CODES.every((code) => codes.includes(code));

	$effect(() => {
		const sourceRows = parsedPreviewRows();
		const signature = buildPreviewSignature(sourceRows);
		if (signature === previewDraftSignature) {
			return;
		}

		previewDraftSignature = signature;
		rowDrafts = cloneRows(sourceRows);
		duplicateDecisions = {};
		currentPage = 1;
		if (sourceRows.length > 0) {
			restoreCandidate = null;
		}
	});

	$effect(() => {
		if (!browser || rowDrafts.length === 0) {
			return;
		}
		const payload: StoredImportDraft = {
			rows: cloneRows(rowDrafts),
			duplicateDecisions: { ...duplicateDecisions },
			savedAtIso: new Date().toISOString()
		};
		window.localStorage.setItem(LOCAL_STORAGE_DRAFT_KEY, JSON.stringify(payload));
	});

	$effect(() => {
		if (!browser || !form || form.action !== 'clearStaffTesting' || !form.success) {
			return;
		}
		clearStoredDraft();
	});

	onMount(() => {
		const sourceRows = parsedPreviewRows();
		if (sourceRows.length > 0) {
			return;
		}
		restoreCandidate = readStoredDraft();
	});

	const updateRowDraft = (rowId: string, updater: (row: PreviewRow) => PreviewRow) => {
		rowDrafts = rowDrafts.map((row) => (row.id === rowId ? updater(row) : row));
	};

	const setRowInclude = (rowId: string, include: boolean) => {
		updateRowDraft(rowId, (row) => ({ ...row, includeByDefault: include }));
	};

	const setRowField = (
		rowId: string,
		field: 'firstName' | 'middleName' | 'lastName',
		value: string
	) => {
		if (field === 'middleName') {
			updateRowDraft(rowId, (row) => ({ ...row, middleName: value }));
			return;
		}
		updateRowDraft(rowId, (row) => ({ ...row, [field]: value }));
	};

	const setRowCert = (rowId: string, certCode: string, checked: boolean) => {
		updateRowDraft(rowId, (row) => {
			const next = new Set(row.requiredCertCodes);
			if (checked) {
				next.add(certCode);
			} else {
				next.delete(certCode);
			}
			return {
				...row,
				requiredCertCodes: FIXED_CERTIFICATION_CODES.filter((code) => next.has(code))
			};
		});
	};

	const firstLastKey = (firstName: string, lastName: string) =>
		`${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;

	const displayNameFromKey = (key: string) => {
		const [firstName = '', lastName = ''] = key.split('|');
		const toTitleCaseWords = (value: string) =>
			value
				.split(/\s+/)
				.filter(Boolean)
				.map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
				.join(' ');
		return `${toTitleCaseWords(firstName)} ${toTitleCaseWords(lastName)}`.trim();
	};

	const duplicateGroups = () => {
		const counts = new Map<string, number>();
		for (const row of rowDrafts) {
			const key = firstLastKey(row.firstName, row.lastName);
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return [...counts.entries()]
			.filter(([, count]) => count > 1)
			.map(([key]) => ({ key, displayName: displayNameFromKey(key) })) as DuplicateGroup[];
	};

	const selectedDuplicateDecision = (key: string) => duplicateDecisions[key] ?? 'no';

	const setDuplicateDecision = (key: string, value: 'yes' | 'no') => {
		duplicateDecisions = {
			...duplicateDecisions,
			[key]: value
		};
	};

	const confirmedDuplicateKeys = () =>
		new Set(
			duplicateGroups()
				.filter((group) => selectedDuplicateDecision(group.key) === 'yes')
				.map((group) => group.key)
		);

	const hasAnyMiddleName = () =>
		rowDrafts.some((row) => {
			const value = row.middleName ?? '';
			return value.trim().length > 0;
		});

	const showMiddleColumn = () => confirmedDuplicateKeys().size > 0 || hasAnyMiddleName();

	const isConfirmedDuplicateRow = (row: PreviewRow) =>
		confirmedDuplicateKeys().has(firstLastKey(row.firstName, row.lastName));

	const encodedDuplicateKey = (key: string) => encodeURIComponent(key);

	const totalPages = () => Math.max(1, Math.ceil(rowDrafts.length / ROWS_PER_PAGE));

	const pagedRows = () => {
		const start = (currentPage - 1) * ROWS_PER_PAGE;
		return rowDrafts.slice(start, start + ROWS_PER_PAGE);
	};

	const goToPage = (page: number) => {
		const clamped = Math.min(Math.max(page, 1), totalPages());
		currentPage = clamped;
	};

	const restoreStoredDraft = () => {
		if (!restoreCandidate) {
			return;
		}
		rowDrafts = cloneRows(restoreCandidate.rows);
		duplicateDecisions = { ...restoreCandidate.duplicateDecisions };
		currentPage = 1;
		restoreCandidate = null;
		previewDraftSignature = '';
	};

	const dismissStoredDraft = () => {
		clearStoredDraft();
		restoreCandidate = null;
	};

	const formatNameCount = (count: number) => `${count} ${count === 1 ? 'name' : 'names'}`;
</script>

<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h2 class="text-2xl font-semibold text-slate-900">Staff onboarding</h2>
			<p class="mt-2 text-slate-600">
				Import staff names in batches and assign required certifications.
			</p>
			{#if showTestingTools()}
				<form
					method="POST"
					action="?/clearStaffTesting"
					class="mt-3"
					onsubmit={(event) => {
						if (!confirm('Clear all staff for this org? This is intended for testing.')) {
							event.preventDefault();
						}
					}}
				>
					<button
						type="submit"
						class="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
					>
						Clear staff (testing)
					</button>
				</form>
			{/if}
		</div>
		<a
			href="/app/staff"
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
		>
			Return to staff list
		</a>
	</div>

	<form method="POST" action="?/importPreview" class="mt-6 space-y-4">
		<fieldset>
			<legend class="mb-2 text-sm font-medium text-slate-700">Requires</legend>
			<div class="flex flex-wrap gap-3">
				<label
					class="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm"
				>
					<input type="checkbox" name="requiredCerts" value="ALL" />
					<span>ALL</span>
				</label>
				{#each FIXED_CERTIFICATION_CODES as certCode}
					<label
						class="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm"
					>
						<input type="checkbox" name="requiredCerts" value={certCode} />
						<span>{certCode}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<label class="block">
			<span class="mb-1 block text-sm font-medium text-slate-700">Paste staff list</span>
			<textarea
				name="rawText"
				required
				rows="8"
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
				placeholder="Kathy Johnson&#10;Jackson, James&#10;Maria A Lopez"
				>{(form && 'rawText' in form && String(form.rawText)) || ''}</textarea
			>
		</label>

		<button type="submit" class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">
			Preview import
		</button>
	</form>

	{#if form?.error}
		<p class="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
			{form.error}
		</p>
	{/if}

	{#if form?.action === 'clearStaffTesting' && form?.success}
		<p
			class="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
		>
			Cleared {('clearedCount' in form && Number(form.clearedCount)) || 0} staff records.
		</p>
	{/if}

	{#if restoreCandidate && rowDrafts.length === 0 && pendingPatternDecisions().length === 0}
		<section class="mt-6 rounded-xl border border-sky-300 bg-sky-50 p-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<p class="text-sm text-sky-900">
					Restore your previous unsaved import of {formatNameCount(restoreCandidate.rows.length)}?
				</p>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white"
						onclick={restoreStoredDraft}
					>
						Restore
					</button>
					<button
						type="button"
						class="rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-800"
						onclick={dismissStoredDraft}
					>
						Dismiss
					</button>
				</div>
			</div>
		</section>
	{/if}

	{#if pendingPatternDecisions().length > 0}
		<section class="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4">
			<h3 class="text-lg font-semibold text-amber-900">Confirm name order</h3>
			<p class="mt-1 text-sm text-amber-800">
				We detected multiple spreadsheet name formats. Confirm each format before we fill names.
			</p>
			<form method="POST" action="?/importPreview" class="mt-4 space-y-4">
				<input
					type="hidden"
					name="rawText"
					value={(form && 'rawText' in form && String(form.rawText)) || ''}
				/>
				{#each requiredCertCodes() as certCode}
					<input type="hidden" name="requiredCerts" value={certCode} />
				{/each}
				{#each pendingPatternDecisions() as pattern}
					<fieldset class="rounded-lg border border-amber-200 bg-white p-3">
						<legend class="px-1 text-sm font-semibold text-amber-900">{pattern.question}</legend>
						<div class="mt-3 grid gap-3 sm:grid-cols-2">
							<label class="block cursor-pointer">
								<input
									type="radio"
									name={`patternDecision.${pattern.patternId}`}
									value="first_last"
									class="peer sr-only"
									checked={selectedPatternDecision(pattern.patternId) === 'first_last'}
								/>
								<div
									class="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 transition peer-checked:ring-2 peer-checked:ring-emerald-500"
								>
									<p class="text-lg font-semibold">
										{pattern.sampleFirstToken}
										{pattern.sampleSecondToken}
									</p>
									<p class="mt-1 text-sm">Use this order.</p>
								</div>
							</label>
							<label class="block cursor-pointer">
								<input
									type="radio"
									name={`patternDecision.${pattern.patternId}`}
									value="last_first"
									class="peer sr-only"
									checked={selectedPatternDecision(pattern.patternId) === 'last_first'}
								/>
								<div
									class="rounded-xl border border-sky-300 bg-sky-50 p-4 text-sky-900 transition peer-checked:ring-2 peer-checked:ring-sky-500"
								>
									<p class="text-lg font-semibold">
										{pattern.sampleSecondToken}
										{pattern.sampleFirstToken}
									</p>
									<p class="mt-1 text-sm">Use this order.</p>
								</div>
							</label>
						</div>
					</fieldset>
				{/each}
				<button type="submit" class="rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white">
					Apply and re-parse
				</button>
			</form>
		</section>
	{/if}

	{#if rowDrafts.length > 0}
		<section class="mt-8">
			<h3 class="text-lg font-semibold text-slate-900">Review queue</h3>
			<p class="mt-1 text-sm text-slate-600">
				Resolved rows are pre-selected. Correct unresolved rows and check Include before saving.
			</p>

			<form method="POST" action="?/importCommit" class="mt-4 space-y-4">
				{#if duplicateGroups().length > 0}
					<section class="rounded-xl border border-indigo-300 bg-indigo-50 p-4">
						<h4 class="text-base font-semibold text-indigo-900">Duplicate name confirmation</h4>
						<p class="mt-1 text-sm text-indigo-800">
							If confirmed, each duplicate must include a unique middle initial or middle name.
						</p>
						<div class="mt-3 space-y-3">
							{#each duplicateGroups() as group}
								<fieldset class="rounded-lg border border-indigo-200 bg-white p-3">
									<legend class="px-1 text-sm font-semibold text-indigo-900">
										Are there two {group.displayName}'s?
									</legend>
									<div class="mt-2 grid gap-3 sm:grid-cols-2">
										<label class="block cursor-pointer">
											<input
												type="radio"
												name={`duplicateChoice.${encodedDuplicateKey(group.key)}`}
												class="peer sr-only"
												checked={selectedDuplicateDecision(group.key) === 'yes'}
												onchange={() => setDuplicateDecision(group.key, 'yes')}
											/>
											<div
												class="rounded-xl border border-fuchsia-300 bg-fuchsia-50 p-3 text-fuchsia-900 transition peer-checked:ring-2 peer-checked:ring-fuchsia-500"
											>
												<p class="font-semibold">Yes</p>
												<p class="text-sm">Two different staff share this name.</p>
											</div>
										</label>
										<label class="block cursor-pointer">
											<input
												type="radio"
												name={`duplicateChoice.${encodedDuplicateKey(group.key)}`}
												class="peer sr-only"
												checked={selectedDuplicateDecision(group.key) === 'no'}
												onchange={() => setDuplicateDecision(group.key, 'no')}
											/>
											<div
												class="rounded-xl border border-cyan-300 bg-cyan-50 p-3 text-cyan-900 transition peer-checked:ring-2 peer-checked:ring-cyan-500"
											>
												<p class="font-semibold">No</p>
												<p class="text-sm">One row is likely mis-ordered or needs correction.</p>
											</div>
										</label>
									</div>
								</fieldset>
							{/each}
						</div>
					</section>
				{/if}

				{#if totalPages() > 1}
					<div class="flex items-center justify-between text-sm text-slate-700">
						<p>
							Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}-{Math.min(
								currentPage * ROWS_PER_PAGE,
								rowDrafts.length
							)} of {rowDrafts.length}
						</p>
						<div class="flex items-center gap-2">
							<button
								type="button"
								class="rounded border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
								onclick={() => goToPage(currentPage - 1)}
								disabled={currentPage === 1}
							>
								Previous
							</button>
							<span>Page {currentPage} / {totalPages()}</span>
							<button
								type="button"
								class="rounded border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
								onclick={() => goToPage(currentPage + 1)}
								disabled={currentPage === totalPages()}
							>
								Next
							</button>
						</div>
					</div>
				{/if}

				<div class="overflow-x-auto rounded-xl border border-slate-200">
					<table class="min-w-full divide-y divide-slate-200">
						<thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
							<tr>
								<th class="px-3 py-2">Include</th>
								<th class="px-3 py-2">First</th>
								{#if showMiddleColumn()}
									<th class="px-3 py-2">Middle</th>
								{/if}
								<th class="px-3 py-2">Last</th>
								<th class="px-3 py-2">Certs</th>
								<th class="px-3 py-2">Status</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100 text-sm">
							{#each pagedRows() as row}
								<tr class={row.highlightClass === 'unresolved' ? 'bg-amber-50' : ''}>
									<td class="px-3 py-2">
										<input
											type="checkbox"
											checked={row.includeByDefault}
											onchange={(event) =>
												setRowInclude(row.id, (event.currentTarget as HTMLInputElement).checked)}
										/>
									</td>
									<td class="px-3 py-2">
										<input
											value={row.firstName}
											required
											class="w-32 rounded border border-slate-300 px-2 py-1"
											oninput={(event) =>
												setRowField(
													row.id,
													'firstName',
													(event.currentTarget as HTMLInputElement).value
												)}
										/>
									</td>
									{#if showMiddleColumn()}
										<td class="px-3 py-2">
											<input
												value={row.middleName ?? ''}
												class={`w-24 rounded border px-2 py-1 ${
													isConfirmedDuplicateRow(row)
														? 'border-fuchsia-400 bg-fuchsia-50'
														: 'border-slate-300'
												}`}
												placeholder={isConfirmedDuplicateRow(row) ? 'Required' : ''}
												oninput={(event) =>
													setRowField(
														row.id,
														'middleName',
														(event.currentTarget as HTMLInputElement).value
													)}
											/>
										</td>
									{/if}
									<td class="px-3 py-2">
										<input
											value={row.lastName}
											required
											class="w-32 rounded border border-slate-300 px-2 py-1"
											oninput={(event) =>
												setRowField(
													row.id,
													'lastName',
													(event.currentTarget as HTMLInputElement).value
												)}
										/>
									</td>
									<td class="px-3 py-2">
										<div class="flex gap-2">
											<label class="inline-flex items-center gap-1">
												<input
													type="checkbox"
													checked={row.requiredCertCodes.includes('ACLS') ||
														includeAll(row.requiredCertCodes)}
													onchange={(event) =>
														setRowCert(
															row.id,
															'ACLS',
															(event.currentTarget as HTMLInputElement).checked
														)}
												/>
												<span>ACLS</span>
											</label>
											<label class="inline-flex items-center gap-1">
												<input
													type="checkbox"
													checked={row.requiredCertCodes.includes('BLS') ||
														includeAll(row.requiredCertCodes)}
													onchange={(event) =>
														setRowCert(
															row.id,
															'BLS',
															(event.currentTarget as HTMLInputElement).checked
														)}
												/>
												<span>BLS</span>
											</label>
											<label class="inline-flex items-center gap-1">
												<input
													type="checkbox"
													checked={row.requiredCertCodes.includes('PALS') ||
														includeAll(row.requiredCertCodes)}
													onchange={(event) =>
														setRowCert(
															row.id,
															'PALS',
															(event.currentTarget as HTMLInputElement).checked
														)}
												/>
												<span>PALS</span>
											</label>
										</div>
									</td>
									<td
										class="px-3 py-2 {row.highlightClass === 'unresolved'
											? 'text-amber-800'
											: 'text-emerald-700'}"
									>
										{row.statusLabel}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#each rowDrafts as row}
					{#if row.includeByDefault}
						<input type="hidden" name={`rows.${row.id}.include`} value="on" />
					{/if}
					<input type="hidden" name={`rows.${row.id}.firstName`} value={row.firstName} />
					<input type="hidden" name={`rows.${row.id}.middleName`} value={row.middleName ?? ''} />
					<input type="hidden" name={`rows.${row.id}.lastName`} value={row.lastName} />
					{#each row.requiredCertCodes as certCode}
						<input type="hidden" name={`rows.${row.id}.certs`} value={certCode} />
					{/each}
				{/each}

				{#each duplicateGroups() as group}
					<input
						type="hidden"
						name={`duplicateDecision.${encodedDuplicateKey(group.key)}`}
						value={selectedDuplicateDecision(group.key)}
					/>
				{/each}

				<button type="submit" class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">
					Save selected rows
				</button>
			</form>
		</section>
	{/if}
</section>
