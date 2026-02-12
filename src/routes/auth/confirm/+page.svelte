<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let errorMessage: string | null = null;

	onMount(async () => {
		const hashParams = new URLSearchParams(
			window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
		);
		const queryParams = new URLSearchParams(window.location.search);
		const authError =
			hashParams.get('error_description') ?? queryParams.get('error_description') ?? null;

		if (authError) {
			await goto(`/login?error=${encodeURIComponent(authError)}`, {
				replaceState: true
			});
			return;
		}

		const accessToken = hashParams.get('access_token');
		const refreshToken = hashParams.get('refresh_token');

		if (!accessToken || !refreshToken) {
			await goto('/login?error=Invalid%20or%20expired%20auth%20link', {
				replaceState: true
			});
			return;
		}

		const response = await fetch('/auth/session', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				accessToken,
				refreshToken
			})
		});

		if (!response.ok) {
			const payload = (await response.json().catch(() => null)) as { message?: string } | null;
			errorMessage = payload?.message ?? 'Could not complete sign in. Please request a new link.';
			return;
		}

		await goto('/app', { replaceState: true });
	});
</script>

<div class="min-h-screen p-6 md:p-12">
	<div class="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
		<p class="mb-2 text-sm font-semibold tracking-wide text-slate-500">TrackCerts</p>
		<h1 class="mb-2 text-3xl font-bold text-slate-900">Completing sign in...</h1>
		<p class="text-slate-600">Please wait while we verify your secure login link.</p>

		{#if errorMessage}
			<p class="mt-4 text-sm text-red-700">{errorMessage}</p>
		{/if}
	</div>
</div>
