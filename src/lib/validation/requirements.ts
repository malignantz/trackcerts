import { z } from 'zod';

export const certCodeSchema = z.enum(['ACLS', 'BLS', 'PALS']);
export const nameOrderDecisionSchema = z.enum(['first_last', 'last_first']);

export const importPreviewSchema = z.object({
	rawText: z.string().trim().min(1, 'Paste at least one staff name'),
	requiredCertCodes: z.array(certCodeSchema).min(1, 'Select at least one certification'),
	patternDecisions: z.record(z.string(), nameOrderDecisionSchema).optional()
});

export const importCommitRowSchema = z.object({
	firstName: z.string().trim().min(1).max(80),
	middleName: z
		.string()
		.trim()
		.max(80)
		.optional()
		.transform((value: string | undefined) => (value ? value : null)),
	lastName: z.string().trim().min(1).max(80),
	requiredCertCodes: z.array(certCodeSchema).min(1)
});

export const importCommitSchema = z.object({
	rows: z.array(importCommitRowSchema).min(1, 'No staff rows to import')
});

export const toggleRequirementSchema = z.object({
	staffId: z.uuid(),
	certCode: certCodeSchema,
	isRequired: z.boolean()
});

export const updateStaffNameSchema = z.object({
	staffId: z.uuid(),
	firstName: z.string().trim().min(1).max(80),
	middleName: z
		.string()
		.trim()
		.max(80)
		.optional()
		.transform((value: string | undefined) => (value ? value : null)),
	lastName: z.string().trim().min(1).max(80)
});
