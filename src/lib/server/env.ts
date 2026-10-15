import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const booleanFromEnv = z.preprocess((value) => {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (['1', 'true', 'yes', 'on'].includes(normalized)) {
			return true;
		}
		if (['0', 'false', 'no', 'off'].includes(normalized)) {
			return false;
		}
	}
	return value;
}, z.boolean());

const serverEnvSchema = z.object({
	SUPABASE_URL: z.url(),
	SUPABASE_ANON_KEY: z.string().min(1),
	SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
	DATABASE_URL: z.string().min(1),
	APP_URL: z.url(),
	DEV_DB_MODE: z.enum(['remote', 'local']).optional(),
	LOCAL_DATABASE_URL: z.string().min(1).optional(),
	WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
	WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
	WORKER_DIRECT_BATCH_SIZE: z.coerce.number().int().positive().max(20).default(20),
	WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(1),
	WORKER_HEADLESS: booleanFromEnv.default(true),
	HEART_PROVIDER_MODE: z.enum(['noop', 'live']).default('noop'),
	HEART_PROVIDER_EMAIL: z.string().min(1).optional(),
	HEART_PROVIDER_PASSWORD: z.string().min(1).optional(),
	HEART_PROVIDER_BASE_URL: z.url().default('https://ecards.heart.org/student/myecards')
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

const testDefaults: ServerEnv = {
	SUPABASE_URL: 'http://localhost:54321',
	SUPABASE_ANON_KEY: 'test-anon-key',
	SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
	DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/trackcerts',
	APP_URL: 'http://localhost:5173',
	DEV_DB_MODE: 'local',
	LOCAL_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/trackcerts',
	WORKER_CONCURRENCY: 1,
	WORKER_POLL_INTERVAL_MS: 15_000,
	WORKER_DIRECT_BATCH_SIZE: 20,
	WORKER_MAX_ATTEMPTS: 1,
	WORKER_HEADLESS: true,
	HEART_PROVIDER_MODE: 'noop',
	HEART_PROVIDER_BASE_URL: 'https://ecards.heart.org/student/myecards'
};

function readDotEnvFallback(): Record<string, string> {
	const envPath = resolve(process.cwd(), '.env');
	if (!existsSync(envPath)) {
		return {};
	}

	const content = readFileSync(envPath, 'utf8');
	const values: Record<string, string> = {};
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}

		const separator = line.indexOf('=');
		if (separator < 1) {
			continue;
		}

		const key = line.slice(0, separator).trim();
		let value = line.slice(separator + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		values[key] = value;
	}

	return values;
}

export function getServerEnv(): ServerEnv {
	if (cachedEnv) {
		return cachedEnv;
	}

	if (process.env.NODE_ENV === 'test') {
		cachedEnv = testDefaults;
		return cachedEnv;
	}

	const parsed = serverEnvSchema.safeParse({
		...readDotEnvFallback(),
		...process.env
	});
	if (!parsed.success) {
		const messages = parsed.error.issues
			.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
			.join('\n');

		throw new Error(`Invalid server environment configuration:\n${messages}`);
	}

	cachedEnv = parsed.data;
	return cachedEnv;
}
