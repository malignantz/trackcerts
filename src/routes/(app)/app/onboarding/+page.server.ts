import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { canUserBootstrapOrganization } from '$lib/server/auth/memberships';
import { createOrganizationForOwner, organizationSlugExists } from '$lib/server/org/service';
import { deriveOrganizationSlug, normalizeOrganizationSlug } from '$lib/server/org/slug';
import { createOrganizationSchema } from '$lib/validation/organization';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.membership) {
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
	default: async ({ request, locals }) => {
		if (!locals.user?.email) {
			throw redirect(303, '/login');
		}

		const canBootstrap = await canUserBootstrapOrganization();
		if (!canBootstrap) {
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

		await createOrganizationForOwner({
			userId: locals.user.id,
			email: locals.user.email,
			name: parsed.data.name,
			slug: candidateSlug
		});

		throw redirect(303, '/app/staff');
	}
};
