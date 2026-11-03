import { test, expect } from '@playwright/test';

test.describe.serial('Sponsor Commands', () => {
    test('Sponsor Bulk add drivers', async ({ page, browserName }) => {
        const email = `Dias-${browserName}@test.example`;
        const org = `LCB-${browserName}`;
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
        await bulkloading.locator('#sponsor-bulk-textarea').fill(`D||Manager|Dante|Dante-${browserName}@email.com|100|Manager\nD||Gregor|Samsa|Gregor-${browserName}@email.com\nD||Emil|Sinclair|Sinclair-${browserName}@email.com`)
        await bulkloading.getByRole('button',{name: 'Upload & Process File'}).click();
        let success = bulkloading.locator('strong',{name: 'Bulk file processing complete'});
        await expect(success).toBeVisible();
        await expect(success).toContainText('Total Lines Processed: 3');
        await expect(success).toContainText('Drivers Created (Auto-Accepted): 3');
    });

    test('Sponsor Fail Bulk Adding', async ({ page, browserName }) => {
        const email = `Dias-${browserName}@test.example`;
        const org = `LCB-${browserName}`;
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
        await bulkloading.locator('#sponsor-bulk-textarea').fill(`D||Manager|Dante|`)
        await bulkloading.getByRole('button',{name: 'Upload & Process File'}).click();
        let success = bulkloading.locator('strong',{name: 'Bulk file processing complete'});
        await expect(success).toBeVisible();
        await expect(success).toContainText('Total Lines Processed: 1');
        await expect(success).toContainText('Drivers Created (Auto-Accepted): 0');
        await bulkloading.locator('#sponsor-bulk-textarea').fill(`D||Manager|Dante|Dante-${browserName}@email.com|100`)
        await bulkloading.getByRole('button',{name: 'Upload & Process File'}).click();
        await expect(success).toBeVisible();
        await expect(success).toContainText('Total Lines Processed: 1');
        await expect(success).toContainText('Drivers Created (Auto-Accepted): 0');
        await expect(success).toContainText('Line 1 [Skipped]: Points field is present, but the required reason for points field is missing. Line skipped.');
        await bulkloading.locator('#sponsor-bulk-textarea').fill(`D||Manager|Dante|Dante`)
        await bulkloading.getByRole('button',{name: 'Upload & Process File'}).click();
        await expect(success).toContainText('Total Lines Processed: 1');
        await expect(success).toContainText('Drivers Created (Auto-Accepted): 0');
        await expect(success).toContainText('Line 1 [Skipped]: First name, last name, and email address are required for Driver and Sponsor records. Line skipped.');
        await bulkloading.locator('#sponsor-bulk-textarea').fill(`D||Manager|Dante|Dante-${browserName}@email.com|Manager`)
        await bulkloading.getByRole('button',{name: 'Upload & Process File'}).click();
        await expect(success).toContainText('Total Lines Processed: 1');
        await expect(success).toContainText('Drivers Created (Auto-Accepted): 0');
        await expect(success).toContainText('Line 1 [Skipped]: Invalid points value "points". Points must be an integer. Line skipped.');
        await bulkloading.locator('#sponsor-bulk-textarea').fill(`D||Yi|Sang|Yisang-${browserName}@email.com|\nD||Manager|Dante|Dante-${browserName}@email.com|Manager`)
        await bulkloading.getByRole('button',{name: 'Upload & Process File'}).click();
        await expect(success).toContainText('Total Lines Processed: 2');
        await expect(success).toContainText('Drivers Created (Auto-Accepted): 1');
        await expect(success).toContainText('Line 2 [Skipped]: Points field is present, but the required reason for points field is missing. Line skipped.');
    });


    test('Sponsor Find Drivers', async ({ page, browserName }) => {
        const email = `Dias-${browserName}@test.example`;
        const org = `LCB-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-drivers');
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let Dante = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Dante'});
        let Gregor = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Gregor'});
        let Sinclair = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Sinclair'});
        await expect(Dante).toBeVisible();
        await expect(Gregor).toBeVisible();
        await expect(Sinclair).toBeVisible();
    });

    test('Sponsor Deduct Drivers and check activity log', async ({ page, browserName }) => {
        const email =`Dias-${browserName}@test.example`;
        const org = `LCB-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-drivers');
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let Dante = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Dante'});
        await expect(Dante.locator('.sponsor-points')).toContainText('100 pts');
        await Dante.getByRole('button', {name: 'Change points'}).click();
        let pointsCommands = page.locator('section[aria-labelledby="points-heading"]');
        await pointsCommands.locator('#points-direction').selectOption('deduct');
        await pointsCommands.locator('#points-amount').fill('50');
        await pointsCommands.locator('#points-reason').fill('Bad managing');
        await pointsCommands.getByRole('button', {name: 'Deduct points'}).click();
        await expect(Dante.locator('.sponsor-points')).toContainText('50 pts');
        await page.getByRole('button', {name: 'Dashboard'}).click();
        let RecentActivity = page.locator('section[aria-labelledby="sponsor-activity-heading"]');
        let DantePostive = RecentActivity.locator('li.sponsor-list-item').filter({hasText: 'Dante'}).filter({hasText: 'Manager'});
        let DanteNegative = RecentActivity.locator('li.sponsor-list-item').filter({hasText: 'Dante'}).filter({hasText: 'Bad managing'});
        await expect(DantePostive).toHaveText('Manager');
        await expect(DantePostive).toHaveText('+100 pts');
        await expect(DanteNegative).toHaveText('Bad managing');
        await expect(DanteNegative).toHaveText('-50 pts');
    });
    
    test('Sponsor Add Drivers Points and check activity log', async ({ page, browserName }) => {
        const email = `Dias-${browserName}@test.example`;
        const org = `LCB-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-drivers');
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let Gregor = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Gregor'});
        await expect(Gregor.locator('.sponsor-points')).toContainText('0 pts');
        await Gregor.getByRole('button', {name: 'Change points'}).click();
        let pointsCommands = page.locator('section[aria-labelledby="points-heading"]');
        await pointsCommands.locator('#points-direction').selectOption('add');
        await pointsCommands.locator('#points-amount').fill('50');
        await pointsCommands.locator('#points-reason').fill('Roach Emperor');
        await pointsCommands.getByRole('button', {name: 'Add points'}).click();
        await expect(Gregor.locator('.sponsor-points')).toContainText('50 pts');
        await page.getByRole('button', {name: 'Dashboard'}).click();
        let RecentActivity = page.locator('section[aria-labelledby="sponsor-activity-heading"]');
        let GregorAlert = RecentActivity.locator('li.sponsor-list-item').filter({hasText: 'Gregor'});
        await expect(GregortAlert).toHaveText('Roach Emperor');
        await expect(GregorAlert).toHaveText('+50 pts');
    });
    test('Sponsor Add Driver', async ({ page, browserName }) => {
        const email = `Dias-${browserName}@test.example`;
        const org = `LCB-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-drivers');
        let addDrivers= await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Add a driver'})});
        await addDrivers.getByLabel('Full name').fill('Rodion Romanovich');
        await addDrivers.getByLabel('Email').fill(`Rodion-${browserName}@email.com`);
        await addDrivers.getByLabel('Temporary password').fill('password');
        await addDrivers.getByRole('button', {name: 'Add driver'}).click();
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let Rodya = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Rodion Romanovich'})
        await expect(Rodya).toBeVisible();
    });

    test('Sponsor Fail to Add Driver', async ({ page, browserName }) => {
        const email = `Dias-${browserName}@test.example`;
        const org = `LCB-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-drivers');
        let addDrivers= await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Add a driver'})});
        await addDrivers.getByLabel('Email').fill(`Outis-${browserName}@email.com`);
        await addDrivers.getByLabel('Temporary password').fill('password');
        await addDrivers.getByRole('button', {name: 'Add driver'}).click();
        await expect(addDrivers.getByLabel('Full name')).toBeFocused();
        await addDrivers.getByLabel('Full name').fill('Outis');
        await addDrivers.getByLabel('Email').fill(`Outis`);
        await addDrivers.getByRole('button', {name: 'Add driver'}).click();
        await expect(addDrivers.getByLabel('Email')).toBeFocused();
        await addDrivers.getByLabel('Temporary password').fill('');
        await addDrivers.getByLabel('Email').fill(`Outis-${browserName}@email.com`);
        await addDrivers.getByRole('button', {name: 'Add driver'}).click();
        await expect(addDrivers.getByLabel('Temporary password')).toBeFocused();
    });

        test('New Sponsor can view all changes', async ({ page, browserName }) => {
        const org = `LCB-${browserName}`;
        const newSponsor = `Vergilius-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.getByRole('radio', {name: 'Sponsor'}).check();
        await page.getByLabel('Full name').pressSequentially('Vergilius');
        await page.getByLabel('Company name', {exact : true}).pressSequentially(org);
        await page.getByLabel('Email').pressSequentially(newSponsor);
        await page.getByLabel('Password', {exact : true}).pressSequentially('password');
        await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
        await page.getByRole('button',{name: 'Create sponsor account'}).click();
        await page.goto('http://localhost:5173/login');
        await page.waitForTimeout(1000);
        await page.getByLabel('Email').fill(newSponsor);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'Log in'}).click()
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        let DantePostive = RecentActivity.locator('li.sponsor-list-item').filter({hasText: 'Dante'}).filter({hasText: 'Manager'});
        let DanteNegative = RecentActivity.locator('li.sponsor-list-item').filter({hasText: 'Dante'}).filter({hasText: 'Bad managing'});
        let GregorAlert = RecentActivity.locator('li.sponsor-list-item').filter({hasText: 'Gregor'});
        await expect(GregortAlert).toHaveText('Roach Emperor');
        await expect(GregorAlert).toHaveText('+50 pts');
        await expect(DantePostive).toHaveText('Manager');
        await expect(DantePostive).toHaveText('+100 pts');
        await expect(DanteNegative).toHaveText('Bad managing');
        await expect(DanteNegative).toHaveText('-50 pts');
        await page.getByRole('button', {name: 'Drivers & points'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-drivers');
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let Dante = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Dante'});
        let Gregor = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Gregor'});
        let Sinclair = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Sinclair'});
        let Rodya = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Rodion Romanovich'})
        await expect(Rodya).toBeVisible();
        await expect(Dante).toBeVisible();
        await expect(Gregor).toBeVisible();
        await expect(Sinclair).toBeVisible();
        await expect(Dante.locator('.sponsor-points')).toContainText('50 pts');
        await expect(Gregor.locator('.sponsor-points')).toContainText('50 pts');
    });
});