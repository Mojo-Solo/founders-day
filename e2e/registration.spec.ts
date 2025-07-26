import { test, expect } from '@playwright/test';
import { RegistrationPage } from '../pages/registration.page';
import { DatabaseHelper } from '../helpers/database.helper';
import { EmailHelper } from '../helpers/email.helper';

test.describe('User Registration - BDD Scenarios', () => {
  let registrationPage: RegistrationPage;
  let dbHelper: DatabaseHelper;
  let emailHelper: EmailHelper;

  test.beforeEach(async ({ page }) => {
    registrationPage = new RegistrationPage(page);
    dbHelper = new DatabaseHelper();
    emailHelper = new EmailHelper();
    
    // Clean up test data
    await dbHelper.cleanTestData();
    await emailHelper.clearTestEmails();
    
    await page.goto('/');
  });

  test('Successful registration with valid information', async ({ page }) => {
    // Given I am on the registration page
    await page.click('text=Register');
    await expect(page).toHaveURL('/register');
    
    // When I fill in the registration form
    await registrationPage.fillRegistrationForm({
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      phone: '612-555-0123',
      lodgeName: 'Minneapolis Lodge #19',
      lodgeNumber: '19',
      memberId: 'MN12345',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!'
    });
    
    // And I accept terms and submit
    await page.check('input[name="acceptTerms"]');
    await page.click('button:has-text("Register")');
    
    // Then I should see success message
    await expect(page.locator('.alert-success')).toContainText(
      'Registration successful! Please check your email to verify your account.'
    );
    
    // And email should be sent
    await page.waitForTimeout(2000); // Wait for async email
    const emails = await emailHelper.getEmailsFor('john.smith@example.com');
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe('Verify your Founders Day Minnesota account');
    
    // And user should be created in database
    const user = await dbHelper.findUserByEmail('john.smith@example.com');
    expect(user).toBeDefined();
    expect(user.status).toBe('pending_verification');
    expect(user.lodgeNumber).toBe(19);
  });

  test('Registration fails with duplicate email', async ({ page }) => {
    // Given a user already exists
    await dbHelper.createUser({
      email: 'john.smith@example.com',
      firstName: 'Existing',
      lastName: 'User',
      status: 'active'
    });
    
    // When I try to register with same email
    await page.click('text=Register');
    await registrationPage.fillRegistrationForm({
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      phone: '612-555-0123',
      lodgeName: 'Minneapolis Lodge #19',
      lodgeNumber: '19',
      memberId: 'MN12345',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!'
    });
    await page.click('button:has-text("Register")');
    
    // Then I should see error message
    await expect(page.locator('.alert-error')).toContainText(
      'An account with this email already exists'
    );
    
    // And email field should be highlighted
    const emailField = page.locator('input[name="email"]');
    await expect(emailField).toHaveClass(/error/);
    
    // And no new user should be created
    const users = await dbHelper.findAllUsersByEmail('john.smith@example.com');
    expect(users).toHaveLength(1); // Only the original user
  });

  test('Password validation provides real-time feedback', async ({ page }) => {
    await page.goto('/register');
    
    // When I enter a weak password
    const passwordField = page.locator('input[name="password"]');
    await passwordField.fill('weak');
    
    // Then I should see validation feedback
    await expect(page.locator('.password-requirements')).toBeVisible();
    await expect(page.locator('.requirement-length')).toHaveClass(/invalid/);
    await expect(page.locator('.requirement-uppercase')).toHaveClass(/invalid/);
    await expect(page.locator('.requirement-number')).toHaveClass(/invalid/);
    await expect(page.locator('.requirement-special')).toHaveClass(/invalid/);
    
    // And strength indicator should show weak
    await expect(page.locator('.password-strength')).toHaveText('Weak');
    await expect(page.locator('.strength-bar')).toHaveClass(/weak/);
    
    // When I enter a strong password
    await passwordField.fill('SecurePass123!');
    
    // Then all requirements should be met
    await expect(page.locator('.requirement-length')).toHaveClass(/valid/);
    await expect(page.locator('.requirement-uppercase')).toHaveClass(/valid/);
    await expect(page.locator('.requirement-number')).toHaveClass(/valid/);
    await expect(page.locator('.requirement-special')).toHaveClass(/valid/);
    
    // And strength indicator should show strong
    await expect(page.locator('.password-strength')).toHaveText('Strong');
    await expect(page.locator('.strength-bar')).toHaveClass(/strong/);
  });

  test('Mobile responsive registration form', async ({ page, browserName }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/register');
    
    // Then form should be in single column
    const formFields = await page.locator('.form-field').all();
    const fieldPositions = await Promise.all(
      formFields.map(field => field.boundingBox())
    );
    
    // All fields should have same x position (single column)
    const xPositions = fieldPositions.map(pos => pos?.x || 0);
    const uniqueXPositions = [...new Set(xPositions)];
    expect(uniqueXPositions).toHaveLength(1);
    
    // Fields should be easily tappable (minimum 44px height)
    for (const position of fieldPositions) {
      expect(position?.height || 0).toBeGreaterThanOrEqual(44);
    }
    
    // First field should be focused (mobile keyboard helper)
    await expect(page.locator('input[name="firstName"]')).toBeFocused();
  });

  test('Lodge membership validation', async ({ page }) => {
    // Mock lodge validation to fail
    await page.route('**/api/validate-membership', async route => {
      await route.fulfill({
        status: 400,
        json: { error: 'Member ID not found in lodge records' }
      });
    });
    
    await page.goto('/register');
    
    // Fill form with invalid member ID
    await registrationPage.fillRegistrationForm({
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      phone: '612-555-0123',
      lodgeName: 'Minneapolis Lodge #19',
      lodgeNumber: '19',
      memberId: 'INVALID123',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!'
    });
    
    await page.check('input[name="acceptTerms"]');
    await page.click('button:has-text("Register")');
    
    // Should see error message
    await expect(page.locator('.alert-error')).toContainText(
      'Member ID not found in lodge records'
    );
    
    // Member ID field should be highlighted
    const memberIdField = page.locator('input[name="memberId"]');
    await expect(memberIdField).toHaveClass(/error/);
  });

  test('Email verification process', async ({ page }) => {
    // First, register a user
    await page.goto('/register');
    await registrationPage.fillRegistrationForm({
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.verify@example.com',
      phone: '612-555-0123',
      lodgeName: 'Minneapolis Lodge #19',
      lodgeNumber: '19',
      memberId: 'MN12345',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!'
    });
    
    await page.check('input[name="acceptTerms"]');
    await page.click('button:has-text("Register")');
    
    // Wait for email
    await page.waitForTimeout(2000);
    const emails = await emailHelper.getEmailsFor('john.verify@example.com');
    expect(emails).toHaveLength(1);
    
    // Extract verification link from email
    const verificationLink = emailHelper.extractVerificationLink(emails[0].body);
    expect(verificationLink).toBeTruthy();
    
    // Click verification link
    await page.goto(verificationLink);
    
    // Should be redirected to login with success message
    await expect(page).toHaveURL('/login');
    await expect(page.locator('.alert-success')).toContainText(
      'Email verified successfully! You can now log in.'
    );
    
    // Check database - user should be active
    const user = await dbHelper.findUserByEmail('john.verify@example.com');
    expect(user.status).toBe('active');
    expect(user.verifiedAt).toBeTruthy();
  });

  test('Field validation messages', async ({ page }) => {
    await page.goto('/register');
    
    // Test email validation
    const emailField = page.locator('input[name="email"]');
    await emailField.fill('invalid-email');
    await emailField.blur();
    await expect(page.locator('.field-error[data-field="email"]')).toContainText(
      'Please enter a valid email address'
    );
    
    // Test phone validation
    const phoneField = page.locator('input[name="phone"]');
    await phoneField.fill('123');
    await phoneField.blur();
    await expect(page.locator('.field-error[data-field="phone"]')).toContainText(
      'Please enter a valid phone number'
    );
    
    // Test lodge number validation
    const lodgeNumberField = page.locator('input[name="lodgeNumber"]');
    await lodgeNumberField.fill('abc');
    await lodgeNumberField.blur();
    await expect(page.locator('.field-error[data-field="lodgeNumber"]')).toContainText(
      'Lodge number must be numeric'
    );
    
    // Test required fields
    await page.click('button:has-text("Register")');
    
    await expect(page.locator('.field-error[data-field="firstName"]')).toContainText(
      'First name is required'
    );
    await expect(page.locator('.field-error[data-field="lastName"]')).toContainText(
      'Last name is required'
    );
  });

  test('Password confirmation validation', async ({ page }) => {
    await page.goto('/register');
    
    const passwordField = page.locator('input[name="password"]');
    const confirmPasswordField = page.locator('input[name="confirmPassword"]');
    
    // Enter different passwords
    await passwordField.fill('SecurePass123!');
    await confirmPasswordField.fill('DifferentPass123!');
    await confirmPasswordField.blur();
    
    // Should show mismatch error
    await expect(page.locator('.field-error[data-field="confirmPassword"]')).toContainText(
      'Passwords do not match'
    );
    
    // Fix the confirmation
    await confirmPasswordField.fill('SecurePass123!');
    await confirmPasswordField.blur();
    
    // Error should disappear
    await expect(page.locator('.field-error[data-field="confirmPassword"]')).not.toBeVisible();
  });

  test('Form persistence on validation errors', async ({ page }) => {
    await page.goto('/register');
    
    // Fill form with all data except terms
    const formData = {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      phone: '612-555-0123',
      lodgeName: 'Minneapolis Lodge #19',
      lodgeNumber: '19',
      memberId: 'MN12345',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!'
    };
    
    await registrationPage.fillRegistrationForm(formData);
    
    // Submit without accepting terms
    await page.click('button:has-text("Register")');
    
    // Should see error about terms
    await expect(page.locator('.alert-error')).toContainText(
      'You must accept the terms and conditions'
    );
    
    // All form data should be preserved
    for (const [field, value] of Object.entries(formData)) {
      const fieldValue = await page.locator(`input[name="${field}"]`).inputValue();
      expect(fieldValue).toBe(value);
    }
  });

  test('Registration rate limiting', async ({ page }) => {
    // Attempt multiple registrations rapidly
    for (let i = 0; i < 5; i++) {
      await page.goto('/register');
      await registrationPage.fillRegistrationForm({
        firstName: 'Test',
        lastName: `User${i}`,
        email: `test${i}@example.com`,
        phone: '612-555-0123',
        lodgeName: 'Test Lodge',
        lodgeNumber: '99',
        memberId: `TEST${i}`,
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      });
      
      await page.check('input[name="acceptTerms"]');
      await page.click('button:has-text("Register")');
      
      if (i < 3) {
        // First 3 should succeed
        await expect(page.locator('.alert-success')).toBeVisible();
      } else {
        // Should be rate limited
        await expect(page.locator('.alert-error')).toContainText(
          'Too many registration attempts. Please try again later.'
        );
      }
    }
  });
});