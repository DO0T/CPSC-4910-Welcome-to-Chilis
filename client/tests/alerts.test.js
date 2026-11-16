import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

if (process.platform === 'win32' && existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) test.use({ channel: 'chrome' });

test('badge counts unviewed alerts and clears when the history is opened', async ({ page }) => {
  let alerts = [
    { id: 1, type: 'points', message: 'First alert', created_at: '2026-11-15T12:00:00Z', is_viewed: 0 },
    { id: 2, type: 'points', message: 'Earlier alert', created_at: '2026-11-14T12:00:00Z', is_viewed: 1 },
  ];
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/alerts/viewed') {
      const ids = route.request().postDataJSON().ids;
      alerts = alerts.map((alert) => ids.includes(alert.id) ? { ...alert, is_viewed: 1 } : alert);
      return route.fulfill({ json: { message: 'Viewed' } });
    }
    if (path === '/api/alerts') return route.fulfill({ json: alerts });
    const data = {
      '/api/session': { role: 'Driver' }, '/api/profile': { name: 'Driver' },
      '/api/driver/points': { total_points: 0 }, '/api/driver/points-history': [],
      '/api/driver/applications/sponsors': [], '/api/driver/sponsorships': [],
      '/api/driver/post-removal-access': [],
    }[path];
    return route.fulfill({ status: data === undefined ? 404 : 200, json: data ?? {} });
  });
  await page.goto('http://localhost:5173/driver-dashboard');
  const trigger = page.locator('.alert-center-trigger');
  await expect(trigger.locator('.alert-center-count')).toHaveText('1');
  await trigger.click();
  await expect(page.getByText('First alert')).toBeVisible();
  await expect(page.getByText('Earlier alert')).toBeVisible();
  await expect(trigger.locator('.alert-center-count')).toHaveCount(0);
  await page.reload();
  await expect(trigger.locator('.alert-center-count')).toHaveCount(0);
  alerts.push({ id: 3, type: 'points', message: 'New alert', created_at: '2026-11-16T12:00:00Z', is_viewed: 0 });
  await page.reload();
  await expect(trigger.locator('.alert-center-count')).toHaveText('1');
});
