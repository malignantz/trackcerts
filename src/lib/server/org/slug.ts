const MAX_SLUG_LENGTH = 50;

export function normalizeOrganizationSlug(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+/, '')
		.replace(/-+$/, '')
		.slice(0, MAX_SLUG_LENGTH);
}

export function deriveOrganizationSlug(name: string): string {
	const normalized = normalizeOrganizationSlug(name);
	return normalized.length > 0 ? normalized : 'organization';
}
