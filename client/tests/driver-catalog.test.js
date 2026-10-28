import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

if (process.platform === 'win32' &&
    existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
  test.use({ channel: 'chrome' });
}

test('shows saved rewards from the active sponsor without purchasing controls', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = {
      '/api/session': { role: 'Driver', impersonating: null },
      '/api/driver/catalog': {
        sponsorId: 7, companyName: 'Acme', items: [
          { id: 3, title: 'Phone stand', imageUrl: '', pointCost: 41 },
          { id: 4, title: 'Travel mug', imageUrl: '', pointCost: 20 },
        ],
      },
    }[path];
    return route.fulfill({ status: data === undefined ? 404 : 200, json: data ?? {} });
  });

  await page.goto('http://localhost:5173/driver-catalog');
  await expect(page.getByRole('heading', { name: 'Acme rewards' })).toBeVisible();
  await expect(page.locator('.driver-catalog-item')).toHaveCount(2);
  await expect(page.locator('.driver-catalog-item').first()).toContainText('41 pts');
  await expect(page.locator('.driver-catalog-item').last()).toContainText('20 pts');
  await expect(page.getByRole('button', { name: /buy|purchase|checkout/i })).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.locator('.driver-catalog-item').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('gives a path back when no active sponsor is selected', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/driver/catalog') {
      return route.fulfill({ status: 409, json: { message: 'Choose one of your sponsors on the dashboard to view a catalog.' } });
    }
    return route.fulfill({ status: 200, json: { role: 'Driver', impersonating: null } });
  });

  await page.goto('http://localhost:5173/driver-catalog');
  await expect(page.getByRole('alert')).toContainText('Choose one of your sponsors');
  await expect(page.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/driver-dashboard');
});

test('requires login before loading the catalog', async ({ page }) => {
  await page.goto('http://localhost:5173/driver-catalog');
  await expect(page).toHaveURL(/\/login$/);
});
