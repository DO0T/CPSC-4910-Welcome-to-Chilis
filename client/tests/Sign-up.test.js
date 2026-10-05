import { test, expect } from '@playwright/test';
test.describe.serial('Driver tests', () => {
    test('Sign-up and Sign-in', async ({ page, browserName }) => {
    const email = `john-${browserName}@test.example`;
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByLabel('Name').pressSequentially('John');
    await page.getByLabel('Email').pressSequentially(email);
    await page.getByLabel('Password', {exact : true}).pressSequentially('password');
    await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
    await page.getByRole('button',{name: 'Create driver account'}).click();
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://localhost:5173/driver-dashboard')
    });

    test('Fail Sign-up', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByLabel('Name').pressSequentially('Jane');
    await page.getByLabel('Email').pressSequentially('Jane');
    await page.getByLabel('Password', {exact : true}).pressSequentially('password');
    await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
    await page.getByRole('button',{name: 'Create driver account'}).click();
    await expect(page.getByLabel('Email')).toBeFocused();
    });

    /*test('Database Sign-up Fail', async({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByLabel('Name').pressSequentially('Jane');
    await page.getByLabel('Email').pressSequentially('Jane@email.com');
    await page.getByLabel('Password', {exact : true}).pressSequentially('password');
    await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
    await page.getByRole('button',{name: 'Create driver account'}).click();
    await expect(page.getByText('Unable to create your account.')).toBeVisible();
}); */

    test('Duplicate Email', async ({ page, browserName }) => {
    const email = `duplicate-${browserName}@test.example`;
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByLabel('Name').fill('John');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('password');
    await page.getByLabel('Confirm password', { exact: true }).fill('password');
    await page.getByRole('button', { name: 'Create driver account' }).click();
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByLabel('Name').fill('John');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('password');
    await page.getByLabel('Confirm password', { exact: true }).fill('password');
    await page.getByRole('button', { name: 'Create driver account' }).click();
    await expect(page.getByText('An account with this email already exists')).toBeVisible();
    });

    test('Find Profile Page', async ({ page, browserName }) => {
    const email = `john-${browserName}@test.example`;
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://localhost:5173/driver-dashboard')
    await page.getByRole('button', {name: 'Edit profile'}).click();
    await expect(page).toHaveURL('http://localhost:5173/editprofile')
    });

    test('Edit Name', async ({ page, browserName }) => {
    const email = `john-${browserName}@test.example`;
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page.getByText('Welcome back, John')).toBeVisible();
    await page.getByRole('button', {name: 'Edit profile'}).click();
    await page.getByLabel('Name').clear();
    await page.getByLabel('Name').pressSequentially('Jane');
    await page.getByRole('button',{name: 'save changes'}).click();
    await page.goto('http://localhost:5173/driver-dashboard');
    await expect(page.getByText('Welcome back, Jane')).toBeVisible();
    await page.getByRole('button', {name: 'Edit profile'}).click();
    });
});