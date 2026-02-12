import { z } from 'zod';

export const createCertificationTypeSchema = z.object({
	code: z
		.string()
		.trim()
		.toUpperCase()
		.min(2, 'Code must be at least 2 characters')
		.max(30)
		.regex(/^[A-Z0-9_]+$/, 'Code can include uppercase letters, numbers, and underscores only'),
	label: z.string().trim().min(2, 'Label must be at least 2 characters').max(120)
});

export const updateCertificationTypeSchema = createCertificationTypeSchema.extend({
	id: z.uuid()
});

export const toggleCertificationTypeSchema = z.object({
	id: z.uuid(),
	isActive: z.boolean()
});
