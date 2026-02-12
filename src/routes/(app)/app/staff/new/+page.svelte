<script lang="ts">
	let { form } = $props();
</script>

<section class="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
	<h2 class="text-2xl font-semibold text-slate-900">Add staff member</h2>
	<p class="mt-2 text-slate-600">Create one employee record at a time for Phase 1.</p>

	<form method="POST" class="mt-6 space-y-4">
		<label class="block">
			<span class="mb-1 block text-sm font-medium text-slate-700">First name</span>
			<input
				name="firstName"
				required
				value={form?.firstName ?? ''}
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
		</label>

		<label class="block">
			<span class="mb-1 block text-sm font-medium text-slate-700">Last name</span>
			<input
				name="lastName"
				required
				value={form?.lastName ?? ''}
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
		</label>

		<div class="flex gap-3">
			<button type="submit" class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">
				Save
			</button>
			<a
				href="/app/staff"
				class="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700">Cancel</a
			>
		</div>
	</form>

	{#if form?.error}
		<p class="mt-4 text-sm text-red-700">{form.error}</p>
	{/if}
</section>
