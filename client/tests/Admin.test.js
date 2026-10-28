import { test, expect } from '@playwright/test';
test.describe.serial('Admin tests', () => {
    test('Edit driver name', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.getByLabel('Name').pressSequentially('John');
        await page.getByLabel('Email').pressSequentially(emaildriver);
        await page.getByLabel('Password', {exact : true}).pressSequentially('password');
        await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
        await page.getByRole('button',{name: 'Create driver account'}).click();
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.getByRole('radio', {name: 'Sponsor'}).check();
        await page.getByLabel('Full name').pressSequentially('Jane');
        await page.getByLabel('Company name', {exact : true}).pressSequentially('clemson');
        await page.getByLabel('Email').pressSequentially(emailsponsor);
        await page.getByLabel('Password', {exact : true}).pressSequentially('password');
        await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
        await page.getByRole('button',{name: 'Create sponsor account'}).click();
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').fill('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await expect(page).toHaveURL('http://localhost:5173/admin-dashboard');
        let row = page.locator('table.admin-table tbody tr').filter({ hasText: emaildriver});
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await page.locator('#edit-name').fill(`JohnTest-${browserName}`);
        await page.getByRole('button', {name: 'Save Account Changes'}).click();
        await page.waitForTimeout(1000);
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await expect(page.locator('#edit-name')).toHaveValue(`JohnTest-${browserName}`);
    });

    test('Edit driver email', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        let row = page.locator('table.admin-table tbody tr').filter({ hasText: emaildriver});
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await page.locator('#edit-email').fill(updatedEmaildriver);
        await page.getByRole('button', {name: 'Save Account Changes'}).click();
        row = page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await expect(page.locator('#edit-email')).toHaveValue(updatedEmaildriver);
    });
    test('Edit driver password', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        let row = page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await page.locator('#edit-password').clear();
        await page.locator('#edit-password').pressSequentially('newpassword');
        await page.getByRole('button', {name: 'Save Account Changes'}).click();
        await page.getByRole('button', {name: 'Log Out'}).click();
        await page.getByLabel('Email', {exact : true}).fill(updatedEmaildriver);
        await page.getByLabel('Password').pressSequentially('newpassword');
        await page.waitForTimeout(1000);
        await page.getByRole('button', {name: 'Log in'}).click();
        await expect(page).toHaveURL('http://localhost:5173/driver-dashboard')
    });

    test('Change Driver Role', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        let row = page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
        await expect(row.locator('.admin-badge')).toHaveText('Driver')
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await page.locator('#edit-role').selectOption('Sponsor');
        await page.getByRole('button', {name: 'Save Account Changes'}).click();
        await expect(row.locator('.admin-badge')).toHaveText('Sponsor')
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await expect(page.locator('#edit-role')).toHaveValue('Sponsor');
        await page.locator('#edit-role').selectOption('Driver');
        await page.getByRole('button', {name: 'Save Account Changes'}).click();
        await expect(row.locator('.admin-badge')).toHaveText('Driver')
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await expect(page.locator('#edit-role')).toHaveValue('Driver');
    });

    test('Change Driver Org', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        let row = page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
        await expect(row.locator('td strong')).toHaveText('Unassigned')
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await page.locator('#edit-sponsor').selectOption('clemson')
        await page.getByRole('button', {name: 'Save Account Changes'}).click();
        await expect(row.locator('td strong')).toHaveText('clemson')
    });

    test('Edit sponsor name', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        let row = page.locator('table.admin-table tbody tr').filter({ hasText: emailsponsor});
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await page.locator('#edit-name').fill('JaneTest');
        await page.getByRole('button', {name: 'Save Account Changes'}).click();
        await page.waitForTimeout(1000);
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await expect(page.locator('#edit-name')).toHaveValue('JaneTest');
    });

    test('Edit Sponsor email', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        let row = page.locator('table.admin-table tbody tr').filter({ hasText: emailsponsor});
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await page.locator('#edit-email').fill(updatedEmailSponsor);
        await page.getByRole('button', {name: 'Save Account Changes'}).click();
        row = page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmailSponsor});
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await expect(page.locator('#edit-email')).toHaveValue(updatedEmailSponsor);
    });

    test('Edit Sponsor Role', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        let row = page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmailSponsor});
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await page.locator('#edit-role').selectOption('Driver');
        await page.getByRole('button', {name: 'Save Account Changes'}).click();
        await expect(row.locator('.admin-badge')).toHaveText('Driver')
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await expect(page.locator('#edit-role')).toHaveValue('Driver');
        await page.locator('#edit-role').selectOption('Sponsor');
        await page.getByRole('button', {name: 'Save Account Changes'}).click();
        await expect(row.locator('.admin-badge')).toHaveText('Sponsor')
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await expect(page.locator('#edit-role')).toHaveValue('Sponsor');
    });

    test('Change Sponsor Org', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        let row = page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmailSponsor});
        await expect(row.locator('td strong')).toHaveText('clemson')
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await page.locator('#edit-sponsor').selectOption('-- Unassigned --')
        await page.getByRole('button', {name: 'Save Account Changes'}).click();
        await expect(row.locator('td strong')).toHaveText('Unassigned')
    });

    test('Edit sponsor password', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        let row = page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmailSponsor});
        await row.getByRole('button',{name: 'Edit / Role'}).click();
        await page.locator('#edit-password').clear();
        await page.locator('#edit-password').pressSequentially('newpassword');
        await page.getByRole('button', {name: 'Save Account Changes'}).click();
        await page.getByRole('button', {name: 'Log Out'}).click();
        await page.getByLabel('Email', {exact : true}).fill(updatedEmailSponsor);
        await page.getByLabel('Password').pressSequentially('newpassword');
        await page.waitForTimeout(1000);
        await page.getByRole('button', {name: 'Log in'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard')
    });

    test('Filter users', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        let rowdriver = await page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
        let rowsponsor = page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmailSponsor});
        await page.getByLabel('Filter by role').selectOption('Driver');
        await expect(rowsponsor).toBeHidden();
        await expect(rowdriver).toBeVisible();
        await page.getByLabel('Filter by role').selectOption('Sponsor');
        await expect(rowsponsor).toBeVisible();
        await expect(rowdriver).toBeHidden();
        await page.getByLabel('Filter by role').selectOption('Admin');
        await expect(rowsponsor).toBeHidden();
        await expect(rowdriver).toBeHidden();
        await page.getByLabel('Filter by role').selectOption('All Roles');
        await expect(rowsponsor).toBeVisible();
        await expect(rowdriver).toBeVisible();
    });

    test('Add points', async ({ page, browserName }) => {
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('tab', {name: 'Driver & Sponsor Operations'}).click()
        let rowdriver = await page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
        const driverID = await page.locator('#op-driver').locator('option').filter({hasText: updatedEmaildriver}).getAttribute('value')
        await page.locator('#op-driver').selectOption(driverID)
        await page.locator('#op-points').fill('50');
        await page.locator('#op-reason').fill('On-Time delivery');
        await page.getByRole('button',{name: 'Apply Point Change'}).click();
        await expect(rowdriver).toContainText('50 pts')
    });
    test('Deduct points', async ({ page, browserName }) => {
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('tab', {name: 'Driver & Sponsor Operations'}).click()
        let rowdriver = await page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
         const driverID = await page.locator('#op-driver').locator('option').filter({hasText: updatedEmaildriver}).getAttribute('value')
        await page.locator('#op-driver').selectOption(driverID)
        await page.locator('#op-points').fill('-25');
        await page.locator('#op-reason').fill('Bad Driving');
        await page.getByRole('button',{name: 'Apply Point Change'}).click();
        await expect(rowdriver).toContainText('25 pts')
    });
    test('Assign to sponsor', async ({ page, browserName }) => {
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('tab', {name: 'Driver & Sponsor Operations'}).click()
        let rowdriver = await page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
        let driverID = await page.locator('#aff-driver').locator('option').filter({hasText: `JohnTest-${browserName}`}).getAttribute('value');
        let SponsorID = await page.locator('#aff-sponsor').locator('option').filter({hasText: 'clemson', exact : true}).getAttribute('value');
        await page.locator('#aff-driver').selectOption(driverID);
        await page.locator('#aff-sponsor').selectOption(SponsorID);
        await page.locator('#aff-reason').fill('Application Approved');
        await page.getByRole('button',{name: 'Assign Driver to Sponsor'}).click();
        await expect(rowdriver).toContainText('clemson')
    });
    test('Drop from sponsor', async ({ page, browserName }) => {
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        page.on('dialog', async dialog => {
            await dialog.accept('Violation of sponsorship agreement');
        })
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('tab', {name: 'Driver & Sponsor Operations'}).click()
        let rowdriver = await page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
        await rowdriver.getByRole('button', {name: 'Drop from Sponsor'}).click();
        await expect(rowdriver).toContainText('Unassigned')
    });
    test('Try to Assign without selecting a sponsor', async ({ page, browserName }) => {
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('tab', {name: 'Driver & Sponsor Operations'}).click()
        let rowdriver = await page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
        let driverID = await page.locator('#aff-driver').locator('option').filter({hasText: `JohnTest-${browserName}`}).getAttribute('value');
        let SponsorID = await page.locator('#aff-sponsor').locator('option').filter({hasText: 'clemson', exact : true}).getAttribute('value');
        await page.locator('#aff-driver').selectOption(driverID);
        await page.getByRole('button',{name: 'Assign Driver to Sponsor'}).click();

    });
    test('Try to Assign to sponsor with no reason', async ({ page, browserName }) => {
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('tab', {name: 'Driver & Sponsor Operations'}).click()
        let rowdriver = await page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
        let driverID = await page.locator('#aff-driver').locator('option').filter({hasText: `JohnTest-${browserName}`}).getAttribute('value');
        let SponsorID = await page.locator('#aff-sponsor').locator('option').filter({hasText: 'clemson', exact : true}).getAttribute('value');
        await page.locator('#aff-driver').selectOption(driverID)
        await page.locator('#aff-sponsor').selectOption(SponsorID);
        await page.getByRole('button',{name: 'Assign Driver to Sponsor'}).click();


    });

    test('Make a new sponsor', async ({ page, browserName }) => {
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        const newSponsor = `New Sponsor-${browserName}`
        await page.getByRole('tab', {name: 'Driver & Sponsor Operations'}).click()
        await page.locator('#sp-name').fill(newSponsor);
        await page.locator('#sp-value').fill('0.02')
        await page.getByRole('button', {name: 'Add Sponsor Organization'}).click();
        const SponsorRow = page.locator('tr').filter({hasText: newSponsor});
        await expect(SponsorRow).toHaveText(`${newSponsor}$0.0200`);
  
    });
    test('Assign User to newly created Sponsor', async ({ page, browserName }) => {
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const newSponsor = `New Sponsor-${browserName}`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('tab', {name: 'Driver & Sponsor Operations'}).click()
        let rowdriver = await page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
        let driverID = await page.locator('#aff-driver').locator('option').filter({hasText: `JohnTest-${browserName}`}).getAttribute('value');
        let SponsorID = await page.locator('#aff-sponsor').locator('option').filter({hasText: newSponsor}).getAttribute('value');
        await page.locator('#aff-driver').selectOption(driverID)
        await page.locator('#aff-sponsor').selectOption(SponsorID);
        await page.locator('#aff-reason').fill('Application Approved');
        await page.getByRole('button', {name: 'Assign Driver to Sponsor'}).click();
        await expect(rowdriver).toContainText(newSponsor)
    });
    test('View as standard Driver', async ({ page, browserName }) => {
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button', {name: 'View as Standard Driver'}).click();
        await expect(page).toHaveURL('http://localhost:5173/driver-dashboard');
        let banner = page.getByRole('region', {name: 'Admin view-as mode banner'});
        await expect(banner).toContainText('Admin View-As Mode');
        await banner.getByRole('button', {name: 'Return to Admin Panel'}).click();
        await expect(page).toHaveURL('http://localhost:5173/admin-dashboard')
    });

    test('View as specific Driver', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        let row = page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmaildriver});
        await row.getByRole('button',{name: 'View As Driver'}).click();
        await expect(page).toHaveURL('http://localhost:5173/driver-dashboard');
        let banner = page.getByRole('region', {name: 'Admin view-as mode banner'});
        await expect(banner).toContainText('Admin View-As Mode');
        let dashboard = page.getByRole('heading', {name: `Welcome back, JohnTest-${browserName}`});
        await expect(dashboard).toBeVisible();
        await banner.getByRole('button', {name: 'Return to Admin Panel'}).click();
        await expect(page).toHaveURL('http://localhost:5173/admin-dashboard')
    });

    test('View as standard Sponsor', async ({ page, browserName }) => {
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        await page.getByRole('button', {name: 'View as Standard Sponsor'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        let banner = page.getByRole('region', {name: 'Admin view-as mode banner'});
        await expect(banner).toContainText('Admin View-As Mode');
        await banner.getByRole('button', {name: 'Return to Admin Panel'}).click();
        await expect(page).toHaveURL('http://localhost:5173/admin-dashboard')
    });

    test('View as specific Sponsor', async ({ page, browserName }) => {
        const emaildriver = `admintestingdriver-${browserName}@test.example`;
        const updatedEmaildriver = `admintesteddriver-${browserName}@test.example`;
        const emailsponsor = `admintestingsponsor-${browserName}@test.example`;
        const updatedEmailSponsor = `admintestedsponsro-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Login' }).click();
        await page.getByLabel('Email').fill('admin@email.com');
        await page.getByLabel('Password').pressSequentially('AdminTest');
        await page.getByRole('button', {name: 'Log in'}).click();
        let row = page.locator('table.admin-table tbody tr').filter({ hasText: updatedEmailSponsor});
        await row.getByRole('button',{name: 'View As Sponsor'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        let banner = page.getByRole('region', {name: 'Admin view-as mode banner'});
        await expect(banner).toContainText('Admin View-As Mode');
        await banner.getByRole('button', {name: 'Return to Admin Panel'}).click();
        await expect(page).toHaveURL('http://localhost:5173/admin-dashboard')
    });
});