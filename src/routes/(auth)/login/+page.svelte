<script lang="ts">
	let { data, form } = $props();
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

			{#if data?.devLoginLinksEnabled}
				<button
					type="submit"
					formaction="?/generateDevLink"
					class="w-full rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
				>
					Generate dev login link
				</button>
			{/if}
		</form>

		{#if form?.error}
			<p class="mt-4 text-sm text-red-700">{form.error}</p>
		{/if}

		{#if data?.loginError}
			<p class="mt-4 text-sm text-red-700">{data.loginError}</p>
		{/if}

		{#if form?.success}
			<p class="mt-4 text-sm text-emerald-700">{form.message}</p>
		{/if}

		{#if form?.devLoginLink}
			<div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
				<p class="text-sm font-medium text-amber-900">Dev login link (temporary)</p>
				<a class="mt-2 block break-all text-sm text-amber-800 underline" href={form.devLoginLink}>
					{form.devLoginLink}
				</a>
			</div>
		{/if}
	</div>
</div>
