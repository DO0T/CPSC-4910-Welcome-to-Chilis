import { test, expect } from '@playwright/test';

test.describe.serial('Dispute', () => {
    test('Sponsor Find Point disputes', async ({ page, browserName }) => {
        const email = `Moses-${browserName}@test.example`;
        const org = `LCD-${browserName}`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.getByRole('radio', {name: 'Sponsor'}).check();
        await page.getByLabel('Full name').pressSequentially('Dias');
        await page.getByLabel('Company name', {exact : true}).pressSequentially(org);
        await page.getByLabel('Email').pressSequentially(email);
        await page.getByLabel('Password', {exact : true}).pressSequentially('password');
        await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
        await page.getByRole('button',{name: 'Create sponsor account'}).click();
        await page.goto('http://localhost:5173/login');
        await page.waitForTimeout(1000);
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click()
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        let bulkloading = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Bulk Load Drivers & Sponsor Users'})});
        await bulkloading.locator('#sponsor-bulk-textarea').fill(`D||Ezra|Detective|Ezra-${browserName}@email.com|100|Ezra\nD||Vespa|Crabro|Vespa-${browserName}@email.com\nD||Aeng|Du|Aengdu-${browserName}@email.com`)
        await bulkloading.getByRole('button',{name: 'Upload & Process File'}).click();
        let success = bulkloading.locator('strong',{name: 'Bulk file processing complete'});
        await expect(success).toBeVisible();
        await expect(success).toContainText('Total Lines Processed: 3');
        await expect(success).toContainText('Drivers Created (Auto-Accepted): 3');
        await page.getByRole('button', {name: 'Point disputes'}).click();
        await expect(page).toHaveURL('http://localhost:5173/point-disputes')
    });
    test('Sponsor Find active point dispute', async ({ page, browserName }) => {
        const email = `Moses-${browserName}@test.example`;
        const org = `LCD-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click()
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-drivers');
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let Ezra = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Ezra'});
        await expect(Ezra.locator('.sponsor-points')).toContainText('100 pts');
        await Ezra.getByRole('button', {name: 'Change points'}).click();
        let pointsCommands = page.locator('section[aria-labelledby="points-heading"]');
        await pointsCommands.locator('#points-direction').selectOption('deduct');
        await pointsCommands.locator('#points-amount').fill('50');
        await pointsCommands.locator('#points-reason').fill('Killed the Distortion');
        await pointsCommands.getByRole('button', {name: 'Deduct points'}).click();
        await expect(Ezra.locator('.sponsor-points')).toContainText('50 pts');
        await Ezra.getByRole('button',{name: 'View as driver'}).click();
        await page.getByRole('button',{name: 'Point dispute'}).click();
        let removal = page.locator('select option',{hasText: 'Distortion'}).getAttribute('value');
        await page.locator('select option').selectOption(removal);
        await page.locator('textarea[required]').fill('I tried my best Team Leader.');
        await page.getByRole('button', { name: 'Open dispute' }).click();
        let banner = page.getByRole('region', {name: 'Sponsor view-as mode banner'});
        await banner.getByRole('button', {name: 'Return to Sponsor View'}).click();
        await page.getByRole('button', {name: 'Dashboard'}).click();
        await page.getByRole('button',{name: 'Point dispute'}).click();
        const EzraDispute = page.locator('tbody tr').filter({hasText: 'Ezra'});
        await expect(EzraDispute).toBeVisible();
        await expect(EzraDispute).toHaveText('Open');
    });

    test('Respond to point dispute and watch the convo update', async ({ page, browserName }) => {
        const email = `Moses-${browserName}@test.example`;
        const org = `LCD-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click()
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-drivers');
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let Ezra = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Ezra'});
        await expect(Ezra.locator('.sponsor-points')).toContainText('100 pts');
        await Ezra.getByRole('button', {name: 'Change points'}).click();
        let pointsCommands = page.locator('section[aria-labelledby="points-heading"]');
        await pointsCommands.locator('#points-direction').selectOption('deduct');
        await pointsCommands.locator('#points-amount').fill('50');
        await pointsCommands.locator('#points-reason').fill('Killed the Distortion');
        await pointsCommands.getByRole('button', {name: 'Deduct points'}).click();
        await expect(Ezra.locator('.sponsor-points')).toContainText('50 pts');
        await page.getByRole('button', {name: 'Dashboard'}).click();
        await expect(Ezra.locator('.sponsor-points')).toContainText('50 pts');
        await page.getByRole('button', {name: 'Dashboard'}).click();
        await page.getByRole('button',{name: 'Point dispute'}).click();
        const EzraDispute = page.locator('tbody tr').filter({hasText: 'Ezra'});
        await EzraDispute.getByRole('button', {name: 'View'}).click();
        await page.getByLabel('Message').fill('Tell me what happened.')
        await page.getByRole('button', { name: 'Send message' }).click();
        let convo = (page.locator('.disputes-messages')).toContainText('Tell me what happened');
        await expect(convo).toBeVisible
    });

    test('Can Driver see convo', async ({ page, browserName }) => {
        const email = `Moses-${browserName}@test.example`;
        const org = `LCD-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click()
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-drivers');
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let Ezra = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Ezra'});
        await Ezra.getByRole('button',{name: 'View as driver'}).click();
        await page.getByRole('button',{name: 'Point dispute'}).click();
        const EzraDispute = page.locator('tbody tr').filter({hasText: 'Ezra'});
        await EzraDispute.getByRole('button', {name: 'View'}).click();
        let convo = (page.locator('.disputes-messages')).toContainText('Tell me what happened');
        await expect(convo).toBeVisible
    });
    test('Accept Dispute and check points', async ({ page, browserName }) => {
        const email = `Moses-${browserName}@test.example`;
        const org = `LCD-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click()
        await page.getByRole('button',{name: 'Point dispute'}).click();
        const EzraDispute = page.locator('tbody tr').filter({hasText: 'Ezra'});
        await EzraDispute.getByRole('button', {name: 'View'}).click();
        await page.getByRole('button',{name: 'Accept dispute'}).click();
        await expect(EzraDispute).toHaveText('Accepted');
        await page.getByRole('button', {name: 'Dashboard'}).click();
        let EzraPostive = RecentActivity.locator('li.sponsor-list-item').filter({hasText: 'Ezra'}).filter({hasText: 'Restored after accepted dispute'});
        await expect(EzraPostive).toBeVisible();
        await expect(EzraPostive).toHaveText('+50 pts');
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let Ezra = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Ezra'});
        await expect(Ezra.locator('.sponsor-points')).toContainText('100 pts');
        await Ezra.getByRole('button', {name: 'Change points'}).click();
        let pointsCommands = page.locator('section[aria-labelledby="points-heading"]');
        await pointsCommands.locator('#points-direction').selectOption('deduct');
        await pointsCommands.locator('#points-amount').fill('50');
        await pointsCommands.locator('#points-reason').fill('Made fun of my height');
        await pointsCommands.getByRole('button', {name: 'Deduct points'}).click();
        await expect(Ezra.locator('.sponsor-points')).toContainText('50 pts');
        await page.getByRole('button', {name: 'Dashboard'}).click();
    });
    test('Deny Dispute and check points', async ({ page, browserName }) => {
        const email = `Moses-${browserName}@test.example`;
        const org = `LCD-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click()
        await Ezra.getByRole('button',{name: 'View as driver'}).click();
        await page.getByRole('button',{name: 'Point dispute'}).click();
        let removal = page.locator('select option',{hasText: 'Height'}).getAttribute('value');
        await page.locator('select option').selectOption(removal);
        await page.locator('textarea[required]').fill('It was really funny though Team Leader.');
        await page.getByRole('button', { name: 'Open dispute' }).click();
        let banner = page.getByRole('region', {name: 'Sponsor view-as mode banner'});
        await banner.getByRole('button', {name: 'Return to Sponsor View'}).click();
        await page.getByRole('button', {name: 'Dashboard'}).click();
        await page.getByRole('button',{name: 'Point dispute'}).click();
        const EzraDispute = page.locator('tbody tr').filter({hasText: 'Height'});
        await expect(EzraDispute).toBeVisible();
        await expect(EzraDispute).toHaveText('Open');
        await EzraDispute.getByRole('button', {name: 'View'}).click();
        await page.getByLabel('Message').fill('Was it now.')
        await page.getByRole('button', { name: 'Send message' }).click();
        let convo = (page.locator('.disputes-messages')).toContainText('Was it now.');
        await expect(convo).toBeVisible
        await page.getByRole('button', { name: 'Deny dispute' }).click();
        await expect(EzraDispute).toHaveText('Denied');
        await page.getByRole('button', {name: 'Dashboard'}).click();
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let Ezra = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Ezra'});
        await expect(Ezra.locator('.sponsor-points')).toContainText('50 pts');
    });

     test('Try to dispute with no message', async ({ page, browserName }) => {
        const email = `Moses-${browserName}@test.example`;
        const org = `LCD-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click()
        await Ezra.getByRole('button',{name: 'View as driver'}).click();
        await page.getByRole('button',{name: 'Point dispute'}).click();
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let Ezra = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Ezra'});
        await expect(Ezra.locator('.sponsor-points')).toContainText('100 pts');
        await Ezra.getByRole('button', {name: 'Change points'}).click();
        let pointsCommands = page.locator('section[aria-labelledby="points-heading"]');
        await pointsCommands.locator('#points-direction').selectOption('deduct');
        await pointsCommands.locator('#points-amount').fill('30');
        await pointsCommands.locator('#points-reason').fill('Broke Something');
        await pointsCommands.getByRole('button', {name: 'Deduct points'}).click();
        await expect(Ezra.locator('.sponsor-points')).toContainText('20 pts');
        await Ezra.getByRole('button', {name: 'View as driver'}).click();
        await page.getByRole('button',{name: 'Point dispute'}).click();
        let removal = page.locator('select option',{hasText: 'Broke'}).getAttribute('value');
        await page.locator('select option').selectOption(removal);
        await page.getByRole('button', { name: 'Open dispute' }).click();
        await expect(page.locator('textarea[required]')).toBeFocused();
        await page.locator('textarea[required]').fill('Sorry');
        await page.getByRole('button', { name: 'Open dispute' }).click();
     });

    test('Try to send message with no ', async ({ page, browserName }) => {
        const email = `Moses-${browserName}@test.example`;
        const org = `LCD-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click()
        await Ezra.getByRole('button',{name: 'View as driver'}).click();
        await page.getByRole('button',{name: 'Point dispute'}).click();
        let removal = page.locator('select option',{hasText: 'Height'}).getAttribute('value');
        await page.locator('select option').selectOption(removal);
        await page.locator('textarea[required]').fill('It was really funny though Team Leader.');
        await page.getByRole('button', { name: 'Open dispute' }).click();
        let banner = page.getByRole('region', {name: 'Sponsor view-as mode banner'});
        await banner.getByRole('button', {name: 'Return to Sponsor View'}).click();
        await page.getByRole('button', {name: 'Dashboard'}).click();
        await page.getByRole('button',{name: 'Point dispute'}).click();
        const EzraDispute = page.locator('tbody tr').filter({hasText: 'Broke'});
        await expect(EzraDispute).toBeVisible();
        await expect(EzraDispute).toHaveText('Open');
        await EzraDispute.getByRole('button', {name: 'View'}).click();
        await page.getByRole('button', { name: 'Send message' }).click();
        await expect(page.getByLabel('Message')).toBeFocused();
    });
});