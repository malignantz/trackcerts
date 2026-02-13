<script lang="ts">
	import { FIXED_CERTIFICATION_CODES } from '$lib/certifications';

	let { data, form } = $props();
</script>

<section class="mx-auto mt-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
	<h1 class="text-2xl font-semibold text-slate-900">Certification verification</h1>
	<p class="mt-2 text-slate-600">
		Organization: <span class="font-medium">{data.organizationName}</span>
	</p>
	<p class="text-sm text-slate-500">Site code: {data.siteCode}</p>

	{#if form?.error}
		<p class="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
			{form.error}
		</p>
	{/if}

	{#if form?.success}
		<p
			class="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
		>
			Submission received. Receipt ID: {form.receiptId}. Verification is processing in the
			background.
		</p>
	{/if}

	<div class="mt-6 grid gap-6 md:grid-cols-2">
		<form
			method="POST"
			action="?/submitEcard"
			class="space-y-3 rounded-xl border border-slate-200 p-4"
		>
			<h2 class="text-lg font-semibold text-slate-900">Name + eCard code</h2>
			<p class="text-sm text-slate-600">
				Provide your name and one eCard code per required certification.
			</p>

			<input
				name="firstName"
				required
				placeholder="First name"
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
			<input
				name="middleName"
				placeholder="Middle name / initial (optional)"
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
			<input
				name="lastName"
				required
				placeholder="Last name"
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
			/>

			{#each FIXED_CERTIFICATION_CODES as certCode}
				<label class="block">
					<span class="mb-1 block text-sm text-slate-700">{certCode} eCard code</span>
					<input
						name={`ecard${certCode}`}
						placeholder={`${certCode}-1234`}
						class="w-full rounded-lg border border-slate-300 px-3 py-2"
					/>
				</label>
			{/each}

			<button class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">
				Submit eCard codes
			</button>
		</form>

		<form
			method="POST"
			action="?/lookupByEmail"
			class="space-y-3 rounded-xl border border-slate-200 p-4"
		>
			<h2 class="text-lg font-semibold text-slate-900">Name + email lookup</h2>
			<p class="text-sm text-slate-600">Use this if you do not have your eCard codes available.</p>

			<input
				name="firstName"
				required
				placeholder="First name"
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
			<input
				name="middleName"
				placeholder="Middle name / initial (optional)"
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
			<input
				name="lastName"
				required
				placeholder="Last name"
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
			/>
			<input
				name="email"
				required
				type="email"
				placeholder="you@example.com"
				class="w-full rounded-lg border border-slate-300 px-3 py-2"
			/>

			<button class="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">
				Find and verify my eCards
			</button>
		</form>
	</div>
</section>
