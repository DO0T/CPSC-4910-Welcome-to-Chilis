import { test, expect } from '@playwright/test';

test('Sign-up and Sign-in', async ({ page }) => {
    await page.goto('http://52.23.134.146/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByLabel('Name').pressSequentially('John');
    await page.getByLabel('Email').pressSequentially('John@test.example');
    await page.getByLabel('Password', {exact : true}).pressSequentially('password');
    await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
    await page.getByRole('button',{name: 'Sign up'}).click();
    await expect(page.getByText('Account created. You can now log in')).toBeVisible();
    await page.getByRole('link', { name: 'Log in' }).click();
    await page.getByLabel('Email').pressSequentially('John@test.example');
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://52.23.134.146/driver-dashboard')
});

test('Fail Sign-up', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByLabel('Name').pressSequentially('Jane');
    await page.getByLabel('Email').pressSequentially('Jane');
    await page.getByLabel('Password', {exact : true}).pressSequentially('password');
    await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
    await page.getByRole('button',{name: 'Sign up'}).click();
    await expect(page.getByLabel('Email')).toBeFocused
});

test('Database Sign-up Fail', async({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByLabel('Name').pressSequentially('Jane');
    await page.getByLabel('Email').pressSequentially('Jane@email.com');
    await page.getByLabel('Password', {exact : true}).pressSequentially('password');
    await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
    await page.getByRole('button',{name: 'Sign up'}).click();
    await expect(page.getByText('Unable to create your account.')).toBeVisible();
});
test('Duplicate Email', async ({ page }) => {
    await page.goto('http://52.23.134.146/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByLabel('Name').pressSequentially('John');
    await page.getByLabel('Email').pressSequentially('John@email.com');
    await page.getByLabel('Password', {exact : true}).pressSequentially('password');
    await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
    await page.getByRole('button',{name: 'Sign up'}).click()
    await expect(page.getByText('An account with this email already exists')).toBeVisible();
    });

test('Find Profile Page', async ({ page }) => {
    await page.goto('http://52.23.134.146/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').pressSequentially('John@test.example');
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://52.23.134.146/driver-dashboard')
    await page.getByRole('button', {name: 'Edit profile'}).click();
    await expect(page).toHaveURL('http://52.23.134.146/editprofile')
});

test('Edit Name', async ({ page }) => {
    await page.goto('http://52.23.134.146/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').pressSequentially('John@test.example');
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page.getByText('Welcome back, John')).toBeVisible();
    await page.getByRole('button', {name: 'Edit profile'}).click();
    await page.getByLabel('Name').pressSequentially('Jane');
    await page.getByRole('button',{name: 'save changes'}).click();
    await page.goto('http://52.23.134.146/driver-dashboard');
    await expect(page.getByText('Welcome back, Jane')).toBeVisible();
    await page.getByRole('button', {name: 'Edit profile'}).click();
    await page.getByLabel('Name').pressSequentially('John');
    await page.getByRole('button',{name: 'save changes'}).click();
});