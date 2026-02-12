import type { PageServerLoad } from './$types';

import { listStaff } from '$lib/server/staff/repository';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.membership) {
		return {
			staff: [],
			search: ''
		};
	}

	const search = url.searchParams.get('q') ?? '';
	const results = await listStaff({
		organizationId: locals.membership.organizationId,
		search
	});

	return {
		staff: results,
		search
	};
};
