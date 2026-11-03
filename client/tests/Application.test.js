import { test, expect } from '@playwright/test';
import { name } from 'nodemailer/lib/package-info.js';
test.describe.serial('Application testing', () => {
    test('Driver apply for org', async ({ page, browserName }) => {
        const emaildriver = `applicationdriver-${browserName}@test.example`;
        const emailsponsor = `applicationtestingsponsor-${browserName}@test.example`;
        const organization = `Apptestorg-${browserName}`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.getByLabel('Name').pressSequentially(`John-${browserName}`);
        await page.getByLabel('Email').pressSequentially(emaildriver);
        await page.getByLabel('Password', {exact : true}).pressSequentially('password');
        await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
        await page.getByRole('button',{name: 'Create driver account'}).click();
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.getByRole('radio', {name: 'Sponsor'}).check();
        await page.getByLabel('Full name').pressSequentially('Jane');
        await page.getByLabel('Company name', {exact : true}).pressSequentially(organization);
        await page.getByLabel('Email').pressSequentially(emailsponsor);
        await page.getByLabel('Password', {exact : true}).pressSequentially('password');
        await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
        await page.getByRole('button',{name: 'Create sponsor account'}).click();
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially(emaildriver);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        let appSection = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Apply to a sponsor'})});
        await expect(appSection).toBeVisible();
        let sponsor = await appSection.locator('.dashboard-sponsor-item').filter({has: page.getByRole('heading', {name: organization})});
        await sponsor.getByRole('button', {name: 'Apply to sponsor'}).click();
        let yourApp = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Your applications'})});
        let app = await yourApp.locator('.driver-application-status-item').filter({has: page.getByRole('heading', { name: organization, exact: true })})
        await expect(app.getByText('Pending review', {exact: true})).toBeVisible();
    })
    test('Sponsor view current applications', async ({ page, browserName }) => {
        const emaildriver = `applicationdriver-${browserName}@test.example`;
        const emailsponsor = `applicationtestingsponsor-${browserName}@test.example`;
        const organization = `Apptestorg-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially(emailsponsor);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        let driverApps = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Pending applications'})});
        await expect(driverApps.locator('.sponsor-driver-name', {hasText: `John-${browserName}`})).toBeVisible();
    })
    test('Sponsor approve application', async ({ page, browserName }) => {
        const emaildriver = `applicationdriver-${browserName}@test.example`;
        const emailsponsor = `applicationtestingsponsor-${browserName}@test.example`;
        const organization = `Apptestorg-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially(emailsponsor);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        let driverApps = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Pending applications'})});
        await driverApps.getByRole('button', {name: `Approve John-${browserName}`}).click();
        await expect(driverApps.getByText(`Approve John-${browserName}'s application?`)).toBeVisible();
        await driverApps.getByRole('button', {name: 'Approve driver'}).click();
    })
    test('Driver check app approval', async ({ page, browserName }) => {
        const emaildriver = `applicationdriver-${browserName}@test.example`;
        const emailsponsor = `applicationtestingsponsor-${browserName}@test.example`;
        const organization = `Apptestorg-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially(emaildriver);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        let yourApp = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Your applications'})});
        let app = await yourApp.locator('.driver-application-status-item').filter({has: page.getByRole('heading', { name: organization, exact: true })})
        await expect(app.getByText('Approved', {exact: true})).toBeVisible();
    })
    test('Driver apply for second sponsor', async ({ page, browserName }) => {
        const emaildriver = `applicationdriver-${browserName}@test.example`;
        const emailsponsor = `applicationtestingsponsor-${browserName}@test.example`;
        const organization = `Apptestorg-${browserName}`;
        const emaildenysponsor = `applicationdenialponsor-${browserName}@test.example`;
        const denyorg = `denialOrg-${browserName}`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.getByRole('radio', {name: 'Sponsor'}).check();
        await page.getByLabel('Full name').pressSequentially('Jane');
        await page.getByLabel('Company name', {exact : true}).pressSequentially(denyorg);
        await page.getByLabel('Email').pressSequentially(emaildenysponsor);
        await page.getByLabel('Password', {exact : true}).pressSequentially('password');
        await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
        await page.getByRole('button', {name: 'Create sponsor account'}).click();
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially(emaildriver);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        let appSection = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Apply to a sponsor'})});
        if(browserName == 'webkit'){
            await appSection.getByRole('button', {name: 'Show more'}).click()
        }
        let sponsor = await appSection.locator('.dashboard-sponsor-item').filter({has: page.getByRole('heading', {name: denyorg})});
        await sponsor.getByRole('button', {name: 'Apply to sponsor'}).click();
        let yourApp = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Your applications'})});
        let approvedapp = await yourApp.locator('.driver-application-status-item').filter({has: page.getByRole('heading', { name: organization, exact: true })});
        await expect(approvedapp.getByText('Approved', {exact: true})).toBeVisible();
        let app = await yourApp.locator('.driver-application-status-item').filter({has: page.getByRole('heading', { name: denyorg, exact: true })})
        await expect(app.getByText('Pending review', {exact: true})).toBeVisible();
    })
    test('Sponsor Deny driver', async ({ page, browserName }) => {
        const emaildriver = `applicationdriver-${browserName}@test.example`;
        const emailsponsor = `applicationtestingsponsor-${browserName}@test.example`;
        const organization = `Apptestorg-${browserName}`;
        const emaildenysponsor = `applicationdenialponsor-${browserName}@test.example`;
        const denyorg = `denialOrg-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially(emaildenysponsor);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        let driverApps = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Pending applications'})});
        await driverApps.getByRole('button', {name: `Deny John-${browserName}`}).click();
        await expect(driverApps.getByText('They can reapply in 30 days.')).toBeVisible();
        await driverApps.getByRole('button', {name: 'Deny application'}).click();
    })
    test('Driver check app denial', async ({ page, browserName }) => {
        const emaildriver = `applicationdriver-${browserName}@test.example`;
        const emailsponsor = `applicationtestingsponsor-${browserName}@test.example`;
        const organization = `Apptestorg-${browserName}`;
        const denyorg = `denialOrg-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially(emaildriver);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        let yourApp = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Your applications'})});
        let app = await yourApp.locator('.driver-application-status-item').filter({has: page.getByRole('heading', { name: denyorg, exact: true })})
        await expect(app.getByText('Denied', {exact: true})).toBeVisible();
        await expect(app.getByText('You can reapply on ')).toBeVisible();
    })
    test('Approve multiple drivers at once', async ({ page, browserName }) => {
        const organization = `Apptestorg-${browserName}`;
        const emailsponsor = `applicationtestingsponsor-${browserName}@test.example`;
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.getByLabel('Name').pressSequentially(`Wise-${browserName}`);
        await page.getByLabel('Email').pressSequentially('Wise@email.com');
        await page.getByLabel('Password', {exact : true}).pressSequentially('password');
        await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
        await page.getByRole('button',{name: 'Create driver account'}).click();
        await page.goto('http://localhost:5173/');
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.getByLabel('Full name').pressSequentially(`Belle-${browserName}`);
        await page.getByLabel('Email').pressSequentially('Belle@email.com');
        await page.getByLabel('Password', {exact : true}).pressSequentially('password');
        await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
        await page.getByRole('button',{name: 'Create driver account'}).click();
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially('Wise@email.com');
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        let appSection = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Apply to a sponsor'})});
        await expect(appSection).toBeVisible();
        let sponsor = await appSection.locator('.dashboard-sponsor-item').filter({has: page.getByRole('heading', {name: organization})});
        await sponsor.getByRole('button', {name: 'Apply to sponsor'}).click();
        let yourApp = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Your applications'})});
        let app = await yourApp.locator('.driver-application-status-item').filter({has: page.getByRole('heading', { name: organization, exact: true })})
        await expect(app.getByText('Pending review', {exact: true})).toBeVisible();
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially('Belle@email.com');
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        await sponsor.getByRole('button', {name: 'Apply to sponsor'}).click();
        await expect(app.getByText('Pending review', {exact: true})).toBeVisible();
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially(emailsponsor);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        let driverApps = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Pending applications'})});
        await driverApps.getByLabel('Select all').check();
        await driverApps.getByRole('button', {name: 'Approve selected'}).click();
        let bulk = driverApps.getByRole('group',{name: 'Confirm bulk decision'});
        await expect(bulk).toBeVisible();
        await bulk.getByRole('button',{name: 'Confirm bulk approval'}).click();
        await expect(driverApps.getByText('2 applications Approved')).toBeVisible();
    })
        test('Deny multiple drivers at once', async ({ page, browserName }) => {
        const organization = `Apptestorg-${browserName}`;
        const emaildenysponsor = `applicationdenialponsor-${browserName}@test.example`;
        const denyorg = `denialOrg-${browserName}`;
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially('Wise@email.com');
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        let appSection = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Apply to a sponsor'})});
        if(browserName == 'webkit'){
            await appSection.getByRole('button', {name: 'Show more'}).click()
        }
        await expect(appSection).toBeVisible();
        let sponsor = await appSection.locator('.dashboard-sponsor-item').filter({has: page.getByRole('heading', {name: denyorg})});
        await sponsor.getByRole('button', {name: 'Apply to sponsor'}).click();
        let yourApp = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Your applications'})});
        let app = await yourApp.locator('.driver-application-status-item').filter({has: page.getByRole('heading', { name: denyorg, exact: true })})
        await expect(app.getByText('Pending review', {exact: true})).toBeVisible();
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially('Belle@email.com');
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        if(browserName == 'webkit'){
            await appSection.getByRole('button', {name: 'Show more'}).click()
        }
        await sponsor.getByRole('button', {name: 'Apply to sponsor'}).click();
        await expect(app.getByText('Pending review', {exact: true})).toBeVisible();
        await page.goto('http://localhost:5173/login');
        await page.getByLabel('Email').pressSequentially(emaildenysponsor);
        await page.getByLabel('Password').pressSequentially('password');
        await page.getByRole('button', {name: 'log in'}).click();
        let driverApps = await page.locator('.dashboard-card').filter({has: page.getByRole('heading', {name: 'Pending applications'})});
        await driverApps.getByLabel('Select all').check();
        await driverApps.getByRole('button', {name: 'Deny selected'}).click();
        let bulk = driverApps.getByRole('group',{name: 'Confirm bulk decision'});
        await expect(bulk).toBeVisible();
        await bulk.getByRole('button',{name: 'Confirm bulk denial'}).click();
        await expect(driverApps.getByText('2 applications denied')).toBeVisible();
    })
})