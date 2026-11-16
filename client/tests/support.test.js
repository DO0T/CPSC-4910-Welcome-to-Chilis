import { test, expect } from '@playwright/test';

for (const role of ['Driver', 'Sponsor', 'Admin']) {
  test(`${role} support conversation`, async ({ page }) => {
    const ticket = { ticket_id: 42, subject: 'Account help', requester_name: 'Alex Driver', status: 'OPEN', acknowledgement_sent: true, notification_sent: true, updated_at: '2026-11-12T15:00:00Z' };
    let tickets = role === 'Admin' ? [ticket] : [];
    const messages = [{ message_id: 1, author_name: 'Alex Driver', message: 'Please help with my account.', created_at: ticket.updated_at }];
    await page.addInitScript(() => sessionStorage.setItem('authToken', 'test-session'));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      if (path === '/api/session') return route.fulfill({ json: { role } });
      if (path === '/api/support' && method === 'POST') {
        tickets = [ticket];
        return route.fulfill({ status: 201, json: { ticketId: 42, message: 'Ticket #42 created.' } });
      }
      if (path === '/api/support') return route.fulfill({ json: tickets });
      if (path.endsWith('/messages')) {
        if (method === 'POST') messages.push({ message_id: 2, author_name: role, message: route.request().postDataJSON().message, created_at: ticket.updated_at });
        return route.fulfill({ json: method === 'POST' ? { message: 'Message sent.' } : messages });
      }
      if (path.endsWith('/status')) { ticket.status = route.request().postDataJSON().status; return route.fulfill({ json: {} }); }
      return route.fulfill({ json: [] });
    });
    await page.goto(`${test.info().project.use.baseURL || 'http://localhost:5173'}/support`);
    if (role !== 'Admin') {
      await page.getByLabel('Subject', { exact: true }).fill('Account help');
      await page.getByLabel('Describe your problem').fill('Please help with my account.');
      await page.getByRole('button', { name: 'Submit support request' }).click();
    } else {
      await page.getByRole('button', { name: '#42 — Account help' }).click();
    }
    await expect(page.getByText('Please help with my account.', { exact: true })).toBeVisible();
    await page.getByLabel('Message', { exact: true }).fill('Thanks for the update.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Thanks for the update.', { exact: true })).toBeVisible();
    if (role === 'Admin') {
      await page.getByRole('button', { name: 'Close ticket', exact: true }).click();
      await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Reopen ticket', exact: true }).click();
      await expect(page.getByLabel('Message', { exact: true })).toBeVisible();
    }
    await page.screenshot({ path: `test-results/support-${role}.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
