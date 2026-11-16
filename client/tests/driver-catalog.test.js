import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

if (process.platform === 'win32' &&
    existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
  test.use({ channel: 'chrome' });
}

test('shows saved rewards and completes a simulated points purchase', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = {
      '/api/session': { role: 'Driver', impersonating: null },
      '/api/driver/catalog': {
        sponsorId: 7, companyName: 'Acme', balance: 100, items: [
          { id: 3, title: 'Phone stand', imageUrl: '', pointCost: 41, mediaRating: 'PG', itemUrl: 'https://example.com/item' },
          { id: 4, title: 'Travel mug', imageUrl: '', pointCost: 20 },
        ],
      },
      '/api/driver/catalog/purchase': { balance: 59, message: 'Simulated purchase complete.' },
    }[path];
    return route.fulfill({ status: data === undefined ? 404 : 200, json: data ?? {} });
  });

  await page.goto('http://localhost:5173/driver-catalog');
  await expect(page.getByRole('heading', { name: 'Acme rewards' })).toBeVisible();
  await expect(page.locator('.driver-catalog-item')).toHaveCount(2);
  await expect(page.locator('.driver-catalog-item').first()).toContainText('41 pts');
  await expect(page.locator('.driver-catalog-item').last()).toContainText('20 pts');
  const item = page.locator('.driver-catalog-item-button').filter({ hasText: 'Phone stand' });
  const buy = page.getByRole('button', { name: 'Buy Phone stand with points' });
  await expect(buy).toBeVisible();
  await buy.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep shopping' }).click();
  await item.focus();
  await page.keyboard.press('Enter');
  await expect(item).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Media rating: PG')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View original listing' })).toHaveAttribute('href', 'https://example.com/item');
  await item.click();
  await buy.click();
  const checkout = page.getByRole('dialog');
  await expect(checkout.getByText('Balance after purchase')).toBeVisible();
  await expect(checkout).toContainText('59 pts');
  await expect(checkout).toContainText('no real order is placed or shipped');
  const purchaseRequest = page.waitForRequest((req) => req.url().endsWith('/api/driver/catalog/purchase') && req.method() === 'POST');
  await checkout.getByRole('button', { name: 'Complete purchase' }).click();
  expect((await purchaseRequest).postDataJSON()).toEqual({ itemId: 3, sponsorId: 7, pointCost: 41 });
  await expect(checkout.getByText('Purchase complete')).toBeVisible();
  await expect(checkout).toContainText('59 pts');
  await checkout.getByRole('button', { name: 'Continue shopping' }).click();
  await expect(page.locator('.catalog-balance')).toContainText('59');
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

test('searches sponsor rewards by keyword without changing the cart', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', (route) => new URL(route.request().url()).pathname === '/api/driver/catalog'
    ? route.fulfill({ json: { sponsorId: 7, companyName: 'Acme', balance: 100, items: [
      { id: 3, title: 'Phone stand', pointCost: 41 }, { id: 4, title: 'Travel mug', pointCost: 20 },
    ] } }) : route.fulfill({ json: { role: 'Driver' } }));
  await page.goto('http://localhost:5173/driver-catalog');
  await page.getByRole('button', { name: 'Add Phone stand to cart' }).click();
  const search = page.getByRole('searchbox', { name: 'Search rewards' });
  await search.fill('  MUG  ');
  await expect(page.locator('.driver-catalog-item')).toHaveCount(1);
  await expect(page.locator('.driver-catalog-item')).toContainText('Travel mug');
  await search.fill('not in catalog');
  await expect(page.getByRole('status')).toContainText('No rewards match your search');
  await search.clear();
  await expect(page.locator('.driver-catalog-item')).toHaveCount(2);
  await page.getByRole('tab', { name: 'Cart 1' }).click();
  await expect(page.locator('.driver-cart')).toContainText('Phone stand');
});

test('adds and removes rewards and checks out a cart as one purchase', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('https://example.com/phone.png', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>' }));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/driver/catalog') return route.fulfill({ json: { sponsorId: 7, companyName: 'Acme', balance: 100, items: [
      { id: 3, title: 'Phone stand', imageUrl: 'https://example.com/phone.png', pointCost: 41 }, { id: 4, title: 'Travel mug', pointCost: 20 },
    ] } });
    if (path === '/api/driver/catalog/checkout') return route.fulfill({ json: { balance: 39, purchaseIds: [23, 24] } });
    return route.fulfill({ json: { role: 'Driver' } });
  });
  await page.goto('http://localhost:5173/driver-catalog');
  await page.getByRole('button', { name: 'Add Phone stand to cart' }).click();
  await page.getByRole('button', { name: 'Add Travel mug to cart' }).click();
  await page.getByRole('tab', { name: 'Cart 2' }).click();
  const cart = page.locator('.driver-cart');
  await expect(cart).toContainText('61 pts');
  await expect(cart.locator('img')).toHaveAttribute('src', 'https://example.com/phone.png');
  await cart.getByRole('button', { name: 'Remove Travel mug from cart' }).click();
  await expect(cart).toContainText('41 pts');
  await page.getByRole('tab', { name: 'Rewards' }).click();
  await page.getByRole('button', { name: 'Add Travel mug to cart' }).click();
  await page.getByRole('tab', { name: 'Cart 2' }).click();
  await cart.getByRole('button', { name: 'Review cart checkout' }).click();
  const checkout = page.getByRole('dialog');
  await expect(checkout).toContainText('39 pts');
  const posted = page.waitForRequest((req) => req.url().endsWith('/api/driver/catalog/checkout') && req.method() === 'POST');
  await checkout.getByRole('button', { name: 'Complete purchase' }).click();
  expect((await posted).postDataJSON()).toEqual({ sponsorId: 7, items: [{ itemId: 3, pointCost: 41 }, { itemId: 4, pointCost: 20 }] });
  await expect(checkout.getByText('Purchase complete')).toBeVisible();
  await checkout.getByRole('button', { name: 'Continue shopping' }).click();
  await expect(cart).toContainText('Your cart is empty');
});
