import { and, eq } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { getDb, submissions } from '$lib/server/db';
import { verificationDispatcher } from '$lib/server/services/verification-dispatcher';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user || !locals.membership) {
		throw error(401, 'Unauthorized');
	}

	const db = getDb();
	const [submission] = await db
		.select({ id: submissions.id })
		.from(submissions)
		.where(
			and(
				eq(submissions.id, params.id),
				eq(submissions.organizationId, locals.membership.organizationId)
			)
		)
		.limit(1);

	if (!submission) {
		throw error(404, 'Submission not found for this organization');
	}

	await verificationDispatcher.enqueueSubmission(submission.id);

	return json({
		status: 'queued_stub',
		submissionId: submission.id
	});
};
