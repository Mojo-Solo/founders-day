import { Given, When, Then } from '@cucumber/cucumber';
import { FoundersDayWorld } from '../../support/world';
import { expect } from 'chai';
// import { waitForElement, waitForText } from '@founders-day/test-utils';

// Visibility steps
Then('I should see {string}', async function(this: FoundersDayWorld, text: string) {
  const element = await this.waitForElement(`text="${text}"`);
  expect(await element.isVisible()).to.be.true;
});

Then('I should not see {string}', async function(this: FoundersDayWorld, text: string) {
  const element = await this.getPage().getByText(text);
  expect(await element.isVisible()).to.be.false;
});

When('I click {string}', async function(this: FoundersDayWorld, text: string) {
  await this.getPage().click(`text="${text}"`);
});

Then('I should see the following:', async function(this: FoundersDayWorld, dataTable: any) {
  const items = dataTable.raw().flat();
  for (const item of items) {
    const element = await this.getPage().getByText(item);
    expect(await element.isVisible()).to.be.true;
  }
});

Then('I should see a {string} message', async function(this: FoundersDayWorld, messageType: string) {
  const selector = `.${messageType}-message, [role="alert"].${messageType}`;
  const element = await this.waitForElement(selector);
  expect(await element.isVisible()).to.be.true;
});

// Button states
Then('the {string} button should be disabled', async function(this: FoundersDayWorld, buttonText: string) {
  const button = await this.getPage().getByRole('button', { name: buttonText });
  expect(await button.isDisabled()).to.be.true;
});

Then('the {string} button should be enabled', async function(this: FoundersDayWorld, buttonText: string) {
  const button = await this.getPage().getByRole('button', { name: buttonText });
  expect(await button.isEnabled()).to.be.true;
});

// Loading states
Then('I should see a loading indicator', async function(this: FoundersDayWorld) {
  const loader = await this.waitForElement('[data-testid="loading"]');
  expect(await loader.isVisible()).to.be.true;
});

Then('I should not see a loading indicator', async function(this: FoundersDayWorld) {
  const loader = await this.getPage().locator('[data-testid="loading"]');
  await loader.waitFor({ state: 'hidden', timeout: 5000 });
});

// Modal/Dialog steps
Then('I should see a modal with title {string}', async function(this: FoundersDayWorld, title: string) {
  const modal = await this.waitForElement('[role="dialog"]');
  expect(await modal.isVisible()).to.be.true;
  const modalTitle = await this.getPage().getByRole('heading', { name: title });
  expect(await modalTitle.isVisible()).to.be.true;
});

When('I close the modal', async function(this: FoundersDayWorld) {
  await this.getPage().click('[aria-label="Close"]');
});

// Table steps
Then('I should see the following in the table:', async function(this: FoundersDayWorld, dataTable: any) {
  const headers = dataTable.raw()[0];
  const rows = dataTable.raw().slice(1);
  
  // Verify headers
  for (const header of headers) {
    const headerElement = await this.getPage().getByRole('columnheader', { name: header });
    expect(await headerElement.isVisible()).to.be.true;
  }
  
  // Verify data
  for (const row of rows) {
    for (const cell of row) {
      const cellElement = await this.getPage().getByRole('cell', { name: cell });
      expect(await cellElement.isVisible()).to.be.true;
    }
  }
});

// Links
When('I click the {string} link', async function(this: FoundersDayWorld, linkText: string) {
  await this.getPage().getByRole('link', { name: linkText }).click();
});

Then('I should see a link to {string}', async function(this: FoundersDayWorld, linkText: string) {
  const link = await this.getPage().getByRole('link', { name: linkText });
  expect(await link.isVisible()).to.be.true;
});

// Images
Then('I should see an image with alt text {string}', async function(this: FoundersDayWorld, altText: string) {
  const image = await this.getPage().getByAltText(altText);
  expect(await image.isVisible()).to.be.true;
});

// Tooltips
When('I hover over {string}', async function(this: FoundersDayWorld, elementText: string) {
  const element = await this.getPage().getByText(elementText);
  await element.hover();
});

Then('I should see a tooltip with text {string}', async function(this: FoundersDayWorld, tooltipText: string) {
  const tooltip = await this.waitForElement(`[role="tooltip"]:has-text("${tooltipText}")`);
  expect(await tooltip.isVisible()).to.be.true;
});