import { test, expect } from '@playwright/test';

test('Enter Username', async ({ page }) => {
  await page.goto('http://52.23.134.146');
  await page.locator('a[href="/login"]').click();
  await page.getByLabel('Email').pressSequentially('test@example.com');
  await expect(page.getByLabel('Email')).toHaveValue('test@example.com');
});

test('Enter Password', async ({ page }) => {
  await page.goto('http://52.23.134.146');
  await page.locator('a[href="/login"]').click();
  await page.getByLabel('Password').pressSequentially('password');
  await expect(page.getByLabel('Password')).toHaveValue('password');
});

test('Show-Hide password', async ({ page }) => {
  await page.goto('http://52.23.134.146');
  await page.locator('a[href="/login"]').click();
  const password = page.getByLabel('Password');
  await password.pressSequentially('password');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', {name: /show password/i}).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', {name: /hide password/i}).click();
  await expect(password).toHaveAttribute('type', 'password');
});