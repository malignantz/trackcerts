import { getDb } from '$lib/server/db';
import { auditLogs } from '$lib/server/db/schema';

interface AccessDeniedPayload {
	organizationId?: string | null;
	actorId?: string | null;
	path: string;
	reason: string;
}

export async function logAccessDenied(payload: AccessDeniedPayload): Promise<void> {
	try {
		const db = getDb();
		await db.insert(auditLogs).values({
			organizationId: payload.organizationId ?? null,
			actorType: 'user',
			actorId: payload.actorId ?? null,
			eventType: 'access_denied',
			payloadJson: {
				path: payload.path,
				reason: payload.reason
			}
		});
	} catch (error) {
		console.warn('Failed to persist access denied audit log', error);
	}
}
