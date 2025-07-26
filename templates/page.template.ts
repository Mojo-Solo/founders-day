import { Page, Locator, expect } from '@playwright/test';

export class [PageName]Page {
  readonly page: Page;
  
  // Define locators
  readonly pageTitle: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly loadingSpinner: Locator;
  
  // Form fields (if applicable)
  readonly fieldName: Locator;
  
  // Lists and tables (if applicable)
  readonly dataTable: Locator;
  readonly dataRows: Locator;
  
  constructor(page: Page) {
    this.page = page;
    
    // Initialize locators
    this.pageTitle = page.locator('h1');
    this.submitButton = page.locator('button[type="submit"]');
    this.cancelButton = page.locator('button:has-text("Cancel")');
    this.errorMessage = page.locator('[role="alert"].error, .alert-error');
    this.successMessage = page.locator('[role="alert"].success, .alert-success');
    this.loadingSpinner = page.locator('.loading-spinner, [aria-busy="true"]');
    
    // Form fields
    this.fieldName = page.locator('input[name="fieldName"]');
    
    // Data elements
    this.dataTable = page.locator('table[data-testid="data-table"]');
    this.dataRows = this.dataTable.locator('tbody tr');
  }
  
  // Navigation methods
  async goto() {
    await this.page.goto('/[page-route]');
    await this.waitForPageLoad();
  }
  
  async gotoWithParams(params: Record<string, string>) {
    const url = new URL('/[page-route]', this.page.url());
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    await this.page.goto(url.toString());
    await this.waitForPageLoad();
  }
  
  // Wait methods
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 30000 });
  }
  
  async waitForDataLoad() {
    await this.dataTable.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }
  
  // Form interaction methods
  async fillForm(data: [FormDataType]) {
    await this.fieldName.fill(data.fieldName);
    // ... fill other fields
  }
  
  async clearForm() {
    await this.fieldName.clear();
    // ... clear other fields
  }
  
  async submitForm() {
    await this.submitButton.click();
    await this.waitForResponse();
  }
  
  async cancelForm() {
    await this.cancelButton.click();
  }
  
  // Data interaction methods
  async getRowCount(): Promise<number> {
    return await this.dataRows.count();
  }
  
  async getRowData(index: number): Promise<Record<string, string>> {
    const row = this.dataRows.nth(index);
    const cells = await row.locator('td').all();
    const data: Record<string, string> = {};
    
    for (let i = 0; i < cells.length; i++) {
      const header = await this.dataTable.locator(`th`).nth(i).textContent();
      const value = await cells[i].textContent();
      if (header && value) {
        data[header] = value;
      }
    }
    
    return data;
  }
  
  async findRowByText(text: string): Promise<Locator | null> {
    const rows = await this.dataRows.all();
    for (const row of rows) {
      const content = await row.textContent();
      if (content?.includes(text)) {
        return row;
      }
    }
    return null;
  }
  
  // Validation methods
  async getFieldError(fieldName: string): Promise<string | null> {
    const errorId = await this.page.locator(`input[name="${fieldName}"]`).getAttribute('aria-describedby');
    if (errorId) {
      return await this.page.locator(`#${errorId}`).textContent();
    }
    return null;
  }
  
  async isFieldValid(fieldName: string): Promise<boolean> {
    const field = this.page.locator(`input[name="${fieldName}"]`);
    const ariaInvalid = await field.getAttribute('aria-invalid');
    return ariaInvalid !== 'true';
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
  
  async expectPageTitle(title: string) {
    await expect(this.pageTitle).toContainText(title);
  }
  
  async expectFieldError(fieldName: string, errorMessage: string) {
    const error = await this.getFieldError(fieldName);
    expect(error).toBe(errorMessage);
  }
  
  async expectRowCount(count: number) {
    await expect(this.dataRows).toHaveCount(count);
  }
  
  // Complex interaction methods
  async completeWorkflow(data: [WorkflowDataType]) {
    await this.fillForm(data.formData);
    await this.submitForm();
    await this.waitForResponse();
  }
  
  // Response waiting helpers
  private async waitForResponse() {
    await Promise.race([
      this.page.waitForResponse(response => 
        response.url().includes('/api/[endpoint]') && 
        response.status() === 200
      ),
      this.page.waitForTimeout(5000) // Fallback timeout
    ]);
  }
  
  // Screenshot helpers for debugging
  async takeDebugScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `debug-screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }
  
  // Accessibility helpers
  async checkAccessibility() {
    // Basic accessibility checks
    const issues: string[] = [];
    
    // Check for missing labels
    const inputsWithoutLabels = await this.page.locator('input:not([aria-label]):not([aria-labelledby])').count();
    if (inputsWithoutLabels > 0) {
      issues.push(`${inputsWithoutLabels} input(s) without labels`);
    }
    
    // Check for missing alt text
    const imagesWithoutAlt = await this.page.locator('img:not([alt])').count();
    if (imagesWithoutAlt > 0) {
      issues.push(`${imagesWithoutAlt} image(s) without alt text`);
    }
    
    return issues;
  }
  
  // Mobile-specific methods
  async switchToMobileView() {
    await this.page.setViewportSize({ width: 375, height: 667 });
  }
  
  async switchToDesktopView() {
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }
}