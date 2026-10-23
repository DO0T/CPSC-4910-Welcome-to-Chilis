import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

if (process.platform === 'win32' &&
    existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
  test.use({ channel: 'chrome' });
}

async function openDashboard(page, applicationResponse) {
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/sponsor/applications') {
      return route.fulfill(applicationResponse);
    }
    const data = {
      '/api/session': { role: 'Sponsor', impersonating: null },
      '/api/sponsor/dashboard': {
        companyName: 'Example Sponsor', sponsoredDrivers: 0,
        pointsAwardedThisMonth: 0, recentActivity: [],
      },
      '/api/alerts': [],
    }[path];
    return route.fulfill({ status: data === undefined ? 404 : 200, json: data ?? {} });
  });
  await page.goto('http://localhost:5173/sponsor-dashboard');
}

test('shows pending driver applications', async ({ page }) => {
  await openDashboard(page, { status: 200, json: { applications: [
    { applicationId: 13, driverId: 42, driverName: 'Taylor Driver', appliedAt: '2026-10-23T12:00:00.000Z', status: 'PENDING' },
  ] } });
  await expect(page.getByRole('heading', { name: 'Pending applications' })).toBeVisible();
  await expect(page.getByText('Taylor Driver')).toBeVisible();
  await expect(page.getByText('Pending', { exact: true })).toBeVisible();
});

test('shows an empty state when there are no requests', async ({ page }) => {
  await openDashboard(page, { status: 200, json: { applications: [] } });
  await expect(page.getByText('No pending applications right now.')).toBeVisible();
});

test('keeps the dashboard visible if applications cannot load', async ({ page }) => {
  await openDashboard(page, { status: 500, json: { message: 'Unable to load applications' } });
  await expect(page.getByRole('heading', { name: 'Sponsor overview' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Unable to load applications' })).toBeVisible();
});
