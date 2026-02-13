import { expect, test } from '@playwright/test';

test('onboarding paste preview pre-fills parsed names from TSV with header', async ({ page }) => {
	await page.goto('/e2e/bootstrap');
	await expect(page).toHaveURL(/\/app\/onboarding\/staff$/);

	await page.getByRole('checkbox', { name: 'BLS' }).check();
	await page.evaluate((rawText) => {
		const textarea = document.querySelector('textarea[name="rawText"]');
		if (!(textarea instanceof HTMLTextAreaElement) || !textarea.form) {
			throw new Error('Expected onboarding textarea/form');
		}
		textarea.value = rawText;
		textarea.form.requestSubmit();
	}, 'First Name\tLast Name\nKathy\tJohnson\nJames\tJackson');
	await page.waitForLoadState('networkidle');

	const firstNameInputs = page.locator('input[name$=".firstName"]');
	await expect(firstNameInputs).toHaveCount(2);

	await expect(page.locator('input[name="rows.r0.firstName"]')).toHaveValue('Kathy');
	await expect(page.locator('input[name="rows.r0.lastName"]')).toHaveValue('Johnson');
	await expect(page.locator('input[name="rows.r1.firstName"]')).toHaveValue('James');
	await expect(page.locator('input[name="rows.r1.lastName"]')).toHaveValue('Jackson');
});

test('onboarding paste preview asks once for ambiguous TSV order and applies decision', async ({
	page
}) => {
	await page.goto('/e2e/bootstrap');
	await expect(page).toHaveURL(/\/app\/onboarding\/staff$/);

	await page.getByRole('checkbox', { name: 'BLS' }).check();
	await page.evaluate((rawText) => {
		const textarea = document.querySelector('textarea[name="rawText"]');
		if (!(textarea instanceof HTMLTextAreaElement) || !textarea.form) {
			throw new Error('Expected onboarding textarea/form');
		}
		textarea.value = rawText;
		textarea.form.requestSubmit();
	}, 'James\tJackson\nAmy\tChen');
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('heading', { name: 'Confirm name order' })).toBeVisible();
	await page.locator('input[name^="patternDecision."][value="first_last"]').first().check();
	await page.getByRole('button', { name: 'Apply and re-parse' }).click();

	const firstNameInputs = page.locator('input[name$=".firstName"]');
	await expect(firstNameInputs).toHaveCount(2);
	await expect(page.locator('input[name="rows.r0.firstName"]')).toHaveValue('James');
	await expect(page.locator('input[name="rows.r0.lastName"]')).toHaveValue('Jackson');
	await expect(page.locator('input[name="rows.r1.firstName"]')).toHaveValue('Amy');
	await expect(page.locator('input[name="rows.r1.lastName"]')).toHaveValue('Chen');
});

test('onboarding paste preview asks for all mixed TSV name formats and applies decisions', async ({
	page
}) => {
	await page.goto('/e2e/bootstrap');
	await expect(page).toHaveURL(/\/app\/onboarding\/staff$/);

	await page.getByRole('checkbox', { name: 'BLS' }).check();
	await page.evaluate((rawText) => {
		const textarea = document.querySelector('textarea[name="rawText"]');
		if (!(textarea instanceof HTMLTextAreaElement) || !textarea.form) {
			throw new Error('Expected onboarding textarea/form');
		}
		textarea.value = rawText;
		textarea.form.requestSubmit();
	}, 'James\tJackson\nMary Ann\tChen\nLopez, Maria');
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('heading', { name: 'Confirm name order' })).toBeVisible();
	const firstLastChoices = page.locator('input[name^="patternDecision."][value="first_last"]');
	await expect(firstLastChoices).toHaveCount(2);
	await firstLastChoices.nth(0).check();
	await firstLastChoices.nth(1).check();
	await page.getByRole('button', { name: 'Apply and re-parse' }).click();

	const firstNameInputs = page.locator('input[name$=".firstName"]');
	await expect(firstNameInputs).toHaveCount(3);
	await expect(page.locator('input[name="rows.r0.firstName"]')).toHaveValue('James');
	await expect(page.locator('input[name="rows.r0.lastName"]')).toHaveValue('Jackson');
	await expect(page.locator('input[name="rows.r1.firstName"]')).toHaveValue('Mary Ann');
	await expect(page.locator('input[name="rows.r1.lastName"]')).toHaveValue('Chen');
	await expect(page.locator('input[name="rows.r2.firstName"]')).toHaveValue('Maria');
	await expect(page.locator('input[name="rows.r2.lastName"]')).toHaveValue('Lopez');
});

test('onboarding review queue paginates to 10 rows per page', async ({ page }) => {
	await page.goto('/e2e/bootstrap');
	await expect(page).toHaveURL(/\/app\/onboarding\/staff$/);

	const rows = ['First Name\tLast Name'];
	for (let i = 0; i < 12; i += 1) {
		const suffix = String.fromCharCode(65 + i);
		rows.push(`First${suffix}\tLast${suffix}`);
	}
	const rawText = rows.join('\n');

	await page.getByRole('checkbox', { name: 'BLS' }).check();
	await page.evaluate((value) => {
		const textarea = document.querySelector('textarea[name="rawText"]');
		if (!(textarea instanceof HTMLTextAreaElement) || !textarea.form) {
			throw new Error('Expected onboarding textarea/form');
		}
		textarea.value = value;
		textarea.form.requestSubmit();
	}, rawText);
	await page.waitForLoadState('networkidle');

	await expect(page.getByText('Page 1 / 2')).toBeVisible();
	await expect(page.getByText('Showing 1-10 of 12')).toBeVisible();
	await expect(page.locator('tbody tr')).toHaveCount(10);
	await expect(page.locator('input[name="rows.r0.firstName"]')).toHaveValue('Firsta');
	await expect(page.locator('input[name="rows.r9.firstName"]')).toHaveValue('Firstj');

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.getByText('Page 2 / 2')).toBeVisible();
	await expect(page.getByText('Showing 11-12 of 12')).toBeVisible();
	await expect(page.locator('tbody tr')).toHaveCount(2);
	await expect(page.locator('input[name="rows.r10.firstName"]')).toHaveValue('Firstk');
	await expect(page.locator('input[name="rows.r11.firstName"]')).toHaveValue('Firstl');
});

test('onboarding review queue shows middle column when imported middle names are present', async ({
	page
}) => {
	await page.goto('/e2e/bootstrap');
	await expect(page).toHaveURL(/\/app\/onboarding\/staff$/);

	await page.getByRole('checkbox', { name: 'BLS' }).check();
	await page.evaluate((rawText) => {
		const textarea = document.querySelector('textarea[name="rawText"]');
		if (!(textarea instanceof HTMLTextAreaElement) || !textarea.form) {
			throw new Error('Expected onboarding textarea/form');
		}
		textarea.value = rawText;
		textarea.form.requestSubmit();
	}, 'First Name\tMiddle Name\tLast Name\nJames\tA\tJackson\nAmy\t\tChen');
	await page.waitForLoadState('networkidle');

	await expect(page.locator('th', { hasText: 'Middle' })).toBeVisible();
	await expect(page.locator('input[name="rows.r0.middleName"]')).toHaveValue('A');
	await expect(page.locator('input[name="rows.r1.middleName"]')).toHaveValue('');
});

test('onboarding offers to restore unsaved import from localStorage after reload', async ({
	page
}) => {
	await page.goto('/e2e/bootstrap');
	await expect(page).toHaveURL(/\/app\/onboarding\/staff$/);

	await page.getByRole('checkbox', { name: 'BLS' }).check();
	await page.evaluate((rawText) => {
		const textarea = document.querySelector('textarea[name="rawText"]');
		if (!(textarea instanceof HTMLTextAreaElement) || !textarea.form) {
			throw new Error('Expected onboarding textarea/form');
		}
		textarea.value = rawText;
		textarea.form.requestSubmit();
	}, 'First Name\tLast Name\nKathy\tJohnson\nJames\tJackson');
	await page.waitForLoadState('networkidle');
	await expect(page.locator('input[name="rows.r0.firstName"]')).toHaveValue('Kathy');

	await page.reload();
	await expect(
		page.getByText('Restore your previous unsaved import of 2 names?', { exact: true })
	).toBeVisible();

	await page.getByRole('button', { name: 'Restore' }).click();
	await expect(page.locator('input[name="rows.r0.firstName"]')).toHaveValue('Kathy');
	await expect(page.locator('input[name="rows.r1.firstName"]')).toHaveValue('James');
});
