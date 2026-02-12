import { expect, test } from '@playwright/test';

test('login page renders', async ({ page }) => {
	await page.goto('/login');
	await expect(page.getByRole('heading', { name: 'Manager Sign In' })).toBeVisible();
});

test('protected app routes redirect to login when unauthenticated', async ({ page }) => {
	await page.goto('/app/staff');
	await expect(page).toHaveURL(/\/login$/);
});
