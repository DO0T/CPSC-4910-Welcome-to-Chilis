import { test, expect } from '@playwright/test';

test.describe.serial('Sponsor tests', () => {
    test('catalogue search', async ({ page, browserName }) => {
    const email = `janesponsor-${browserName}@test.example`;
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByRole('radio', {name: 'Sponsor'}).check();
    await page.getByLabel('Full name').pressSequentially('Jane');
    await page.getByLabel('Company name', {exact : true}).pressSequentially(`clemson-${browserName}`);
    await page.getByLabel('Email').pressSequentially(email);
    await page.getByLabel('Password', {exact : true}).pressSequentially('password');
    await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
    await page.getByRole('button',{name: 'Create sponsor account'}).click();
    await page.goto('http://localhost:5173/login');
    await page.waitForTimeout(1000);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await page.getByRole('link', {name: 'Manage catalog'}).click();
    await page.locator('#catalog-query').fill('phone');
    await page.getByRole('button', {name: 'Search'}).click();
    await expect(page.locator('.catalog-results')).toBeVisible();
    });

    test('catalogue result', async ({ page, browserName }) => {
    const email = `janesponsor-${browserName}@test.example`;
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await page.getByRole('link', {name: 'Manage catalog'}).click();
    await page.locator('#catalog-query').fill('Samsung Galaxy S10');
    await page.getByRole('button', {name: 'Search'}).click();
    await expect(page.locator('.catalog-results')).toBeVisible();
    let product = page.locator('.catalog-result').filter({has: page.getByRole('heading',{name: 'Samsung Galaxy S10'})});
    await expect(product).toBeVisible();
    });

    test('add to catalog', async ({ page, browserName }) => {
    const email = `janesponsor-${browserName}@test.example`;
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await page.getByRole('link', {name: 'Manage catalog'}).click();
    await page.locator('#catalog-query').fill('Samsung Galaxy S10');
    await page.getByRole('button', {name: 'Search'}).click();
    await expect(page.locator('.catalog-results')).toBeVisible();
    let product = page.locator('.catalog-result').filter({has: page.getByRole('heading',{name: 'Samsung Galaxy S10'})});
    await product.getByRole('button', {name: 'Choose item'}).click();
    await product.getByRole('checkbox').check();
    await expect(product.getByRole('checkbox')).toBeChecked();
    await product.getByRole('button', {name : 'Add to catalog'}).click();
    });

    test('check item was added to catalog', async ({ page, browserName }) => {
    const email = `janesponsor-${browserName}@test.example`;
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await page.getByRole('link', {name: 'Manage catalog'}).click();
    let item = page.locator('.catalog-item').filter({has: page.getByRole('heading', {name:'Samsung Galaxy S10', exact: true})});
    await expect(item).toBeVisible();
    });

    test('add another item to catalog', async ({ page, browserName }) => {
    const email = `janesponsor-${browserName}@test.example`;
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await page.getByRole('link', {name: 'Manage catalog'}).click();
    await page.locator('#catalog-query').fill('iPhone X');
    await page.getByRole('button', {name: 'Search'}).click();
    await expect(page.locator('.catalog-results')).toBeVisible();
    let product = page.locator('.catalog-result').filter({has: page.getByRole('heading',{name: 'iPhone X'})});
    await product.getByRole('button', {name: 'Choose item'}).click();
    await product.getByRole('checkbox').check();
    await expect(product.getByRole('checkbox')).toBeChecked();
    await product.getByRole('button', {name : 'Add to catalog'}).click();
    await expect(page.locator('.catalog-item')).toHaveCount(2);
    });

    test('Remove item from catalog', async ({ page, browserName }) => {
    const email = `janesponsor-${browserName}@test.example`;
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await page.getByRole('link', {name: 'Manage catalog'}).click();
    let item = page.locator('.catalog-item').filter({has: page.getByRole('heading', {name:'iPhone X', exact: true})});
    page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    await dialog.accept()});
    await item.getByRole('button', {name: 'Remove'}).click();
    await expect(page.locator('.catalog-item')).toHaveCount(1);
    });

    test('check and change item price', async ({ page, browserName }) => {
    const email = `janesponsor-${browserName}@test.example`;
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await page.getByRole('link', {name: 'Manage catalog'}).click();
    let item = page.locator('.catalog-item').filter({has: page.getByRole('heading', {name:'Samsung Galaxy S10', exact: true})});
    await expect(item.getByText('69,999 pts')).toBeVisible();
    await expect(item.getByText('from $699.99')).toBeVisible();
    await item.getByLabel('Override USD price').fill('599.99');
    await item.getByRole('button', {name: 'Save price'}).click();
    await expect(item.getByText('59,999 pts')).toBeVisible();
    await expect(item.getByText('from $599.99')).toBeVisible();
    });
});