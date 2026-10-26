import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

if (process.platform === 'win32' &&
    existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
  test.use({ channel: 'chrome' });
}

async function openDashboard(page, applicationResponse, onDecision, onDetails, onBulk) {
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/sponsor/applications/bulk/decision' && route.request().method() === 'POST') {
      return onBulk(route);
    }
    if (path.startsWith('/api/sponsor/applications/') && route.request().method() === 'PATCH') {
      return onDecision(route);
    }
    if (path.startsWith('/api/sponsor/applications/') && route.request().method() === 'GET') {
      return onDetails(route);
    }
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
  await expect(page.getByText('Taylor Driver', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve Taylor Driver' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deny Taylor Driver' })).toBeVisible();
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

test('requires confirmation before approving and updates the list afterward', async ({ page }) => {
  const decisions = [];
  await openDashboard(page, { status: 200, json: { applications: [
    { applicationId: 13, driverId: 42, driverName: 'Taylor Driver', appliedAt: '2026-10-23T12:00:00.000Z', status: 'PENDING' },
  ] } }, (route) => {
    decisions.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, json: { applicationId: 13, status: 'APPROVED' } });
  });

  await page.getByRole('button', { name: 'Approve Taylor Driver' }).click();
  await expect(page.getByText("Approve Taylor Driver's application?")).toBeVisible();
  expect(decisions).toHaveLength(0);
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(decisions).toHaveLength(0);
  await page.getByRole('button', { name: 'Approve Taylor Driver' }).click();
  await page.getByRole('button', { name: 'Approve driver' }).click();
  await expect(page.getByText("Taylor Driver's application approved.")).toBeVisible();
  await expect(page.getByText('No pending applications right now.')).toBeVisible();
  expect(decisions).toEqual([{ decision: 'APPROVED' }]);
});

test('denies only after confirmation and leaves the request visible on failure', async ({ page }) => {
  await openDashboard(page, { status: 200, json: { applications: [
    { applicationId: 13, driverId: 42, driverName: 'Taylor Driver', appliedAt: '2026-10-23T12:00:00.000Z', status: 'PENDING' },
  ] } }, (route) => route.fulfill({ status: 500, json: { message: 'Unable to update application' } }));

  await page.getByRole('button', { name: 'Deny Taylor Driver' }).click();
  await expect(page.getByText("Deny Taylor Driver's application? They can reapply in 30 days.")).toBeVisible();
  await page.getByRole('button', { name: 'Deny application' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Unable to update application' })).toBeVisible();
  await expect(page.getByText('Taylor Driver', { exact: true })).toBeVisible();
});

test('removes a successfully denied application from the pending list', async ({ page }) => {
  const decisions = [];
  await openDashboard(page, { status: 200, json: { applications: [
    { applicationId: 13, driverId: 42, driverName: 'Taylor Driver', appliedAt: '2026-10-23T12:00:00.000Z', status: 'PENDING' },
  ] } }, (route) => {
    decisions.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, json: { applicationId: 13, status: 'DENIED' } });
  });

  await page.getByRole('button', { name: 'Deny Taylor Driver' }).click();
  await page.getByRole('button', { name: 'Deny application' }).click();
  await expect(page.getByText("Taylor Driver's application denied.")).toBeVisible();
  await expect(page.getByText('No pending applications right now.')).toBeVisible();
  expect(decisions).toEqual([{ decision: 'DENIED' }]);
});

test('clicking a driver name reveals the scoped profile information', async ({ page }) => {
  await openDashboard(page, { status: 200, json: { applications: [
    { applicationId: 13, driverId: 42, driverName: 'Taylor Driver', appliedAt: '2026-10-23T12:00:00.000Z', status: 'PENDING' },
  ] } }, undefined, (route) => {
    expect(new URL(route.request().url()).pathname).toBe('/api/sponsor/applications/13');
    return route.fulfill({ status: 200, json: {
      applicationId: 13, driverId: 42, driverName: 'Taylor Driver',
      email: 'taylor@example.com', profilePictureUrl: null,
      appliedAt: '2026-10-23T12:00:00.000Z',
    } });
  });

  await page.getByRole('button', { name: 'Taylor Driver', exact: true }).click();
  await expect(page.getByText('taylor@example.com')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Taylor Driver', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Taylor Driver', exact: true }).click();
  await expect(page.getByText('taylor@example.com')).toHaveCount(0);
});

test('bulk approval requires confirmation and sends only selected applications', async ({ page }) => {
  const decisions = [];
  await openDashboard(page, { status: 200, json: { applications: [
    { applicationId: 13, driverId: 42, driverName: 'Taylor Driver', appliedAt: '2026-10-23T12:00:00.000Z', status: 'PENDING' },
    { applicationId: 14, driverId: 43, driverName: 'Alex Driver', appliedAt: '2026-10-23T13:00:00.000Z', status: 'PENDING' },
  ] } }, undefined, undefined, (route) => {
    decisions.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, json: { applicationIds: [13, 14], status: 'APPROVED', count: 2 } });
  });

  await page.getByLabel('Select all').check();
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Approve selected' }).click();
  await expect(page.getByText('Approve 2 selected applications?')).toBeVisible();
  expect(decisions).toHaveLength(0);
  await page.getByRole('group', { name: 'Confirm bulk decision' }).getByRole('button', { name: 'Cancel' }).click();
  expect(decisions).toHaveLength(0);
  await page.getByRole('button', { name: 'Approve selected' }).click();
  await page.getByRole('button', { name: 'Confirm bulk approval' }).click();
  await expect(page.getByText('2 applications approved.')).toBeVisible();
  await expect(page.getByText('No pending applications right now.')).toBeVisible();
  expect(decisions).toEqual([{ applicationIds: [13, 14], decision: 'APPROVED' }]);
});

test('bulk denial failure keeps the selected applications visible', async ({ page }) => {
  await openDashboard(page, { status: 200, json: { applications: [
    { applicationId: 13, driverId: 42, driverName: 'Taylor Driver', appliedAt: '2026-10-23T12:00:00.000Z', status: 'PENDING' },
    { applicationId: 14, driverId: 43, driverName: 'Alex Driver', appliedAt: '2026-10-23T13:00:00.000Z', status: 'PENDING' },
  ] } }, undefined, undefined, (route) => route.fulfill({ status: 409, json: {
    message: 'One or more applications have already been decided. Refresh the page.',
  } }));

  await page.getByLabel('Select Taylor Driver').check();
  await page.getByLabel('Select Alex Driver').check();
  await page.getByRole('button', { name: 'Deny selected' }).click();
  await expect(page.getByText('Deny 2 selected applications? Drivers can reapply in 30 days.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm bulk denial' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'already been decided' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Taylor Driver', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alex Driver', exact: true })).toBeVisible();
});
