import { expect, test } from '@playwright/test';

test('home page has expected h1', async ({ page }) => {
	await page.goto('/gft');
	await expect(page.locator('h1')).toBeVisible();
});
