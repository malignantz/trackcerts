const SITE_CODE_LENGTH = 8;

export function normalizeSiteCode(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '')
		.slice(0, SITE_CODE_LENGTH);
}

export function deriveSiteCodeFromSlug(slug: string): string {
	const normalized = normalizeSiteCode(slug);
	return normalized.length > 0 ? normalized : generateRandomSiteCode();
}

export function generateRandomSiteCode(): string {
	const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
	let code = '';

	for (let i = 0; i < SITE_CODE_LENGTH; i += 1) {
		code += alphabet[Math.floor(Math.random() * alphabet.length)];
	}

	return code;
}
