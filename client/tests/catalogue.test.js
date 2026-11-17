import { test, expect } from '@playwright/test';

test.describe.serial('Sponsor Catalogue tests.', () => {
    test('catalogue search', async ({ page, browserName }) => {
        const email = `janesponsor-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.getByRole('radio', {name: 'Sponsor'}).check();
        await page.getByLabel('Full name').pressSequentially('Jane');
        await page.getByLabel('Company name', {exact : true}).pressSequentially(`clemsonCatalogue-${browserName}`);
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
    test('Find Driver Side of Catalogue', async ({ page, browserName }) => {
        const emaildriver = `Catadriver-${browserName}@test.example`;
        const emailsponsor = `janesponsor-${browserName}@test.example`;
        await page.goto('http://localhost:5173/signup');
        await page.getByLabel('Name').pressSequentially(`Cata-${browserName}`);
        await page.getByLabel('Email').pressSequentially(emaildriver);
        await page.getByLabel('Password', {exact : true}).pressSequentially('password');
        await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
        await page.getByRole('button',{name: 'Create driver account'}).click();
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(emaildriver);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        let appSection = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Apply to a sponsor'})});
        if(appSection.getByRole('button', {name: 'Show more'}).isEnabled()){
            await appSection.getByRole('button', {name: 'Show more'}).click()
        }
        let sponsor = await appSection.locator('.dashboard-sponsor-item').filter({has: page.getByRole('heading', {name: `clemsonCatalogue-${browserName}`})});
        await sponsor.getByRole('button', {name: 'Apply to sponsor'}).click();
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially(emailsponsor);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        let driverApps = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Pending applications'})});
        await driverApps.getByRole('button', {name: `Approve Cata-${browserName}`}).click();
        await driverApps.getByRole('button', {name: 'Approve driver'}).click();
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(emaildriver);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.get('button', {name: 'View catalog'}).click();
        await expect(page).toHaveURL('http://localhost:5173/driver-catalog')
    });
    test('Ensure Correct Sponsor', async ({ page, browserName }) => {
        const emaildriver = `Catadriver-${browserName}@test.example`;
        const emailsponsor = `janesponsor-${browserName}@test.example`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(emaildriver);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.get('button', {name: 'View catalog'}).click();
        await expect(page.getByRole('heading', { name: `clemsonCatalogue-${browserName} rewards`, level: 1 })).toBeVisible();
        await expect(page.getByText(`Your clemsonCatalogue-${browserName} balance`)).toBeVisible();
        await expect(page.locator('.catalog-balance strong')).toHaveText('0 points');
    });
     test('Try to buy with no points', async ({ page, browserName }) => {
        const emaildriver = `Catadriver-${browserName}@test.example`;
        const emailsponsor = `janesponsor-${browserName}@test.example`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(emaildriver);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.get('button', {name: 'View catalog'}).click();
        let item = page.getByRole('button',{name: '/Samsung Galaxy S10/'})
        await expect(item).toBeVisible();
        await expect(page.getByText('Not enough points with this sponsor.', {exact: true})).toBeVisible();
        await expect(page.getByRole('button',{name: 'Buy Samsung Galaxy S10 with points'})).toBeDisabled();
    });
    test('Go to cart with no points', async ({ page, browserName }) => {
        const emaildriver = `Catadriver-${browserName}@test.example`;
        const emailsponsor = `janesponsor-${browserName}@test.example`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(emaildriver);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.get('button', {name: 'View catalog'}).click();
        let item = page.getByRole('button',{name: '/Samsung Galaxy S10/'})
        await page.getByRole('button',{name: 'Add Samsung Galaxy S10 to cart'}).click();
        await page.getByRole('tab', { name: /Cart/ }).click();
        const cart = page.locator('#cart-panel');
        await expect(cart.getByText('Samsung Galaxy S10')).toBeVisible();
        await expect(cart.getByText('59,999 pts')).toBeVisible();
        await expect(cart.locator('.cart-total')).toContainText('Total');
        await expect(cart.locator('.cart-total strong')).toHaveText('59,999');
        await expect(page.getByRole('button', { name: 'Review cart checkout' })).toBeDisabled();
        await expect(cart.getByText('Not enough points for all items with this sponsor.')).toBeVisible();
        await cart.getByRole('button', {name: 'Remove Samsung Galaxy S10 from cart'}).click();
        await expect(cart.getByText('Your cart is empty. Add a reward to get started.')).toBeVisible();
     });
     test('Purchase Directly from catalogue', async ({ page, browserName }) => {
        const emaildriver = `Catadriver-${browserName}@test.example`;
        const emailsponsor = `janesponsor-${browserName}@test.example`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(emailsponsor);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let driver = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Cata'});
        await driver.getByRole('button', {name: 'Change points'}).click();
        let popup = page.locator('dialog.sponsor-action-dialog');
        await popup.locator('#points-direction').selectOption('Add');
        await popup.locator('#points-amount').fill('100000');
        await popup.locator('#points-reason').fill('Purchase Testing');
        await popup.getByRole('button', {name: 'Add points'}).click();
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(emaildriver);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.get('button', {name: 'View catalog'}).click();
        let item = page.getByRole('button',{name: '/Samsung Galaxy S10/'})
        await page.getByRole('button',{name: 'Buy Samsung Galaxy S10 with points'}).click();
        const checkout = page.getByRole('dialog');
        await expect(checkout).toBeVisible();
        await expect(checkout.getByText('This is a simulated purchase. Points are deducted, but no real order is placed or shipped.')).toBeVisible();
        await expect(checkout.getByRole('button', { name: 'Complete Purchase' })).toBeVisible();
        await checkout.getByRole('button', { name: 'Complete Purchase' }).click();
        await expect(checkout.getByText('Enjoy your reward')).toBeVisible();
    });
    test('Put item in cart and buy', async ({ page, browserName }) => {
        const emaildriver = `Catadriver-${browserName}@test.example`;
        const emailsponsor = `janesponsor-${browserName}@test.example`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(emaildriver);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.get('button', {name: 'View catalog'}).click();
        let item = page.getByRole('button',{name: '/Samsung Galaxy S10/'})
        await page.getByRole('button',{name: 'Add Samsung Galaxy S10 to cart'}).click();
        await page.getByRole('tab', { name: /Cart/ }).click();
        const cart = page.locator('#cart-panel');
        await expect(cart.getByText('Samsung Galaxy S10')).toBeVisible();
        await expect(cart.getByText('59,999 pts')).toBeVisible();
        await expect(cart.locator('.cart-total')).toContainText('Total');
        await expect(cart.locator('.cart-total strong')).toHaveText('59,999');
        await page.getByRole('button', { name: 'Review cart checkout' }).click();
        const checkout = page.getByRole('dialog');
        await expect(checkout).toBeVisible();
        await expect(checkout.getByText('This is a simulated purchase. Points are deducted, but no real order is placed or shipped.')).toBeVisible();
        await expect(checkout.getByRole('button', { name: 'Complete Purchase' })).toBeVisible();
        await checkout.getByRole('button', { name: 'Complete Purchase' }).click();
        await expect(checkout.getByText('Enjoy your reward')).toBeVisible();
    }); 
});