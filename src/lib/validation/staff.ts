import { z } from 'zod';

const nameSchema = z
	.string()
	.trim()
	.min(1, 'Required')
	.max(80, 'Must be at most 80 characters')
	.regex(/^[A-Za-z' -]+$/, 'Use letters, apostrophes, spaces, or hyphens only');

const optionalMiddleSchema = z
	.string()
	.trim()
	.max(80, 'Must be at most 80 characters')
	.regex(/^[A-Za-z' -]*$/, 'Use letters, apostrophes, spaces, or hyphens only')
	.optional()
	.transform((value) => {
		if (!value) {
			return null;
		}
		return value;
	});

export const createStaffSchema = z.object({
	firstName: nameSchema,
	middleName: optionalMiddleSchema,
	lastName: nameSchema
});

export const updateStaffSchema = z.object({
	firstName: nameSchema,
	middleName: optionalMiddleSchema,
	lastName: nameSchema,
	isActive: z.boolean().default(true)
});
