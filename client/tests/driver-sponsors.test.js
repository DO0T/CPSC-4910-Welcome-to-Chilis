import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

// Use an installed Chrome on Windows when Playwright's bundled browser is absent.
if (process.platform === 'win32' &&
    existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
  test.use({ channel: 'chrome' });
}

test('drivers can search, filter, and reveal sponsors five at a time', async ({ page }) => {
  const sponsors = Array.from({ length: 8 }, (_, index) => ({
    sponsorId: index + 1,
    companyName: `Sponsor ${index + 1}`,
    availability: index === 1 ? 'pending' : 'available',
    canApply: index !== 1,
  }));

  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = {
      '/api/session': { role: 'Driver', impersonating: null },
      '/api/profile': { name: 'Taylor Driver' },
      '/api/driver/points': { total_points: 0 },
      '/api/driver/points-history': [],
      '/api/driver/applications/sponsors': sponsors,
      '/api/driver/sponsorships': [],
      '/api/alerts': [],
    }[path];
    return route.fulfill({ status: data === undefined ? 404 : 200, json: data ?? {} });
  });

  await page.goto('http://localhost:5173/driver-dashboard');
  const rows = page.locator('.dashboard-sponsor-item');
  await expect(rows).toHaveCount(5);
  await expect(page.getByText('Showing 5 of 8 sponsors')).toBeVisible();

  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(rows).toHaveCount(8);
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);

  await page.getByLabel('Search sponsors').fill('SPONSOR 8');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Sponsor 8');

  await page.getByLabel('Search sponsors').fill('');
  await expect(rows).toHaveCount(5);
  await page.getByLabel('Filter by status').selectOption('pending');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Sponsor 2');

  await page.getByLabel('Search sponsors').fill('not here');
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('No sponsors match your search or filter.')).toBeVisible();
});

test('drivers see their approved sponsors separately from applications', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = {
      '/api/session': { role: 'Driver', impersonating: null },
      '/api/profile': { name: 'Taylor Driver' },
      '/api/driver/points': { total_points: 0 },
      '/api/driver/points-history': [],
      '/api/driver/applications/sponsors': [],
      '/api/driver/sponsorships': [
        { sponsorId: 7, companyName: 'Acme', isActive: true },
        { sponsorId: 9, companyName: 'Beacon', isActive: false },
      ],
      '/api/alerts': [],
    }[path];
    return route.fulfill({ status: data === undefined ? 404 : 200, json: data ?? {} });
  });

  await page.goto('http://localhost:5173/driver-dashboard');
  const memberships = page.getByRole('heading', { name: 'My sponsors' }).locator('..').locator('..');
  await expect(memberships).toContainText('Acme');
  await expect(memberships).toContainText('Beacon');
  await expect(memberships).toContainText('Current sponsor');
  await expect(memberships.getByRole('button')).toHaveCount(0);
});
