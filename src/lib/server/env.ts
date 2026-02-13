import { z } from 'zod';
import { env as privateEnv } from '$env/dynamic/private';

const serverEnvSchema = z.object({
	SUPABASE_URL: z.url(),
	SUPABASE_ANON_KEY: z.string().min(1),
	SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
	DATABASE_URL: z.string().min(1),
	APP_URL: z.url(),
	DEV_DB_MODE: z.enum(['remote', 'local']).optional(),
	LOCAL_DATABASE_URL: z.string().min(1).optional()
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
	LOCAL_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/trackcerts'
};

export function getServerEnv(): ServerEnv {
	if (cachedEnv) {
		return cachedEnv;
	}

	const parsed = serverEnvSchema.safeParse({
		...process.env,
		...privateEnv
	});
	if (!parsed.success) {
		if (process.env.NODE_ENV === 'test') {
			cachedEnv = testDefaults;
			return cachedEnv;
		}

		const messages = parsed.error.issues
			.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
			.join('\n');

		throw new Error(`Invalid server environment configuration:\n${messages}`);
	}

	cachedEnv = parsed.data;
	return cachedEnv;
}
