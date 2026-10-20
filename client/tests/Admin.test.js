import { test, expect } from '@playwright/test';
test.describe.serial('Admin tests', () => {
    test('Edit driver name', async ({ page, browserName }) => {
    const emaildriver = `AdmintestingDriver-${browserName}@test.example`;
    const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
    const emailsponsor = `AdminTestingSponsor-${browserName}@test.example`;
    const updatedEmailSponsor = `AdmintestedSponsro-${browserName}@test.example`;
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
    await page.getByLabel('Name', {exact : true}).pressSequentially('Jane');
    await page.getByLabel('Company name', {exact : true}).pressSequentially('clemson');
    await page.getByLabel('Email').pressSequentially(emailsponsor);
    await page.getByLabel('Password', {exact : true}).pressSequentially('password');
    await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
    await page.getByRole('button',{name: 'Create sponsor account'}).click();
    await page.goto('http://localhost:5173/admin-dashboard');
    const row = page.locator('tr').filter({hasText: emaildriver});
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await page.locator('#edit-name').fill('JohnTest');
    await page.getByLabel('button', {name: 'Save Account Changes'}).click();
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await expect(page.locator('#edit-name')).toHaveValue('JohnTest');
    });

    test('Edit driver email', async ({ page, browserName }) => {
    const emaildriver = `AdmintestingDriver-${browserName}@test.example`;
    const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
    const emailsponsor = `AdminTestingSponsor-${browserName}@test.example`;
    const updatedEmailSponsor = `AdmintestedSponsro-${browserName}@test.example`
    await page.goto('http://localhost:5173/admin-dashboard');
    const row = page.locator('tr').filter({hasText: emaildriver});
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await page.locator('#edit-Email').fill(updatedEmaildriver);
    await page.getByLabel('button', {name: 'Save Account Changes'}).click();
    row = page.locator('tr').filter({hasText: updatedEmaildriver});
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await expect(page.locator('#edit-Email')).toHaveValue(updatedEmaildriver);
    });

    test('Change Driver Role', async ({ page, browserName }) => {
    const emaildriver = `AdmintestingDriver-${browserName}@test.example`;
    const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
    const emailsponsor = `AdminTestingSponsor-${browserName}@test.example`;
    const updatedEmailSponsor = `AdmintestedSponsro-${browserName}@test.example`
    await page.goto('http://localhost:5173/admin-dashboard');
    const row = page.locator('tr').filter({hasText: updatedEmailDriver});
    await expect(row.locator('.admin-badge')).toHaveText('Driver')
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await page.locator('#edit-role').selectOption('Sponsor');
    await page.getByLabel('button', {name: 'Save Account Changes'}).click();
    await expect(row.locator('.admin-badge')).toHaveText('Sponsor')
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await expect(page.locator('#edit-role')).toHaveValue('Sponsor');
    await page.locator('#edit-role').selectOption('Driver');
    await page.getByLabel('button', {name: 'Save Account Changes'}).click();
    await expect(row.locator('.admin-badge')).toHaveText('Driver')
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await expect(page.locator('#edit-role')).toHaveValue('Driver');
    });

    test('Change Driver Org', async ({ page, browserName }) => {
    const emaildriver = `AdmintestingDriver-${browserName}@test.example`;
    const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
    const emailsponsor = `AdminTestingSponsor-${browserName}@test.example`;
    const updatedEmailSponsor = `AdmintestedSponsro-${browserName}@test.example`
    await page.goto('http://localhost:5173/admin-dashboard');
    const row = page.locator('tr').filter({hasText: updatedEmaildriver});
    await expect(row.locator('td strong')).toHaveText('Unassigned')
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await page.locator('#edit-sponsor').selectOption('clemson')
    await page.getByLabel('button', {name: 'Save Account Changes'}).click();
    await expect(row.locator('td strong')).toHaveText('clemson')
    });

    test('Edit sponsor name', async ({ page, browserName }) => {
    const emaildriver = `AdmintestingDriver-${browserName}@test.example`;
    const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
    const emailsponsor = `AdminTestingSponsor-${browserName}@test.example`;
    const updatedEmailSponsor = `AdmintestedSponsro-${browserName}@test.example`
    await page.goto('http://localhost:5173/admin-dashboard');
    const row = page.locator('tr').filter({hasText: emailsponsor});
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await page.locator('#edit-name').fill('JaneTest');
    await page.getByLabel('button', {name: 'Save Account Changes'}).click();
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await expect(page.locator('#edit-name')).toHaveValue('JaneTest');
    });

    test('Edit Sponsor email', async ({ page, browserName }) => {
    const emaildriver = `AdmintestingDriver-${browserName}@test.example`;
    const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
    const emailsponsor = `AdminTestingSponsor-${browserName}@test.example`;
    const updatedEmailSponsor = `AdmintestedSponsro-${browserName}@test.example`
    await page.goto('http://localhost:5173/admin-dashboard');
    const row = page.locator('tr').filter({hasText: emailsponsor});
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await page.locator('#edit-Email').fill(updatedEmailSponsor);
    await page.getByLabel('button', {name: 'Save Account Changes'}).click();
    row = page.locator('tr').filter({hasText: updatedEmailSponsor});
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await expect(page.locator('#edit-Email')).toHaveValue(updatedEmailSponsor);
    });

    test('Edit Sponsor Role', async ({ page, browserName }) => {
    const emaildriver = `AdmintestingDriver-${browserName}@test.example`;
    const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
    const emailsponsor = `AdminTestingSponsor-${browserName}@test.example`;
    const updatedEmailSponsor = `AdmintestedSponsro-${browserName}@test.example`
    await page.goto('http://localhost:5173/admin-dashboard');
    const row = page.locator('tr').filter({hasText: updatedEmailSponsor});
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await page.locator('#edit-role').selectOption('Driver');
    await page.getByLabel('button', {name: 'Save Account Changes'}).click();
    await expect(row.locator('.admin-badge')).toHaveText('Driver')
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await expect(page.locator('#edit-role')).toHaveValue('Driver');
    await page.locator('#edit-role').selectOption('Sponsor');
    await page.getByLabel('button', {name: 'Save Account Changes'}).click();
    await expect(row.locator('.admin-badge')).toHaveText('Sponsor')
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await expect(page.locator('#edit-role')).toHaveValue('Sponsor');
    });

    test('Change Sponsor Org', async ({ page, browserName }) => {
    const emaildriver = `AdmintestingDriver-${browserName}@test.example`;
    const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
    const emailsponsor = `AdminTestingSponsor-${browserName}@test.example`;
    const updatedEmailSponsor = `AdmintestedSponsro-${browserName}@test.example`
    await page.goto('http://localhost:5173/admin-dashboard');
    const row = page.locator('tr').filter({hasText: updatedEmailSponsor});
    await expect(row.locator('td strong')).toHaveText('clemson')
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await page.locator('#edit-sponsor').selectOption('Unassigned')
    await page.getByLabel('button', {name: 'Save Account Changes'}).click();
    await expect(row.locator('td strong')).toHaveText('Unassigned')
    await row.getByRole('button',{name: 'Edit/Role'}).click();
    await page.locator('#edit-sponsor').selectOption('clemson')
    await page.getByLabel('button', {name: 'Save Account Changes'}).click();
    });

    test('Filter users', async ({ page, browserName }) => {
        await page.goto('http://localhost:5173/admin-dashboard');
        const rowdriver = page.locator('tr').filter({hasText: updatedEmaildriver});
        const rowsponsor = page.locator('tr').filter({hasText: updatedEmailSponsor});
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
        const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
        await page.goto('http://localhost:5173/admin-dashboard');
        await page.getByRole('button', {name: 'Driver & Sponsor Operations'}).click()
        const rowdriver = page.locator('tr').filter({hasText: updatedEmaildriver});
        const driverID = page.locator('#op-driver').locator('option').filter({hasText: updatedEmaildriver}).getAttribute('value')
        await page.locator('#op-driver').selectOption(driverID)
        await page.locator('#op-points').fill('50');
        await page.locator('#op-reason').fill('On-Time delivery');
        await page.getByRole('button',{name: 'Apply Point Change'});
        await expect(rowdriver).toContainText('50 pts')
    });
    test('Deduct points', async ({ page, browserName }) => {
        const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
        await page.goto('http://localhost:5173/admin-dashboard');
        await page.getByRole('button', {name: 'Driver & Sponsor Operations'}).click()
        const rowdriver = page.locator('tr').filter({hasText: updatedEmaildriver});
        const driverID = page.locator('#op-driver').locator('option').filter({hasText: updatedEmaildriver}).getAttribute('value')
        await page.locator('#op-driver').selectOption(driverID)
        await page.locator('#op-points').fill('-25');
        await page.locator('#op-reason').fill('Bad Driving');
        await page.getByRole('button',{name: 'Apply Point Change'});
        await expect(rowdriver).toContainText('25 pts')
    });
    test('Assign to sponsor', async ({ page, browserName }) => {
        const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
        await page.goto('http://localhost:5173/admin-dashboard');
        await page.getByRole('button', {name: 'Driver & Sponsor Operations'}).click()
        const rowdriver = page.locator('tr').filter({hasText: updatedEmaildriver});
        const driverID = page.locator('#aff-driver').locator('option').filter({hasText: updatedEmaildriver}).getAttribute('value')
        const SponsorID = page.locator('#aff-sponsor').locator('option').filter({hasText: 'clemson'}).getAttribute('value')
        await page.locator('#aff-driver').selectOption(driverID)
        await page.locator('#aff-sponsor').selectOption(SponsorID);
        await page.locator('#aff-reason').fill('Application Approved');
        await page.getByRole('button',{name: 'Assign Driver to Sponsor'}).click();
        await expect(rowdriver).toContainText('Clemson')
    });
    test('Drop from sponsor', async ({ page, browserName }) => {
        const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
        page.on('dialog', async dialog => {
            await dialog.accept('Violation of sponsorship agreement');
        })
        await page.goto('http://localhost:5173/admin-dashboard');
        await page.getByRole('button', {name: 'Driver & Sponsor Operations'}).click()
        const rowdriver = page.locator('tr').filter({hasText: updatedEmaildriver});
        await row.getByRole('button', {name: 'Drop from Sponsor'});
        await expect(rowdriver).toContainText('Not currently sponsored')
    });
    test('Try to Assign without selecting a sponsor', async ({ page, browserName }) => {
        const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
        await page.goto('http://localhost:5173/admin-dashboard');
        await page.getByRole('button', {name: 'Driver & Sponsor Operations'}).click()
        const rowdriver = page.locator('tr').filter({hasText: updatedEmaildriver});
        const driverID = page.locator('#aff-driver').locator('option').filter({hasText: updatedEmaildriver}).getAttribute('value')
        const SponsorID = page.locator('#aff-sponsor').locator('option').filter({hasText: 'clemson'}).getAttribute('value')
        await page.locator('#aff-driver').selectOption(driverID)
        await page.getByRole('button',{name: 'Assign Driver to Sponsor'}).click();
        await expect(page.locator('#aff-sponsor')).toBeInvalid()
    });
    test('Try to Assign to sponsor with no reason', async ({ page, browserName }) => {
        const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
        await page.goto('http://localhost:5173/admin-dashboard');
        await page.getByRole('button', {name: 'Driver & Sponsor Operations'}).click()
        const rowdriver = page.locator('tr').filter({hasText: updatedEmaildriver});
        const driverID = page.locator('#aff-driver').locator('option').filter({hasText: updatedEmaildriver}).getAttribute('value')
        const SponsorID = page.locator('#aff-sponsor').locator('option').filter({hasText: 'clemson'}).getAttribute('value')
        await page.locator('#aff-driver').selectOption(driverID)
        await page.locator('#aff-sponsor').selectOption(SponsorID);
        await page.getByRole('button',{name: 'Assign Driver to Sponsor'}).click();
        await expect(page.getByLabel('#aff-reason')).toBeFocused()
    });
    test('Make a new sponsor', async ({ page, browserName }) => {
        await page.goto('http://localhost:5173/admin-dashboard');
        const newSponsor = `New Clemson Sponsor-${browserName}`
        await page.getByRole('button', {name: 'Driver & Sponsor Operations'}).click()
        await page.locator('#sp-name').fill(newSponsor);
        await page.locator('#sp-value').fill('0.02')
        await page.getByRole('button', {name: 'Add Sponsor Organization'}).click();
        const SponsorRow = page.locator('tr').filter({hasText: newsponsor});
        await expect(SponsorRow).toHaveText('New Clemson Sponsor');
        await expect(SponsorRow).toHaveText('$0.02');
    });
    test('Assign User to newly created Sponsor', async ({ page, browserName }) => {
        const updatedEmaildriver = `AdmintestedDriver-${browserName}@test.example`;
        const newsponsor = `New Clemson Sponsor-${browserName}`
        await page.goto('http://localhost:5173/admin-dashboard');
        await page.getByRole('button', {name: 'Driver & Sponsor Operations'}).click()
        const rowdriver = page.locator('tr').filter({hasText: updatedEmaildriver});
        const SponsorRow = page.locator('tr').filter({hasText: newSponsor});
        const driverID = page.locator('#aff-driver').locator('option').filter({hasText: updatedEmaildriver}).getAttribute('value')
        const SponsorID = page.locator('#aff-sponsor').locator('option').filter({hasText: newSponsor}).getAttribute('value')
        await page.locator('#aff-driver').selectOption(driverID)
        await page.locator('#aff-sponsor').selectOption(SponsorID);
        await page.locator('#aff-reason').fill('Application Approved');
        await page.getByRole('button', {name: 'Assign Driver to Sponsor'});
        await expect(rowdriver).toContainText('New Clemson Sponsor')
        await expect(sponsorRow).toContainText('1')
    });
    test('View as standard Driver', async ({ page, browserName }) => {
        await page.goto('http://localhost:5173/admin-dashboard');
        await page.getByRole('button', {name: 'View as Standard Driver'}).click();
        await expect(page).toHaveURL('http://localhost:5173/driver-dashboard');
        await expect(page).toHaveText('Admin View-As Mode');
        await page.getByRole('button', {name: 'Return to Admin Panel'});
        await expect(page).toHaveURL('http://localhost:5173/admin-dashboard')
    });
    test('View as standard Sponsor', async ({ page, browserName }) => {
        await page.goto('http://localhost:5173/admin-dashboard');
        await page.getByRole('button', {name: 'View as Standard Sponsor'}).click();
        await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard');
        await expect(page).toHaveText('Admin View-As Mode');
        await page.getByRole('button', {name: 'Return to Admin Panel'});
        await expect(page).toHaveURL('http://localhost:5173/admin-dashboard')
    });
});