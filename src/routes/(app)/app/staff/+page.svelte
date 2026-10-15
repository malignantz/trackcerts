<script lang="ts">
	import { FIXED_CERTIFICATION_CODES } from '$lib/certifications';

	let { data, form } = $props();

	const isSelected = (code: string) => data.selectedFilters.includes(code);

	type RequirementVisualState =
		| 'required_verified'
		| 'required_unverified'
		| 'optional_verified'
		| 'optional_unverified';

	const requirementStateOrder: RequirementVisualState[] = [
		'required_verified',
		'required_unverified',
		'optional_unverified',
		'optional_verified'
	];

	const requirementStateMeta: Record<
		RequirementVisualState,
		{ icon: string; label: string; title: string; className: string }
	> = {
		required_verified: {
			icon: '☑',
			label: 'Required + Verified',
			title: 'Required and verified',
			className: 'border-emerald-500 bg-emerald-100 text-emerald-900'
		},
		required_unverified: {
			icon: '☐',
			label: 'Required',
			title: 'Required and not yet verified',
			className: 'border-rose-300 bg-rose-100 text-rose-900'
		},
		optional_unverified: {
			icon: '—',
			label: 'Not Required',
			title: 'Not required',
			className: 'border-slate-300 bg-slate-200 text-slate-600'
		},
		optional_verified: {
			icon: '☑',
			label: 'Not Required + Verified',
			title: 'Not required but verified',
			className: 'border-slate-400 bg-slate-200 text-slate-700'
		}
	};

	const getRequirementState = (
		isRequired: boolean,
		isVerified: boolean
	): RequirementVisualState => {
		if (isRequired && isVerified) {
			return 'required_verified';
		}
		if (isRequired) {
			return 'required_unverified';
		}
		if (isVerified) {
			return 'optional_verified';
		}
		return 'optional_unverified';
	};
</script>

<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-semibold text-slate-900">Staff requirements</h2>
			<p class="text-slate-600">
				Manage required certifications and track verification status by staff member.
			</p>
		</div>
		<a
			class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
			href="/app/onboarding/staff"
		>
			Import staff batch
		</a>
	</div>

	<form method="GET" class="mt-4 flex flex-wrap items-center gap-2">
		<span class="mr-1 text-sm text-slate-600">Show:</span>
		<label class="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm">
			<input type="checkbox" name="show" value="ALL" checked={isSelected('ALL')} />
			<span>ALL</span>
		</label>
		{#each FIXED_CERTIFICATION_CODES as certCode}
			<label
				class="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm"
			>
				<input type="checkbox" name="show" value={certCode} checked={isSelected(certCode)} />
				<span>{certCode}</span>
			</label>
		{/each}
		<button class="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">Apply</button>
	</form>

	{#if form?.error}
		<p class="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
			{form.error}
		</p>
	{/if}

	<div class="mt-4 flex flex-wrap items-center gap-2 text-xs">
		<span class="text-slate-500">Legend:</span>
		{#each requirementStateOrder as state}
			{@const meta = requirementStateMeta[state]}
			<span class={`inline-flex items-center gap-1 rounded border px-2 py-1 ${meta.className}`}>
				<span aria-hidden="true" class="font-semibold">{meta.icon}</span>
				<span>{meta.label}</span>
			</span>
		{/each}
	</div>

	<div class="mt-6 overflow-x-auto">
		<table class="min-w-full divide-y divide-slate-200">
			<thead>
				<tr class="text-left text-sm text-slate-500">
					<th class="py-2">Staff member</th>
					<th class="py-2">Status</th>
					{#each FIXED_CERTIFICATION_CODES as certCode}
						<th class="py-2">{certCode}</th>
					{/each}
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100 text-sm">
				{#if data.staffRows.length === 0}
					<tr>
						<td class="py-4 text-slate-500" colspan="5">No staff records match this filter.</td>
					</tr>
				{:else}
					{#each data.staffRows as row}
						<tr>
							<td class="py-3 align-top">
								<form method="POST" action="?/updateStaffName" class="flex flex-wrap gap-2">
									<input type="hidden" name="staffId" value={row.id} />
									<input
										name="firstName"
										value={row.firstName}
										class="w-28 rounded border border-slate-300 px-2 py-1"
									/>
									<input
										name="middleName"
										value={row.middleName ?? ''}
										placeholder="Middle"
										class="w-24 rounded border border-slate-300 px-2 py-1"
									/>
									<input
										name="lastName"
										value={row.lastName}
										class="w-28 rounded border border-slate-300 px-2 py-1"
									/>
									<button class="rounded border border-slate-300 px-2 py-1 text-xs">Save</button>
								</form>
							</td>
							<td class="py-3 align-top">
								<span class={row.isActive ? 'text-emerald-700' : 'text-slate-500'}>
									{row.isActive ? 'Active' : 'Inactive'}
								</span>
							</td>
							{#each FIXED_CERTIFICATION_CODES as certCode}
								{@const state = getRequirementState(row.required[certCode], row.verified[certCode])}
								{@const meta = requirementStateMeta[state]}
								<td class="py-3 align-top">
									<form method="POST" action="?/toggleRequirement">
										<input type="hidden" name="staffId" value={row.id} />
										<input type="hidden" name="certCode" value={certCode} />
										<input
											type="hidden"
											name="isRequired"
											value={row.required[certCode] ? 'true' : 'false'}
										/>
										<button
											class={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${meta.className}`}
											title={meta.title}
										>
											<span aria-hidden="true" class="font-semibold">{meta.icon}</span>
											<span>{meta.label}</span>
										</button>
									</form>
								</td>
							{/each}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</section>
