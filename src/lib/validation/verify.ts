import { z } from 'zod';

import { certCodeSchema } from './requirements';

const nameSchema = z
	.string()
	.trim()
	.min(1, 'Required')
	.max(80, 'Must be at most 80 characters')
	.regex(/^[A-Za-z' -]+$/, 'Use letters, apostrophes, spaces, or hyphens only');

const ecardSchema = z
	.string()
	.trim()
	.min(4, 'eCard code must be at least 4 characters')
	.max(120, 'eCard code must be at most 120 characters');

export const submitEcardSchema = z.object({
	firstName: nameSchema,
	middleName: z
		.string()
		.trim()
		.max(80)
		.optional()
		.transform((value) => (value ? value : null)),
	lastName: nameSchema,
	ecardCodes: z.record(certCodeSchema, ecardSchema)
});

export const lookupByEmailSchema = z.object({
	firstName: nameSchema,
	middleName: z
		.string()
		.trim()
		.max(80)
		.optional()
		.transform((value) => (value ? value : null)),
	lastName: nameSchema,
	email: z.email('Enter a valid email address')
});
