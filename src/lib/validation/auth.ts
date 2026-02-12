import { z } from 'zod';

export const magicLinkEmailSchema = z.object({
	email: z.email('Enter a valid email address').transform((value) => value.toLowerCase().trim())
});
