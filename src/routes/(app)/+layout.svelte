<script lang="ts">
	import { page } from '$app/state';

	let { children, data } = $props();

	const nav = [{ href: '/app/staff', label: 'Staff' }];
</script>

<div class="min-h-screen p-4 md:p-8">
	<div class="mx-auto max-w-6xl">
		<header class="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">TrackCerts</p>
					<h1 class="text-xl font-semibold text-slate-900">
						{data.membership?.organizationName ?? 'Organization setup'}
					</h1>
					<p class="text-sm text-slate-600">{data.userEmail}</p>
					{#if data.membership?.organizationSiteCode}
						<p class="text-xs text-slate-500">Site code: {data.membership.organizationSiteCode}</p>
					{/if}
				</div>

				<form method="POST" action="/app/logout">
					<button
						class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
					>
						Log out
					</button>
				</form>
			</div>

			{#if data.membership}
				<nav class="mt-4 flex flex-wrap gap-2">
					{#each nav as item}
						<a
							href={item.href}
							class="rounded-md px-3 py-2 text-sm font-medium {page.url.pathname.startsWith(
								item.href
							)
								? 'bg-emerald-100 text-emerald-900'
								: 'text-slate-700 hover:bg-slate-100'}"
						>
							{item.label}
						</a>
					{/each}
				</nav>
			{/if}
		</header>

		{@render children()}
	</div>
</div>
