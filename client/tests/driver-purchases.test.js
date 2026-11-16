import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

if (process.platform === 'win32' && existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
  test.use({ channel: 'chrome' });
}

test('shows saved purchases and receipts across sponsors', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/driver/catalog/purchases/23/cancel') return route.fulfill({ json: { status: 'CANCELLED' } });
    if (path === '/api/driver/catalog/purchases') return route.fulfill({ json: { purchases: [
      { id: 23, sponsorName: 'Acme', itemTitle: 'Phone stand', pointsSpent: 41, status: 'COMPLETED', canCancel: true, purchasedAt: '2026-11-15T12:00:00Z', imageUrl: '' },
      { id: 24, sponsorName: 'Other sponsor', itemTitle: 'Travel mug', pointsSpent: 20, status: 'CANCELLED', purchasedAt: '2026-11-14T12:00:00Z', imageUrl: '' },
    ] } });
    return route.fulfill({ json: { role: 'Driver', impersonating: null } });
  });
  await page.goto('http://localhost:5173/driver-purchases');
  await expect(page.getByRole('heading', { name: 'Purchase history' })).toBeVisible();
  const first = page.locator('.purchase-row').filter({ hasText: 'Phone stand' });
  await expect(first).toContainText('Acme');
  await expect(first).toContainText('41 pts');
  await first.getByText('View receipt').click();
  await expect(first.getByText('Receipt number')).toBeVisible();
  await expect(first).toContainText('#23');
  await expect(first).toContainText('No real order was placed or shipped');
  await expect(page.locator('.purchase-row').filter({ hasText: 'Travel mug' })).toContainText('Cancelled');
  page.once('dialog', (dialog) => dialog.accept());
  await first.getByRole('button', { name: 'Cancel purchase' }).click();
  await expect(first.locator('.purchase-status')).toHaveText('Cancelled');
  await expect(first.getByRole('button', { name: 'Cancel purchase' })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('41 points were returned to Acme');
  await page.setViewportSize({ width: 360, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('explains when there are no purchases', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', (route) => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/purchases') ? { purchases: [] } : { role: 'Driver' } }));
  await page.goto('http://localhost:5173/driver-purchases');
  await expect(page.getByText('No purchases yet.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore rewards' })).toHaveAttribute('href', '/driver-catalog');
});

test('shows a server error instead of an empty history', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', (route) => new URL(route.request().url()).pathname.endsWith('/purchases')
    ? route.fulfill({ status: 503, json: { message: 'Purchase records are not set up yet.' } })
    : route.fulfill({ json: { role: 'Driver' } }));
  await page.goto('http://localhost:5173/driver-purchases');
  await expect(page.getByRole('alert')).toContainText('Purchase records are not set up yet.');
});
