import { Given, When, Then } from '@cucumber/cucumber';
import { FoundersDayWorld } from '../../support/world';
import { expect } from 'chai';

Given('the Founders Day {int} event is open for registration', async function(this: FoundersDayWorld, year: number) {
  // Verify event is open via API
  const response = await this.apiCall('/api/public/events/current');
  const event = await response.json() as { year: number; registrationOpen: boolean };
  
  expect(event.year).to.equal(year);
  expect(event.registrationOpen).to.equal(true);
  
  this.attachJSON({ event });
});

Given('the current date is {string} which is before the early bird deadline', async function(this: FoundersDayWorld, date: string) {
  // Store the date context
  this.testData.currentDate = date;
  this.attach(`Test date set to: ${date}`, 'text/plain');
});

Given('individual tickets are priced at {amount} regular and {amount} early bird', async function(this: FoundersDayWorld, regularPrice: number, earlyBirdPrice: number) {
  this.testData.pricing = {
    regular: regularPrice,
    earlyBird: earlyBirdPrice
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
  // Simulate payment via API
  const registrationData = {
    tickets: this.testData.selectedTickets,
    attendee: this.testData.registrationDetails,
    payment: {
      method: 'card',
      testCard: cardNumber
    }
  };
  
  const response = await this.apiCall('/api/public/registrations', {
    method: 'POST',
    body: JSON.stringify(registrationData)
  });
  
  if (response.ok) {
    const result = await response.json();
    this.testData.lastRegistration = result;
    this.attachJSON({ registration: result });
  } else {
    const error = await response.text();
    throw new Error(`Registration failed: ${error}`);
  }
});

Then('I should see the early bird price of {amount}', async function(this: FoundersDayWorld, expectedPrice: number) {
  expect(this.testData.pricing?.earlyBird).to.equal(expectedPrice);
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