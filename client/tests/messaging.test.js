import { test, expect } from '@playwright/test';

async function setup(page, role) {
  const people = role === 'Sponsor' ? [{ user_id: 23, name: 'Alex', role: 'Driver', username: 'alex@example.com' }, { user_id: 24, name: 'Blair', role: 'Driver', username: 'blair@example.com' }] : [{ user_id: 23, name: 'Sam', role: 'Sponsor', company_name: 'Chilis', username: 'sam@example.com' }, ...(role === 'Admin' ? [{ user_id: 24, name: 'Alex', role: 'Driver', username: 'alex@example.com' }] : [])];
  const state = { conversations: [], messages: [], enabled: true, sent: null };
  await page.addInitScript(() => sessionStorage.setItem('authToken', 'test'));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === '/api/session') return route.fulfill({ json: { role, userId: 12 } });
    if (path.endsWith('/contacts')) return route.fulfill({ json: people });
    if (path.endsWith('/preferences')) {
      if (method === 'PUT') state.enabled = route.request().postDataJSON().sponsorMessagesEnabled;
      return route.fulfill({ json: { sponsorMessagesEnabled: state.enabled } });
    }
    if (path === '/api/messaging') {
      if (method === 'POST') {
        const body = route.request().postDataJSON(); state.sent = body;
        state.conversations = body.recipientIds.map((id, i) => ({ conversation_id: 70 + i, subject: body.subject, sender_id: 12, sender_role: role, recipient_id: id, recipient_role: people.find(p => p.user_id === id).role, sender_name: role, recipient_name: people.find(p => p.user_id === id).name, driver_replies_enabled: body.driverRepliesEnabled, updated_at: '2026-11-12T15:00:00Z' }));
        state.messages = [{ message_id: 1, author_id: 12, author_name: role, message: body.message, created_at: '2026-11-12T15:00:00Z' }];
        return route.fulfill({ status: 201, json: { conversationIds: state.conversations.map(c => c.conversation_id), message: 'Sent.' } });
      }
      return route.fulfill({ json: state.conversations });
    }
    if (path.endsWith('/replies')) { state.conversations[0].driver_replies_enabled = route.request().postDataJSON().driverRepliesEnabled; return route.fulfill({ json: {} }); }
    if (path.endsWith('/messages')) {
      if (method === 'POST') { state.messages.push({ message_id: state.messages.length + 1, author_id: 12, author_name: role, message: route.request().postDataJSON().message, created_at: '2026-11-12T15:01:00Z' }); return route.fulfill({ status: 201, json: {} }); }
      return route.fulfill({ json: { conversation: state.conversations[0], messages: state.messages } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(`${test.info().project.use.baseURL || 'http://localhost:5173'}/messages`);
  await page.getByRole('button', { name: '＋ New message', exact: true }).click();
  return state;
}

test('sponsor sends privately to several drivers and controls replies', async ({ page }) => {
  const state = await setup(page, 'Sponsor');
  await page.getByLabel('Alex — Driver').check(); await page.getByLabel('Blair — Driver').check();
  await page.getByLabel('Allow drivers to reply', { exact: true }).uncheck();
  await page.getByLabel('Subject', { exact: true }).fill('Route update'); await page.getByLabel('Message', { exact: true }).fill('Please review your route.');
  await page.getByRole('button', { name: 'Send new message' }).click();
  await expect(page.getByRole('button', { name: 'Route update — Alex' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Route update — Blair' })).toBeVisible();
  expect(state.sent.recipientIds).toEqual([23, 24]); expect(state.sent.driverRepliesEnabled).toBe(false);
  await page.getByLabel('Allow driver replies in this conversation').click();
  await expect(page.getByLabel('Allow driver replies in this conversation')).toBeChecked();
  await page.getByLabel('Reply', { exact: true }).fill('Follow-up'); await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(page.getByText('Follow-up', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/messages-sponsor.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('driver preferences persist and polling receives replies without erasing drafts', async ({ page }) => {
  const state = await setup(page, 'Driver');
  await page.getByText('Notification settings', { exact: true }).click();
  const preference = page.getByLabel('Notify me when sponsors send messages or replies');
  await preference.click(); await expect(preference).not.toBeChecked();
  await page.reload(); await page.getByText('Notification settings', { exact: true }).click(); await expect(preference).not.toBeChecked();
  await preference.click(); await expect(preference).toBeChecked();
  await page.getByRole('button', { name: '＋ New message', exact: true }).click();
  await page.getByLabel('Sam — Chilis').check();
  await page.getByLabel('Subject', { exact: true }).fill('Question'); await page.getByLabel('Message', { exact: true }).fill('Can you help?');
  await page.getByRole('button', { name: 'Send new message' }).click();
  await page.getByLabel('Reply', { exact: true }).fill('Unsent draft');
  state.messages.push({ message_id: 2, author_id: 23, author_name: 'Sam', message: 'Yes, I can help.', created_at: '2026-11-12T15:01:00Z' });
  await expect(page.getByText('Yes, I can help.', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel('Reply', { exact: true })).toHaveValue('Unsent draft');
  state.conversations[0].driver_replies_enabled = false;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('The sponsor has disabled replies for this conversation.')).toBeVisible();
  await expect(page.getByLabel('Reply', { exact: true })).toHaveCount(0);
});
for (const person of ['Sam — Chilis', 'Alex — Driver']) test(`administrator can message ${person}`, async ({ page }) => {
  await setup(page, 'Admin'); await page.getByLabel(person).check();
  await page.getByLabel('Subject', { exact: true }).fill('Announcement'); await page.getByLabel('Message', { exact: true }).fill('Hello from administration.');
  await page.getByRole('button', { name: 'Send new message' }).click();
  await expect(page.getByText('Hello from administration.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Reply', { exact: true })).toBeVisible();
});

test('recipient search preserves selections and supports removing recipients', async ({ page }) => {
  await setup(page, 'Sponsor');
  const search = page.getByRole('searchbox', { name: 'Search recipients' });
  await search.fill('alex@');
  await expect(page.getByLabel('Blair — Driver')).toHaveCount(0);
  await page.getByLabel('Alex — Driver').check();
  await search.fill('blair');
  await page.getByLabel('Blair — Driver').check();
  await expect(page.getByRole('button', { name: 'Remove Alex' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Blair' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Alex' }).click();
  await expect(page.getByRole('button', { name: 'Remove Alex' })).toHaveCount(0);
  await search.fill('no matching person');
  await expect(page.getByText('No people found. Try another name, email, or organization.')).toBeVisible();
  await search.fill('');
  await expect(page.getByLabel('Blair — Driver')).toBeChecked();
  await expect(page.getByLabel('Alex — Driver')).not.toBeChecked();
  await page.screenshot({ path: 'test-results/messages-compose.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(search).toBeVisible();
  await page.screenshot({ path: 'test-results/messages-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '← Inbox', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Search conversations' })).toBeVisible();
});
