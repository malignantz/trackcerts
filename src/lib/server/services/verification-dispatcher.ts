import { eq } from 'drizzle-orm';

import { getDb, ecardEntries } from '$lib/server/db';
import { ecardProviderClient } from './ecard-provider';

export const MAX_ECARD_BATCH_SIZE = 20;

export interface VerificationDispatcher {
	enqueueSubmission(submissionId: string): Promise<void>;
}

export function chunkEntries<T>(entries: T[], chunkSize: number): T[][] {
	if (chunkSize <= 0) {
		return [entries];
	}

	const chunks: T[][] = [];
	for (let index = 0; index < entries.length; index += chunkSize) {
		chunks.push(entries.slice(index, index + chunkSize));
	}
	return chunks;
}

class ChunkedVerificationDispatcher implements VerificationDispatcher {
	async enqueueSubmission(submissionId: string): Promise<void> {
		const db = getDb();
		const entries = await db
			.select({
				id: ecardEntries.id,
				ecardCode: ecardEntries.ecardCode
			})
			.from(ecardEntries)
			.where(eq(ecardEntries.submissionId, submissionId));

		const chunks = chunkEntries(entries, MAX_ECARD_BATCH_SIZE);
		for (const chunk of chunks) {
			if (chunk.length === 0) {
				continue;
			}

			const results = await ecardProviderClient.verifyEcardBatch(
				chunk.map((entry) => ({
					ecardEntryId: entry.id,
					ecardCode: entry.ecardCode
				}))
			);

			for (const result of results) {
				await db
					.update(ecardEntries)
					.set({
						status: result.status,
						lastError: result.error ?? null,
						updatedAt: new Date()
					})
					.where(eq(ecardEntries.id, result.ecardEntryId));
			}
		}
	}
}

export const verificationDispatcher: VerificationDispatcher = new ChunkedVerificationDispatcher();
