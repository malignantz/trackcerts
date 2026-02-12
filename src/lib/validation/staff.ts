import { z } from 'zod';

const nameSchema = z
	.string()
	.trim()
	.min(1, 'Required')
	.max(80, 'Must be at most 80 characters')
	.regex(/^[A-Za-z' -]+$/, 'Use letters, apostrophes, spaces, or hyphens only');

export const createStaffSchema = z.object({
	firstName: nameSchema,
	lastName: nameSchema
});

export const updateStaffSchema = z.object({
	firstName: nameSchema,
	lastName: nameSchema,
	isActive: z.boolean().default(true)
});
