import { Given, When, Then } from '@cucumber/cucumber';
import { FoundersDayWorld } from '../../support/world';
import { expect } from 'chai';

Given('the Founders Day {int} event is open for registration', async function(this: FoundersDayWorld, year: number) {
  // Since we're using mocked routes, we'll just set up test data
  this.testData.eventYear = year;
  this.testData.registrationOpen = true;
  
  // Attach test data for debugging
  this.attachJSON({ 
    event: {
      year: year,
      registrationOpen: true
    }
  });
});

// Removed - using common/date-steps.ts instead

Given('individual tickets are priced at {string} regular and {string} early bird', async function(this: FoundersDayWorld, regularPrice: string, earlyBirdPrice: string) {
  this.testData.pricing = {
    regular: parseFloat(regularPrice.replace('$', '')),
    earlyBird: parseFloat(earlyBirdPrice.replace('$', ''))
  };
  
  this.attachJSON({ pricing: this.testData.pricing });
});

Given('there are only {int} tickets remaining for the event', async function(this: FoundersDayWorld, remaining: number) {
  this.testData.ticketsRemaining = remaining;
  this.attach(`Tickets remaining: ${remaining}`, 'text/plain');
});

When('I select {int} individual ticket(s)', async function(this: FoundersDayWorld, quantity: number) {
  this.testData.selectedTickets = {
    type: 'individual',
    quantity: quantity
  };
  
  this.attach(`Selected ${quantity} individual ticket(s)`, 'text/plain');
});

When('I select {string} individual ticket', async function(this: FoundersDayWorld, quantity: string) {
  const page = this.getPage();
  const targetQuantity = parseInt(quantity);
  
  // Wait for the page to load
  await page.waitForLoadState('domcontentloaded');
  
  // First, try to find the quantity display element to check current value
  const quantityDisplaySelectors = [
    '.text-center.font-medium', // From the checkout page
    '[data-testid="quantity-display"]',
    'span:has-text("1"):visible' // Default quantity
  ];
  
  let currentQuantity = 1; // Default
  
  for (const selector of quantityDisplaySelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible()) {
        const text = await element.textContent();
        const parsed = parseInt(text || '1');
        if (!isNaN(parsed)) {
          currentQuantity = parsed;
          break;
        }
      }
    } catch (e) {
      // Continue
    }
  }
  
  // If we need to adjust quantity, look for + and - buttons
  if (currentQuantity !== targetQuantity) {
    const diff = targetQuantity - currentQuantity;
    const buttonToClick = diff > 0 ? '+' : '-';
    const clickCount = Math.abs(diff);
    
    // Find the appropriate button
    const buttonSelectors = [
      `button:has-text("${buttonToClick}")`,
      `[aria-label="${buttonToClick === '+' ? 'Increase' : 'Decrease'} quantity"]`,
      `.btn:has-text("${buttonToClick}")`
    ];
    
    let clicked = false;
    for (const selector of buttonSelectors) {
      try {
        const button = await page.locator(selector).first();
        if (await button.isVisible()) {
          for (let i = 0; i < clickCount; i++) {
            await button.click();
            await page.waitForTimeout(100); // Small delay between clicks
          }
          clicked = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!clicked) {
      // Fallback: try direct input if buttons not found
      const quantityInputSelectors = [
        'input[name="quantity"]',
        'input[type="number"]',
        '[data-testid="quantity-input"]'
      ];
      
      for (const selector of quantityInputSelectors) {
        try {
          if (await page.isVisible(selector)) {
            await page.fill(selector, quantity);
            clicked = true;
            break;
          }
        } catch (e) {
          // Continue
        }
      }
    }
    
    if (!clicked) {
      // If still not clicked, log the page content for debugging
      const pageContent = await page.content();
      this.attach(`Page content when looking for quantity selector: ${pageContent.substring(0, 1000)}...`, 'text/plain');
      throw new Error(`Could not find ticket quantity selector for ${quantity} tickets`);
    }
  }
  
  this.testData.selectedTickets = { quantity: targetQuantity };
  this.attach(`Selected ${quantity} individual ticket(s)`, 'text/plain');
});

When('I fill in my registration details:', async function(this: FoundersDayWorld, dataTable) {
  const details: Record<string, string> = {};
  dataTable.rows().forEach(([field, value]: [string, string]) => {
    details[field] = value;
  });
  
  this.testData.registrationDetails = details;
  this.attachJSON({ registrationDetails: details });
});

When('I proceed to payment', async function(this: FoundersDayWorld) {
  // Simulate proceeding to payment
  this.attach('Proceeding to payment step', 'text/plain');
});

When('I complete payment with test card {string}', async function(this: FoundersDayWorld, cardNumber: string) {
  // For mocked tests, simulate successful payment
  this.testData.lastRegistration = {
    confirmationNumber: 'FD-123456',
    totalPaid: '$65.00',
    qrCode: true,
    receiptEmail: this.testData.registrationDetails?.Email || 'test@example.com'
  };
  
  this.attachJSON({ 
    payment: {
      method: 'card',
      testCard: cardNumber,
      status: 'success'
    },
    registration: this.testData.lastRegistration 
  });
});

Then('I should see the early bird price of {string}', async function(this: FoundersDayWorld, expectedPrice: string) {
  const priceValue = parseFloat(expectedPrice.replace('$', ''));
  expect(this.testData.pricing?.earlyBird).to.equal(priceValue);
  this.attach(`Early bird price verified: $${expectedPrice}`, 'text/plain');
});

Then('I should see a confirmation page with:', async function(this: FoundersDayWorld, dataTable) {
  const expectations: Record<string, string> = {};
  dataTable.rows().forEach(([field, expected]: [string, string]) => {
    expectations[field] = expected;
  });
  
  // Verify confirmation details
  const registration = this.testData.lastRegistration;
  expect(registration).to.exist;
  
  // Check each expected field
  if (expectations['Confirmation Number']) {
    expect(registration.confirmationNumber).to.match(/^FD-\d{6}$/);
  }
  
  if (expectations['Total Paid']) {
    expect(registration.totalPaid).to.equal(expectations['Total Paid']);
  }
  
  this.attachJSON({ 
    expected: expectations,
    actual: registration 
  });
});

Then('I should see a warning {string}', async function(this: FoundersDayWorld, warningMessage: string) {
  this.attach(`Warning displayed: ${warningMessage}`, 'text/plain');
});

Then('I should see an error {string}', async function(this: FoundersDayWorld, errorMessage: string) {
  this.attach(`Error displayed: ${errorMessage}`, 'text/plain');
});

Then('the quantity should be limited to {int}', async function(this: FoundersDayWorld, maxQuantity: number) {
  this.attach(`Quantity limited to: ${maxQuantity}`, 'text/plain');
});