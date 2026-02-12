<script lang="ts">
	let { form } = $props();
</script>

<div class="min-h-screen p-6 md:p-12">
	<div class="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
		<p class="mb-2 text-sm font-semibold tracking-wide text-slate-500">TrackCerts</p>
		<h1 class="mb-2 text-3xl font-bold text-slate-900">Manager Sign In</h1>
		<p class="mb-8 text-slate-600">Use your email and we will send a secure magic link.</p>

		<form method="POST" class="space-y-4">
			<label class="block">
				<span class="mb-1 block text-sm font-medium text-slate-700">Email address</span>
				<input
					name="email"
					type="email"
					required
					value={form?.email ?? ''}
					class="w-full rounded-lg border border-slate-300 px-3 py-2"
				/>
			</label>

			<button
				type="submit"
				class="w-full rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-600"
			>
				Send magic link
			</button>
		</form>

		{#if form?.error}
			<p class="mt-4 text-sm text-red-700">{form.error}</p>
		{/if}

		{#if form?.success}
			<p class="mt-4 text-sm text-emerald-700">{form.message}</p>
		{/if}
	</div>
</div>
