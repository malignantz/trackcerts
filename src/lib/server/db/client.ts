import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { getServerEnv } from '$lib/server/env';

import * as schema from './schema';

const DEFAULT_LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/trackcerts';

const globalDb = globalThis as unknown as {
	pool: Pool | undefined;
	db: ReturnType<typeof drizzle<typeof schema>> | undefined;
	localDbVerified: boolean | undefined;
	localDbVerifyPromise: Promise<void> | undefined;
};

function resolveConnectionConfig() {
	const env = getServerEnv();
	const isLocalDevMode = process.env.NODE_ENV !== 'production' && env.DEV_DB_MODE === 'local';
	const connectionString = isLocalDevMode
		? env.LOCAL_DATABASE_URL ?? DEFAULT_LOCAL_DATABASE_URL
		: env.DATABASE_URL;

	return {
		connectionString,
		isLocalDevMode
	};
}

export function getPool(): Pool {
	if (!globalDb.pool) {
		const { connectionString } = resolveConnectionConfig();

		globalDb.pool = new Pool({
			connectionString
		});
	}

	return globalDb.pool;
}

export function getDb() {
	if (!globalDb.db) {
		globalDb.db = drizzle(getPool(), { schema });
	}

	return globalDb.db;
}

export async function ensureLocalDevDatabaseReachable(): Promise<void> {
	const { isLocalDevMode, connectionString } = resolveConnectionConfig();
	if (!isLocalDevMode) {
		return;
	}
	if (globalDb.localDbVerified) {
		return;
	}
	if (globalDb.localDbVerifyPromise) {
		return globalDb.localDbVerifyPromise;
	}

	globalDb.localDbVerifyPromise = (async () => {
		try {
			await getPool().query('select 1');
			globalDb.localDbVerified = true;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(
				`Local DB mode is enabled, but the local database is unreachable at ${connectionString}. ` +
					`Start local Postgres (for example: "docker compose up -d postgres") or switch DEV_DB_MODE back to "remote". ` +
					`Original error: ${message}`
			);
		} finally {
			globalDb.localDbVerifyPromise = undefined;
		}
	})();

	return globalDb.localDbVerifyPromise;
}
