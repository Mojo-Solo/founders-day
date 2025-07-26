import { Page, Locator } from '@playwright/test';

export interface RegistrationFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  lodgeName: string;
  lodgeNumber: string;
  memberId: string;
  password: string;
  confirmPassword: string;
}

export class RegistrationPage {
  readonly page: Page;
  
  // Define locators
  readonly pageTitle: Locator;
  readonly firstNameField: Locator;
  readonly lastNameField: Locator;
  readonly emailField: Locator;
  readonly phoneField: Locator;
  readonly lodgeNameField: Locator;
  readonly lodgeNumberField: Locator;
  readonly memberIdField: Locator;
  readonly passwordField: Locator;
  readonly confirmPasswordField: Locator;
  readonly termsCheckbox: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly passwordRequirements: Locator;
  readonly passwordStrength: Locator;
  
  constructor(page: Page) {
    this.page = page;
    
    // Initialize locators
    this.pageTitle = page.locator('h1:has-text("Register")');
    this.firstNameField = page.locator('input[name="firstName"]');
    this.lastNameField = page.locator('input[name="lastName"]');
    this.emailField = page.locator('input[name="email"]');
    this.phoneField = page.locator('input[name="phone"]');
    this.lodgeNameField = page.locator('input[name="lodgeName"]');
    this.lodgeNumberField = page.locator('input[name="lodgeNumber"]');
    this.memberIdField = page.locator('input[name="memberId"]');
    this.passwordField = page.locator('input[name="password"]');
    this.confirmPasswordField = page.locator('input[name="confirmPassword"]');
    this.termsCheckbox = page.locator('input[name="acceptTerms"]');
    this.submitButton = page.locator('button[type="submit"]:has-text("Register")');
    this.errorMessage = page.locator('.alert-error');
    this.successMessage = page.locator('.alert-success');
    this.passwordRequirements = page.locator('.password-requirements');
    this.passwordStrength = page.locator('.password-strength');
  }
  
  // Navigation methods
  async goto() {
    await this.page.goto('/register');
    await this.page.waitForLoadState('networkidle');
  }
  
  async gotoFromHome() {
    await this.page.goto('/');
    await this.page.click('text=Register');
    await this.page.waitForURL('/register');
  }
  
  // Form filling methods
  async fillField(fieldName: string, value: string) {
    const fieldMap: Record<string, Locator> = {
      firstName: this.firstNameField,
      lastName: this.lastNameField,
      email: this.emailField,
      phone: this.phoneField,
      lodgeName: this.lodgeNameField,
      lodgeNumber: this.lodgeNumberField,
      memberId: this.memberIdField,
      password: this.passwordField,
      confirmPassword: this.confirmPasswordField,
    };
    
    const field = fieldMap[fieldName];
    if (field) {
      await field.fill(value);
    }
  }
  
  async fillRegistrationForm(data: RegistrationFormData) {
    await this.firstNameField.fill(data.firstName);
    await this.lastNameField.fill(data.lastName);
    await this.emailField.fill(data.email);
    await this.phoneField.fill(data.phone);
    await this.lodgeNameField.fill(data.lodgeName);
    await this.lodgeNumberField.fill(data.lodgeNumber);
    await this.memberIdField.fill(data.memberId);
    await this.passwordField.fill(data.password);
    await this.confirmPasswordField.fill(data.confirmPassword);
  }
  
  async acceptTerms() {
    await this.termsCheckbox.check();
  }
  
  async submitForm() {
    await this.submitButton.click();
  }
  
  async registerUser(data: RegistrationFormData, acceptTerms = true) {
    await this.fillRegistrationForm(data);
    if (acceptTerms) {
      await this.acceptTerms();
    }
    await this.submitForm();
  }
  
  // Validation helper methods
  async getFieldError(fieldName: string): Promise<string | null> {
    const errorLocator = this.page.locator(`.field-error[data-field="${fieldName}"]`);
    const isVisible = await errorLocator.isVisible();
    if (isVisible) {
      return await errorLocator.textContent();
    }
    return null;
  }
  
  async isFieldHighlighted(fieldName: string): Promise<boolean> {
    const field = this.page.locator(`input[name="${fieldName}"]`);
    const classes = await field.getAttribute('class');
    return classes?.includes('error') || classes?.includes('invalid') || false;
  }
  
  async getPasswordStrength(): Promise<string> {
    return await this.passwordStrength.textContent() || '';
  }
  
  async getPasswordRequirements(): Promise<{
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  }> {
    const requirements = {
      length: await this.isRequirementMet('length'),
      uppercase: await this.isRequirementMet('uppercase'),
      lowercase: await this.isRequirementMet('lowercase'),
      number: await this.isRequirementMet('number'),
      special: await this.isRequirementMet('special'),
    };
    return requirements;
  }
  
  private async isRequirementMet(requirement: string): Promise<boolean> {
    const element = this.page.locator(`.requirement-${requirement}`);
    const classes = await element.getAttribute('class');
    return classes?.includes('valid') || false;
  }
  
  // Assertion helper methods
  async expectSuccessMessage(message: string) {
    await expect(this.successMessage).toBeVisible();
    await expect(this.successMessage).toContainText(message);
  }
  
  async expectErrorMessage(message: string) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }
  
  async expectFieldError(fieldName: string, errorMessage: string) {
    const error = await this.getFieldError(fieldName);
    expect(error).toBe(errorMessage);
  }
  
  // Mobile-specific methods
  async checkMobileLayout(): Promise<{
    isSingleColumn: boolean;
    fieldsAreTappable: boolean;
    firstFieldFocused: boolean;
  }> {
    const formFields = await this.page.locator('.form-field').all();
    const fieldPositions = await Promise.all(
      formFields.map(field => field.boundingBox())
    );
    
    // Check single column
    const xPositions = fieldPositions.map(pos => pos?.x || 0);
    const uniqueXPositions = [...new Set(xPositions)];
    const isSingleColumn = uniqueXPositions.length === 1;
    
    // Check tappable size (minimum 44px)
    const fieldsAreTappable = fieldPositions.every(pos => 
      (pos?.height || 0) >= 44
    );
    
    // Check first field focus
    const firstFieldFocused = await this.firstNameField.evaluate(el => 
      el === document.activeElement
    );
    
    return {
      isSingleColumn,
      fieldsAreTappable,
      firstFieldFocused
    };
  }
  
  // Wait helpers
  async waitForValidation() {
    await this.page.waitForTimeout(500); // Allow time for validation
  }
  
  async waitForRegistrationComplete() {
    await this.page.waitForResponse(response => 
      response.url().includes('/api/register') && 
      response.status() === 200
    );
  }
}