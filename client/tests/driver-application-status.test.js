import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

if (process.platform === 'win32' &&
    existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
  test.use({ channel: 'chrome' });
}

async function openDriverDashboard(page, getSponsors, onApply) {
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-token'));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/driver/applications/sponsors') {
      return route.fulfill({ status: 200, json: getSponsors() });
    }
    if (path === '/api/driver/applications' && route.request().method() === 'POST') {
      return onApply(route);
    }
    const data = {
      '/api/session': { role: 'Driver', impersonating: null },
      '/api/profile': { name: 'Taylor Driver' },
      '/api/driver/points': { total_points: 0 },
      '/api/driver/points-history': [],
      '/api/alerts': [],
    }[path];
    return route.fulfill({ status: data === undefined ? 404 : 200, json: data ?? {} });
  });
  await page.goto('http://localhost:5173/driver-dashboard');
}

test('shows application decisions independently of sponsor search and paging', async ({ page }) => {
  const sponsors = [
    { sponsorId: 1, companyName: 'Pending Sponsor', availability: 'pending', canApply: false,
      applicationStatus: 'PENDING', appliedAt: '2026-10-20T12:00:00.000Z', decidedAt: null, canReapplyAt: null },
    { sponsorId: 2, companyName: 'Approved Sponsor', availability: 'approved', canApply: false,
      applicationStatus: 'APPROVED', appliedAt: '2026-10-15T12:00:00.000Z', decidedAt: '2026-10-21T12:00:00.000Z', canReapplyAt: null },
    { sponsorId: 3, companyName: 'Denied Sponsor', availability: 'cooldown', canApply: false,
      applicationStatus: 'DENIED', appliedAt: '2026-10-10T12:00:00.000Z', decidedAt: '2026-10-12T12:00:00.000Z',
      canReapplyAt: '2026-11-11T12:00:00.000Z' },
    ...Array.from({ length: 6 }, (_, index) => ({
      sponsorId: index + 4, companyName: `Open Sponsor ${index + 4}`, availability: 'available', canApply: true,
      applicationStatus: null, appliedAt: null, decidedAt: null, canReapplyAt: null,
    })),
  ];
  await openDriverDashboard(page, () => sponsors);

  const applications = page.locator('.driver-application-status-item');
  await expect(page.getByRole('heading', { name: 'Your applications' })).toBeVisible();
  await expect(applications).toHaveCount(3);
  await expect(applications.filter({ hasText: 'Pending Sponsor' })).toContainText('Pending review');
  await expect(applications.filter({ hasText: 'Approved Sponsor' })).toContainText('Approved');
  await expect(applications.filter({ hasText: 'Denied Sponsor' })).toContainText('You can reapply on');
  await page.getByLabel('Search sponsors').fill('Open Sponsor 9');
  await expect(page.locator('.dashboard-sponsor-item')).toHaveCount(1);
  await expect(applications).toHaveCount(3);
});

test('checking for updates shows a newly approved application', async ({ page }) => {
  let approved = false;
  await openDriverDashboard(page, () => [{
    sponsorId: 1, companyName: 'North Star', availability: approved ? 'approved' : 'pending', canApply: false,
    applicationStatus: approved ? 'APPROVED' : 'PENDING',
    appliedAt: '2026-10-20T12:00:00.000Z', decidedAt: approved ? '2026-10-23T12:00:00.000Z' : null,
    canReapplyAt: null,
  }]);
  await expect(page.locator('.driver-application-status-item')).toContainText('Pending review');
  approved = true;
  await page.getByRole('button', { name: 'Check for updates' }).click();
  await expect(page.locator('.driver-application-status-item')).toContainText('This sponsor approved your application.');
});

test('a denied driver can reapply from the status section after cooldown', async ({ page }) => {
  const applications = [];
  await openDriverDashboard(page, () => [{
    sponsorId: 3, companyName: 'Ready Sponsor', availability: 'available', canApply: true,
    applicationStatus: 'DENIED', appliedAt: '2026-09-01T12:00:00.000Z',
    decidedAt: '2026-09-02T12:00:00.000Z', canReapplyAt: '2026-10-02T12:00:00.000Z',
  }], (route) => {
    applications.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { applicationId: 22, sponsorId: 3, status: 'PENDING' } });
  });

  await page.getByRole('button', { name: 'Reapply to Ready Sponsor' }).click();
  await expect(page.locator('.driver-application-status-item')).toContainText('Pending review');
  expect(applications).toEqual([{ sponsorId: 3 }]);
});

test('a failed reapplication reports the error next to application status', async ({ page }) => {
  await openDriverDashboard(page, () => [{
    sponsorId: 3, companyName: 'Ready Sponsor', availability: 'available', canApply: true,
    applicationStatus: 'DENIED', appliedAt: '2026-09-01T12:00:00.000Z',
    decidedAt: '2026-09-02T12:00:00.000Z', canReapplyAt: '2026-10-02T12:00:00.000Z',
  }], (route) => route.fulfill({ status: 409, json: { message: 'Please try again later' } }));

  await page.getByRole('button', { name: 'Reapply to Ready Sponsor' }).click();
  await expect(page.locator('.driver-applications-card').getByRole('alert')).toContainText('Please try again later');
  await expect(page.locator('.driver-application-status-item')).toContainText('Denied');
});

test('checking for updates keeps the previous status if the request fails', async ({ page }) => {
  await openDriverDashboard(page, () => [{
    sponsorId: 1, companyName: 'North Star', availability: 'pending', canApply: false,
    applicationStatus: 'PENDING', appliedAt: '2026-10-20T12:00:00.000Z',
    decidedAt: null, canReapplyAt: null,
  }]);
  await expect(page.locator('.driver-application-status-item')).toContainText('Pending review');
  await page.route('**/api/driver/applications/sponsors', (route) =>
    route.fulfill({ status: 500, json: { message: 'Unable to check status now' } }));

  await page.getByRole('button', { name: 'Check for updates' }).click();
  await expect(page.locator('.driver-applications-card').getByRole('alert')).toContainText('Unable to check status now');
  await expect(page.locator('.driver-application-status-item')).toContainText('Pending review');
});
