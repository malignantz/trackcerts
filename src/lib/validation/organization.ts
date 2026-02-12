import { z } from 'zod';

import { normalizeOrganizationSlug } from '$lib/server/org/slug';

export const createOrganizationSchema = z.object({
	name: z.string().trim().min(2, 'Organization name must be at least 2 characters').max(120),
	slug: z
		.string()
		.trim()
		.min(2, 'Slug must be at least 2 characters')
		.max(50)
		.regex(/^[a-z0-9-]+$/, 'Slug can only include lowercase letters, numbers, and hyphens')
		.transform((value) => normalizeOrganizationSlug(value))
		.optional()
});
