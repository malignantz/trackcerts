<script lang="ts">
	let { data, form } = $props();
</script>

<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
	<h2 class="text-2xl font-semibold text-slate-900">Certification types</h2>
	<p class="mt-2 text-slate-600">Configure organization-specific certificate requirements.</p>

	<form method="POST" action="?/create" class="mt-6 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
		<input
			name="code"
			placeholder="BLS"
			required
			class="rounded-lg border border-slate-300 px-3 py-2"
		/>
		<input
			name="label"
			placeholder="Basic Life Support"
			required
			class="rounded-lg border border-slate-300 px-3 py-2"
		/>
		<button type="submit" class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white"
			>Add</button
		>
	</form>

	{#if form?.error}
		<p class="mt-4 text-sm text-red-700">{form.error}</p>
	{/if}

	<div class="mt-6 space-y-4">
		{#if data.certifications.length === 0}
			<p class="text-slate-500">No certification types yet.</p>
		{:else}
			{#each data.certifications as cert}
				<div class="rounded-xl border border-slate-200 p-4">
					<form method="POST" action="?/update" class="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
						<input type="hidden" name="id" value={cert.id} />
						<input
							name="code"
							value={cert.code}
							required
							class="rounded-lg border border-slate-300 px-3 py-2"
						/>
						<input
							name="label"
							value={cert.label}
							required
							class="rounded-lg border border-slate-300 px-3 py-2"
						/>
						<button class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
							>Save</button
						>
					</form>

					<form method="POST" action="?/toggle" class="mt-3">
						<input type="hidden" name="id" value={cert.id} />
						<input type="hidden" name="isActive" value={cert.isActive ? 'true' : 'false'} />
						<button
							class="rounded-lg px-3 py-2 text-sm font-medium {cert.isActive
								? 'border border-amber-300 text-amber-700'
								: 'border border-emerald-300 text-emerald-700'}"
						>
							{cert.isActive ? 'Deactivate' : 'Activate'}
						</button>
					</form>
				</div>
			{/each}
		{/if}
	</div>
</section>
