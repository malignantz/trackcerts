import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import {
	createCertificationType,
	listCertificationTypes,
	setCertificationTypeActive,
	updateCertificationType
} from '$lib/server/org/certification-types';
import { isUniqueViolation } from '$lib/server/db/errors';
import {
	createCertificationTypeSchema,
	toggleCertificationTypeSchema,
	updateCertificationTypeSchema
} from '$lib/validation/certification';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.membership) {
		throw redirect(303, '/app/onboarding');
	}

	const certifications = await listCertificationTypes(locals.membership.organizationId);
	return {
		certifications
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.membership) {
			throw redirect(303, '/app/onboarding');
		}

		const formData = await request.formData();
		const parsed = createCertificationTypeSchema.safeParse({
			code: formData.get('code'),
			label: formData.get('label')
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'create',
				error: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}

		try {
			await createCertificationType(locals.membership.organizationId, parsed.data);
		} catch (error) {
			if (isUniqueViolation(error, 'certification_types_org_code_unique')) {
				return fail(409, {
					action: 'create',
					error: 'That certification code already exists for this organization.'
				});
			}

			throw error;
		}

		return { success: true };
	},
	update: async ({ request, locals }) => {
		if (!locals.membership) {
			throw redirect(303, '/app/onboarding');
		}

		const formData = await request.formData();
		const parsed = updateCertificationTypeSchema.safeParse({
			id: formData.get('id'),
			code: formData.get('code'),
			label: formData.get('label')
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'update',
				error: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}

		try {
			await updateCertificationType(locals.membership.organizationId, parsed.data.id, parsed.data);
		} catch (error) {
			if (isUniqueViolation(error, 'certification_types_org_code_unique')) {
				return fail(409, {
					action: 'update',
					error: 'That certification code already exists for this organization.'
				});
			}

			throw error;
		}

		return { success: true };
	},
	toggle: async ({ request, locals }) => {
		if (!locals.membership) {
			throw redirect(303, '/app/onboarding');
		}

		const formData = await request.formData();
		const parsed = toggleCertificationTypeSchema.safeParse({
			id: formData.get('id'),
			isActive: formData.get('isActive') === 'true'
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'toggle',
				error: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}

		await setCertificationTypeActive(
			locals.membership.organizationId,
			parsed.data.id,
			!parsed.data.isActive
		);
		return { success: true };
	}
};
