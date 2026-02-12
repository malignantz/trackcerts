import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { getServerEnv } from '$lib/server/env';

import * as schema from './schema';

const globalDb = globalThis as unknown as {
	pool: Pool | undefined;
	db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

export function getPool(): Pool {
	if (!globalDb.pool) {
		const env = getServerEnv();
		globalDb.pool = new Pool({
			connectionString: env.DATABASE_URL
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
