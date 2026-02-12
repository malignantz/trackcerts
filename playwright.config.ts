import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'list',
	use: {
		baseURL: 'http://127.0.0.1:4173',
		trace: 'on-first-retry'
	},
	webServer: {
		command:
			'SUPABASE_URL=http://localhost:54321 SUPABASE_ANON_KEY=test-anon SUPABASE_SERVICE_ROLE_KEY=test-service DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trackcerts APP_URL=http://127.0.0.1:4173 npm run dev -- --host 127.0.0.1 --port 4173',
		url: 'http://127.0.0.1:4173/login',
		reuseExistingServer: !process.env.CI
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
