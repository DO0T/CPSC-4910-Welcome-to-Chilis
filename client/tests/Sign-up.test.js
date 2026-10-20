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
    await page.getByRole('button', {name: 'Dashboard'}).click();
    await expect(page.getByText('Welcome back, Jane')).toBeVisible();
    });
    test('Driver edit email', async ({ page, browserName }) => {
    const email = `john-${browserName}@test.example`;
    const updatedEmail = `john1-${browserName}@test.example`;
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://localhost:5173/driver-dashboard')
    await page.getByRole('button', {name: 'Edit profile'}).click();
    await page.getByLabel('Email').pressSequentially(updatedEmail);
    await page.getByRole('button',{name: 'save changes'}).click();
    await page.getByRole('button', {name: 'Dashboard'}).click();
    await page.getByRole('button', {name: 'Log out'}).click();
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(updatedEmail);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://localhost:5173/driver-dashboard')
    });
    test('Sponsor edit password', async ({ page, browserName }) => {
    const email = `john-${browserName}@test.example`;
    const updatedEmail = `john1-${browserName}@test.example`;
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(updatedEmail);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://localhost:5173/driver-dashboard')
    await page.getByRole('button', {name: 'Edit profile'}).click();
    await page.getByLabel('Current password').pressSequentially('password');
    await page.getByLabel('New password').pressSequentially('password1');
    await page.getByLabel('Confirm new password').pressSequentially('password1');
    await page.getByRole('button',{name: 'save changes'}).click();
    await page.getByRole('button', {name: 'Dashboard'}).click();
    await page.getByRole('button', {name: 'Log out'}).click();
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(updatedEmail);
    await page.getByLabel('Password').pressSequentially('password1');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://localhost:5173/driver-dashboard')
    });

});

test.describe.serial('Sponsor tests', () => {
    test('Sponsor Sign-up and Sign-in', async ({ page, browserName }) => {
    const email = `janesponsor-${browserName}@test.example`;
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByRole('radio', {name: 'Sponsor'}).check();
    await page.getByLabel('Name', {exact : true}).pressSequentially('Jane');
    await page.getByLabel('Company name', {exact : true}).pressSequentially('clemson');
    await page.getByLabel('Email').pressSequentially(email);
    await page.getByLabel('Password', {exact : true}).pressSequentially('password');
    await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
    await page.getByRole('button',{name: 'Create sponsor account'}).click();
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard')
    });
   
    test('Fail Sign-up by Email', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByRole('radio', {name: 'Sponsor'}).check();
    await page.getByLabel('Name', {exact : true}).pressSequentially('Jane');
    await page.getByLabel('Company name', {exact : true}).pressSequentially('clemson');
    await page.getByLabel('Email').pressSequentially('Jane');
    await page.getByLabel('Password', {exact : true}).pressSequentially('password');
    await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
    await page.getByRole('button',{name: 'Create Sponsor account'}).click();
    await expect(page.getByLabel('Email')).toBeFocused();
    });

    test('Fail Sign-up by Org', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.getByRole('radio', {name: 'Sponsor'}).check();
    await page.getByLabel('Name', {exact : true}).pressSequentially('Jane');
    await page.getByLabel('Email').pressSequentially('Jane@email.com');
    await page.getByLabel('Password', {exact : true}).pressSequentially('password');
    await page.getByLabel('Confirm password', {exact : true}).pressSequentially('password');
    await page.getByRole('button',{name: 'Create Sponsor account'}).click();
    await expect(page.getByLabel('Company name')).toBeFocused();
    });

    test('Sponsor edit name', async ({ page, browserName }) => {
    const email = `janesponsor-${browserName}@test.example`;
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard')
    await page.getByRole('button', {name: 'Edit profile'}).click();
    await page.getByLabel('Name').pressSequentially('Joan');
    await page.getByRole('button',{name: 'save changes'}).click();
    await page.getByRole('button', {name: 'Dashboard'}).click();
    await page.getByRole('button', {name: 'Edit profile'}).click();
    await expect(page.getByLabel('Name')).toHaveValue('Joan');
    });

    test('Sponsor edit email', async ({ page, browserName }) => {
    const email = `janesponsor-${browserName}@test.example`;
    const updatedEmail = `janesponsor1-${browserName}@test.example`;
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard')
    await page.getByRole('button', {name: 'Edit profile'}).click();
    await page.getByLabel('Email').pressSequentially(updatedEmail);
    await page.getByRole('button',{name: 'save changes'}).click();
    await page.getByRole('button', {name: 'Dashboard'}).click();
    await page.getByRole('button', {name: 'Log out'}).click();
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(updatedEmail);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard')
    });
     test('Sponsor edit password', async ({ page, browserName }) => {
    const email = `janesponsor-${browserName}@test.example`;
    const updatedEmail = `janesponsor1-${browserName}@test.example`;
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(updatedEmail);
    await page.getByLabel('Password').pressSequentially('password');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard')
    await page.getByRole('button', {name: 'Edit profile'}).click();
    await page.getByLabel('Current password').pressSequentially('password');
    await page.getByLabel('New password').pressSequentially('password1');
    await page.getByLabel('Confirm new password').pressSequentially('password1');
    await page.getByRole('button',{name: 'save changes'}).click();
    await page.getByRole('button', {name: 'Dashboard'}).click();
    await page.getByRole('button', {name: 'Log out'}).click();
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByLabel('Email').fill(updatedEmail);
    await page.getByLabel('Password').pressSequentially('password1');
    await page.getByRole('button', {name: 'Log in'}).click();
    await expect(page).toHaveURL('http://localhost:5173/sponsor-dashboard')
    });
});
