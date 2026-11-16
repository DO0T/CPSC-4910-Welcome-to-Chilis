import { test, expect } from '@playwright/test';
test.describe.serial('Audit-Log tests', () => {
    test('Find Audit Logs', async ({ page, browserName }) => {
        const emaildriver = `Roland-${browserName}@test.example`;
        const emailsponsor = `Angela-${browserName}@test.example`;
        const testsponsor = `Library-${browserName}`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.getByLabel('Name').pressSequentially('Roland');
        await page.getByLabel('Email').pressSequentially(emaildriver);
        await page.getByLabel('Password', {exact : true}).pressSequentially('password');
        await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
        await page.getByRole('button',{name: 'Create driver account'}).click();
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.getByRole('radio', {name: 'Sponsor'}).check();
        await page.getByLabel('Full name').pressSequentially('Angela');
        await page.getByLabel('Company name', {exact : true}).pressSequentially(testsponsor);
        await page.getByLabel('Email').pressSequentially(emailsponsor);
        await page.getByLabel('Password', {exact : true}).pressSequentially('password');
        await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
        await page.getByRole('button',{name: 'Create sponsor account'}).click();
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill(emaildriver);
        await page.getByLabel('Password').fill('fail');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill(emaildriver);
        await page.getByLabel('Password').fill('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button',{name: 'log out'}).click();
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill(emailsponsor);
        await page.getByLabel('Password').fill('fail');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill(emailsponsor);
        await page.getByLabel('Password').fill('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button',{name: 'log out'}).click();
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').fill('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await expect(page).toHaveURL('http://localhost:5173/admin-dashboard');
        await page.getByRole('button', {name: 'audit logs'}).click();
        await expect(page.getByRole('region', {name: 'System Audit Logs'})).toBeVisible();
    });
    test('Audit Logs are being created', async ({ page, browserName }) => {
        const emaildriver = `Roland-${browserName}@test.example`;
        const emailsponsor = `Angela-${browserName}@test.example`;
        const testsponsor = `Library-${browserName}`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').fill('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button', {name: 'audit logs'}).click();
        const auditSection = page.locator('.admin-card').filter({ has: page.getByRole('heading', { name: 'System Audit Logs' }) });
        if(auditSection.getByRole('button', {name: 'Show more'}).isEnabled()){
            await auditSection.getByRole('button', {name: 'Show more'}).click()
        }
        let auditTable = page.locator('.admin-table');
        let Rolandsucceed = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Success'});
        let Rolandfail = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Failure'});
        await expect(Rolandsucceed).toBeVisible();
        await expect(Rolandfail).toBeVisible();
        let Angelasucceed = auditTable.getByRole('row').filter({hasText: emailsponsor}).filter({hasText: 'Success'});
        let Angelafail = auditTable.getByRole('row').filter({hasText: emailsponsor}).filter({hasText: 'Failure'});
        await expect(Angelasucceed).toBeVisible();
        await expect(Angelafail).toBeVisible();
    });
    
     test('Filter by Role', async ({ page, browserName }) => {
        const emaildriver = `Roland-${browserName}@test.example`;
        const emailsponsor = `Angela-${browserName}@test.example`;
        const testsponsor = `Library-${browserName}`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').fill('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button', {name: 'audit logs'}).click();
        const auditSection = page.locator('.admin-card').filter({ has: page.getByRole('heading', { name: 'System Audit Logs' }) });
        if(auditSection.getByRole('button', {name: 'Show more'}).isEnabled()){
            await auditSection.getByRole('button', {name: 'Show more'}).click()
        }
        let auditTable = page.locator('.admin-table');
        let Rolandsucceed = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Login Attempt'}).filter({hasText: 'Success'});
        let Rolandfail = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Login Attempt'}).filter({hasText: 'Failure'});
        let Angelasucceed = auditTable.getByRole('row').filter({hasText: emailsponsor}).filter({hasText: 'Login Attempt'}).filter({hasText: 'Success'});
        let Angelafail = auditTable.getByRole('row').filter({hasText: emailsponsor}).filter({hasText: 'Login Attempt'}).filter({hasText: 'Failure'});
        await page.locator('#log-role').selectOption('Driver');
        await page.getByRole('button', {name: 'Apply Filters'}).click();
        await expect(Rolandsucceed).toBeVisible();
        await expect(Rolandfail).toBeVisible();
        await expect(Angelasucceed).toBeHidden();
        await expect(Angelafail).toBeHidden();
        await page.locator('#log-role').selectOption('Sponsor');
        await page.getByRole('button', {name: 'Apply Filters'}).click();
        await expect(Rolandsucceed).toBeHidden();
        await expect(Rolandfail).toBeHidden();
        await expect(Angelasucceed).toBeVisible();
        await expect(Angelafail).toBeVisible();
        await page.locator('#log-role').selectOption('Admin');
        await page.getByRole('button', {name: 'Apply Filters'}).click();
        await expect(Rolandsucceed).toBeHidden();
        await expect(Rolandfail).toBeHidden();
        await expect(Angelasucceed).toBeHidden();
        await expect(Angelafail).toBeHidden();
        await page.locator('#log-role').selectOption('All');
        await page.getByRole('button', {name: 'Apply Filters'}).click();
        await expect(Rolandsucceed).toBeVisible();
        await expect(Rolandfail).toBeVisible();
        await expect(Angelasucceed).toBeVisible();
        await expect(Angelafail).toBeVisible();
    });
     test('Filter by Date', async ({ page, browserName }) => {
        const emaildriver = `Roland-${browserName}@test.example`;
        const emailsponsor = `Angela-${browserName}@test.example`;
        const testsponsor = `Library-${browserName}`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').fill('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button', {name: 'audit logs'}).click();
        const auditSection = page.locator('.admin-card').filter({ has: page.getByRole('heading', { name: 'System Audit Logs' }) });
        if(auditSection.getByRole('button', {name: 'Show more'}).isEnabled()){
            await auditSection.getByRole('button', {name: 'Show more'}).click()
        }
        let auditTable = page.locator('.admin-table');
        let Rolandsucceed = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Login Attempt'}).filter({hasText: 'Success'});
        let Rolandfail = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Login Attempt'}).filter({hasText: 'Failure'});
        let Angelasucceed = auditTable.getByRole('row').filter({hasText: emailsponsor}).filter({hasText: 'Login Attempt'}).filter({hasText: 'Success'});
        let Angelafail = auditTable.getByRole('row').filter({hasText: emailsponsor}).filter({hasText: 'Login Attempt'}).filter({hasText: 'Failure'});
        let Datefilter = new Date().toLocaleDateString('en-CA');
        await page.locator('#log-start').fill(Datefilter);
        await page.locator('#log-end').fill(Datefilter);
        await page.getByRole('button', {name: 'Apply Filters'}).click();
        await expect(Rolandsucceed).toBeVisible();
        await expect(Rolandfail).toBeVisible();
        await expect(Angelasucceed).toBeVisible();
        await expect(Angelafail).toBeVisible();
        await page.locator('#log-start').fill('2025-01-01');
        await page.locator('#log-end').fill('2025-01-01');
        await page.getByRole('button', {name: 'Apply Filters'}).click();
        await expect(Rolandsucceed).toBeHidden();
        await expect(Rolandfail).toBeHidden();
        await expect(Angelasucceed).toBeHidden();
        await expect(Angelafail).toBeHidden();
    });
    test('Password change audits', async ({ page, browserName }) => {
        const emaildriver = `Roland-${browserName}@test.example`;
        const emailsponsor = `Angela-${browserName}@test.example`;
        const testsponsor = `Library-${browserName}`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').fill('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        const Rolandrow = page.locator('.admin-table tbody tr').filter({ hasText: emaildriver });
        await Rolandrow.getByRole('button', { name: 'Edit / Role' }).click();
        const popup = page.locator('dialog.admin-user-dialog');
        await popup.locator('#edit-password').fill('password1');  
        await popup.getByRole('button', { name: 'Save Account Changes' }).click();
        await page.getByRole('button', {name: 'audit logs'}).click();
        const auditSection = page.locator('.admin-card').filter({ has: page.getByRole('heading', { name: 'System Audit Logs' }) });
        if(auditSection.getByRole('button', {name: 'Show more'}).isEnabled()){
            await auditSection.getByRole('button', {name: 'Show more'}).click()
        }
        let auditTable = page.locator('.admin-table');
        let Rolandsucceed = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Password Change'}).filter({hasText: 'Success'});
        await expect(Rolandsucceed).toContainText('Admin reset password for User')
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill(emailsponsor);
        await page.getByLabel('Password').fill('password');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button',{name: 'Edit profile'}).click();
        await page.locator('#current-password').fill('password');
        await page.locator('#new-password').fill('password1');
        await page.locator('#confirm-password').fill('password1');
        await page.getByRole('button', { name: 'Save changes' }).click();
        await page.getByRole('button', {name: 'Log Out'}).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').fill('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button', {name: 'Audit logs'}).click();
        if(auditSection.getByRole('button', {name: 'Show more'}).isEnabled()){
            await auditSection.getByRole('button', {name: 'Show more'}).click()
        }
        let Angelasucceed = auditTable.getByRole('row').filter({hasText: emailsponsor}).filter({hasText: 'Password Change'}).filter({hasText: 'Success'});
        await expect(Angelasucceed).toContainText('Password changed through profile update')
    });
    test('Application Audits', async ({ page, browserName }) => {
        const emaildriver = `Roland-${browserName}@test.example`;
        const emailsponsor = `Angela-${browserName}@test.example`;
        const testsponsor = `Library-${browserName}`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill(emaildriver);
        await page.getByLabel('Password').fill('password1');
        await page.getByRole('button', {name: 'Log in'}).click();
        const sponsorSection = page.locator('.dashboard-card').filter({ has: page.getByRole('heading', { name: 'Apply to a sponsor' }) });
        if(sponsorSection.getByRole('button', {name: 'Show more'}).isEnabled()){
            await auditSection.getByRole('button', {name: 'Show more'}).click()
        }
        let sponsor = await sponsorSection.locator('.dashboard-sponsor-item').filter({has: page.getByRole('heading', {name: testsponsor})});
        await sponsor.getByRole('button', {name: 'Apply to sponsor'}).click();
        await page.getByRole('button', {name: 'Log Out'}).click();
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill(emailsponsor);
        await page.getByLabel('Password').fill('password1');
        await page.getByRole('button', {name: 'Log in'}).click();
        let driverApps = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Pending applications'})});
        await driverApps.getByRole('button', {name: `Approve Roland`}).click();
        await driverApps.getByRole('button', {name: `Approve Driver`}).click();
     });
      test('Point change Audits', async ({ page, browserName }) => {
        const emaildriver = `Roland-${browserName}@test.example`;
        const emailsponsor = `Angela-${browserName}@test.example`;
        const testsponsor = `Library-${browserName}`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill(emailsponsor);
        await page.getByLabel('Password').fill('password1');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button', {name: 'Drivers & points'})
        let sponsorDrivers = page.locator('section[aria-labelledby="drivers-heading"]');
        let Roland = sponsorDrivers.locator('li.sponsor-list-item').filter({hasText: 'Roland'});
        await Roland.getByRole('button', {name: 'Change points'}).click();
        let popup = page.locator('dialog.sponsor-action-dialog');
        await popup.locator('#points-direction').selectOption('Add');
        await popup.locator('#points-amount').fill('50');
        await popup.locator('#points-reason').fill('Patron Librarian of General Works');
        await popup.getByRole('button', {name: 'Add points'}).click();
        await Roland.getByRole('button', {name: 'Change points'}).click();
        await popup.locator('#points-direction').selectOption('Deduct');
        await popup.locator('#points-amount').fill('50');
        await popup.locator('#points-reason').fill('Dropped A book');
        await popup.getByRole('button', {name: 'Deduct points'}).click();
        await page.getByRole('button', {name: 'Log Out'}).click();
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').fill('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button', {name: 'audit logs'}).click();
        let auditTable = page.locator('.admin-table');
        const auditSection = page.locator('.admin-card').filter({ has: page.getByRole('heading', { name: 'System Audit Logs' }) });
        if(auditSection.getByRole('button', {name: 'Show more'}).isEnabled()){
            await auditSection.getByRole('button', {name: 'Show more'}).click()
        }
        let Rolandadd = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Point Change'}).filter({hasText: 'Patron Librarian of General Works'});
        let Rolandminus = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Point Change'}).filter({hasText: 'Dropped A book'});
        await expect(Rolandadd).toBeVisible();
        await expect(Rolandminus).toBeVisible();
    });
    test('Filter by Category', async ({ page, browserName }) => {
        const emaildriver = `Roland-${browserName}@test.example`;
        const emailsponsor = `Angela-${browserName}@test.example`;
        const testsponsor = `Library-${browserName}`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').fill('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button', {name: 'audit logs'}).click();
        const auditSection = page.locator('.admin-card').filter({ has: page.getByRole('heading', { name: 'System Audit Logs' }) });
        if(auditSection.getByRole('button', {name: 'Show more'}).isEnabled()){
            await auditSection.getByRole('button', {name: 'Show more'}).click()
        }
        let auditTable = page.locator('.admin-table');
        let Rolandsucceed = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Login Attempt'}).filter({hasText: 'Success'});
        let Rolandfail = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Login Attempt'}).filter({hasText: 'Failure'});
        let Angelasucceed = auditTable.getByRole('row').filter({hasText: emailsponsor}).filter({hasText: 'Login Attempt'}).filter({hasText: 'Success'});
        let Angelafail = auditTable.getByRole('row').filter({hasText: emailsponsor}).filter({hasText: 'Login Attempt'}).filter({hasText: 'Failure'});
        let RolandPassword = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Password Change'}).filter({hasText: 'Success'});
        let AngelaPassword = auditTable.getByRole('row').filter({hasText: emailsponsor}).filter({hasText: 'Password Change'}).filter({hasText: 'Success'});
        let Rolandadd = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Point Change'}).filter({hasText: 'Patron Librarian of General Works'});
        let Rolandminus = auditTable.getByRole('row').filter({hasText: emaildriver}).filter({hasText: 'Point Change'}).filter({hasText: 'Dropped A book'});
        await page.locator('#log-category').selectOption('Login Attempt');
        await page.getByRole('button', {name: 'Apply Filters'}).click();
        await expect(Rolandsucceed).toBeVisible();
        await expect(Rolandfail).toBeVisible();
        await expect(Angelasucceed).toBeVisible();
        await expect(Angelafail).toBeVisible();
        await expect(RolandPassword).toBeHidden();
        await expect(AngelaPassword).toBeHidden();
        await expect(Rolandadd).toBeHidden();
        await expect(Rolandminus).toBeHidden();
        await page.locator('#log-category').selectOption('Password Change');
        await page.getByRole('button', {name: 'Apply Filters'}).click();
        await expect(Rolandsucceed).toBeHidden();
        await expect(Rolandfail).toBeHidden();
        await expect(Angelasucceed).toBeHidden();
        await expect(Angelafail).toBeHidden();
        await expect(RolandPassword).toBeVisible();
        await expect(AngelaPassword).toBeVisible();
        await expect(Rolandadd).toBeHidden();
        await expect(Rolandminus).toBeHidden();
        await page.locator('#log-category').selectOption('Point Change');
        await page.getByRole('button', {name: 'Apply Filters'}).click();
        await expect(Rolandsucceed).toBeHidden();
        await expect(Rolandfail).toBeHidden();
        await expect(Angelasucceed).toBeHidden();
        await expect(Angelafail).toBeHidden();
        await expect(RolandPassword).toBeHidden();
        await expect(AngelaPassword).toBeHidden();
        await expect(Rolandadd).toBeVisible();
        await expect(Rolandminus).toBeVisible();
        await page.locator('#log-category').selectOption('All');
        await page.getByRole('button', {name: 'Apply Filters'}).click();
        await expect(Rolandsucceed).toBeVisible();
        await expect(Rolandfail).toBeVisible();
        await expect(Angelasucceed).toBeVisible();
        await expect(Angelafail).toBeVisible();
        await expect(RolandPassword).toBeVisible();
        await expect(AngelaPassword).toBeVisible();
        await expect(Rolandadd).toBeVisible();
        await expect(Rolandminus).toBeVisible();

    });
});