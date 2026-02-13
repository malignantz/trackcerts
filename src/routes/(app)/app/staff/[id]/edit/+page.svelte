<script lang="ts">
	let { data, form } = $props();
</script>

<section class="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
	<h2 class="text-2xl font-semibold text-slate-900">Edit staff member</h2>

	<form method="POST" action="?/update" class="mt-6 space-y-4">
		<label class="block">
			<span class="mb-1 block text-sm font-medium text-slate-700">First name</span>
			<input
				name="firstName"
				required
				value={data.record.firstName}
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
		</label>

		<label class="block">
			<span class="mb-1 block text-sm font-medium text-slate-700"
				>Middle name / initial (optional)</span
			>
			<input
				name="middleName"
				value={data.record.middleName ?? ''}
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
		</label>

		<label class="block">
			<span class="mb-1 block text-sm font-medium text-slate-700">Last name</span>
			<input
				name="lastName"
				required
				value={data.record.lastName}
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
		</label>

		<label class="flex items-center gap-2 text-sm text-slate-700">
			<input type="checkbox" name="isActive" checked={data.record.isActive} />
			<span>Active</span>
		</label>

		<div class="flex flex-wrap gap-3">
			<button type="submit" class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white"
				>Save</button
			>
			<a
				href="/app/staff"
				class="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700">Cancel</a
			>
		</div>
	</form>

	<form method="POST" action="?/deactivate" class="mt-4">
		<button
			type="submit"
			class="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700"
		>
			Deactivate employee
		</button>
	</form>

	{#if form?.error}
		<p class="mt-4 text-sm text-red-700">{form.error}</p>
	{/if}
</section>
