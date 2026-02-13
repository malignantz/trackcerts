import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { canUserBootstrapOrganization } from '$lib/server/auth/memberships';
import { logAccessDenied } from '$lib/server/audit/logger';
import { isUniqueViolation } from '$lib/server/db/errors';
import { createOrganizationForOwner, organizationSlugExists } from '$lib/server/org/service';
import { ensureFixedCertificationTypes } from '$lib/server/org/certification-types';
import { deriveOrganizationSlug, normalizeOrganizationSlug } from '$lib/server/org/slug';
import { createOrganizationSchema } from '$lib/validation/organization';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.membership) {
		if (!locals.membership.staffOnboardingComplete) {
			throw redirect(303, '/app/onboarding/staff');
		}
		throw redirect(303, '/app/staff');
	}

	const canBootstrap = await canUserBootstrapOrganization();
	if (!canBootstrap) {
		return {
			canBootstrap,
			error: 'Your account is authenticated, but it is not assigned to any organization.'
		};
	}

	return { canBootstrap, error: null };
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.user?.email) {
			throw redirect(303, '/login');
		}

		const canBootstrap = await canUserBootstrapOrganization();
		if (!canBootstrap) {
			await logAccessDenied({
				actorId: locals.user.id,
				organizationId: null,
				path: url.pathname,
				reason: 'bootstrap_closed'
			});

			return fail(403, {
				error: 'An organization already exists. Ask an owner to add your account.'
			});
		}

		const formData = await request.formData();
		const parsed = createOrganizationSchema.safeParse({
			name: formData.get('name'),
			slug: formData.get('slug')
		});

		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Invalid input',
				name: String(formData.get('name') ?? ''),
				slug: String(formData.get('slug') ?? '')
			});
		}

		const candidateSlug = normalizeOrganizationSlug(
			parsed.data.slug ?? deriveOrganizationSlug(parsed.data.name)
		);
		if (!candidateSlug) {
			return fail(400, {
				error: 'Could not derive a valid slug from the input.',
				name: parsed.data.name,
				slug: parsed.data.slug ?? ''
			});
		}

		if (await organizationSlugExists(candidateSlug)) {
			return fail(409, {
				error: 'That organization slug is already in use.',
				name: parsed.data.name,
				slug: candidateSlug
			});
		}

		try {
			const organization = await createOrganizationForOwner({
				userId: locals.user.id,
				email: locals.user.email,
				name: parsed.data.name,
				slug: candidateSlug
			});
			await ensureFixedCertificationTypes(organization.organizationId);
		} catch (error) {
			if (isUniqueViolation(error, 'organizations_slug_unique')) {
				return fail(409, {
					error: 'That organization slug is already in use.',
					name: parsed.data.name,
					slug: candidateSlug
				});
			}

			throw error;
		}

		throw redirect(303, '/app/onboarding/staff');
	}
};
