<script lang="ts">
	let { data, form } = $props();

	const getNameValue = () => (form && 'name' in form ? String(form.name ?? '') : '');
	const getSlugValue = () => (form && 'slug' in form ? String(form.slug ?? '') : '');
</script>

<section
	class="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
>
	<h2 class="text-2xl font-semibold text-slate-900">Organization setup</h2>
	<p class="mt-2 text-slate-600">
		Create your organization to unlock staff roster management and certification tracking.
	</p>

	{#if data.error}
		<p class="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
			{data.error}
		</p>
	{/if}

	{#if data.canBootstrap}
		<form method="POST" class="mt-6 space-y-4">
			<label class="block">
				<span class="mb-1 block text-sm font-medium text-slate-700">Organization name</span>
				<input
					name="name"
					required
					value={getNameValue()}
					class="w-full rounded-lg border border-slate-300 px-3 py-2"
				/>
			</label>

			<label class="block">
				<span class="mb-1 block text-sm font-medium text-slate-700">URL slug (optional)</span>
				<input
					name="slug"
					placeholder="hospital"
					value={getSlugValue()}
					class="w-full rounded-lg border border-slate-300 px-3 py-2"
				/>
			</label>

			<button
				type="submit"
				class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-600"
			>
				Create organization
			</button>
		</form>

		{#if form?.error}
			<p class="mt-4 text-sm text-red-700">{form.error}</p>
		{/if}
	{/if}
</section>
