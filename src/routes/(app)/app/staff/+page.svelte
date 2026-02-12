<script lang="ts">
	let { data } = $props();
</script>

<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-semibold text-slate-900">Staff roster</h2>
			<p class="text-slate-600">Search, edit, and deactivate staff records.</p>
		</div>
		<a
			class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
			href="/app/staff/new"
		>
			Add staff member
		</a>
	</div>

	<form method="GET" class="mt-4">
		<input
			name="q"
			placeholder="Search by first or last name"
			value={data.search}
			class="w-full rounded-lg border border-slate-300 px-3 py-2 md:w-96"
		/>
	</form>

	<div class="mt-6 overflow-x-auto">
		<table class="min-w-full divide-y divide-slate-200">
			<thead>
				<tr class="text-left text-sm text-slate-500">
					<th class="py-2">Name</th>
					<th class="py-2">Status</th>
					<th class="py-2">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.staff.length === 0}
					<tr>
						<td class="py-4 text-slate-500" colspan="3">No staff records yet.</td>
					</tr>
				{:else}
					{#each data.staff as record}
						<tr>
							<td class="py-3 font-medium text-slate-900">{record.firstName} {record.lastName}</td>
							<td class="py-3 text-sm {record.isActive ? 'text-emerald-700' : 'text-slate-500'}">
								{record.isActive ? 'Active' : 'Inactive'}
							</td>
							<td class="py-3 text-sm">
								<a href={`/app/staff/${record.id}/edit`} class="font-medium text-emerald-700"
									>Edit</a
								>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</section>
