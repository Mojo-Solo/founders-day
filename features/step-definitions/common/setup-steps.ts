import { Given, When, Then } from '@cucumber/cucumber';
import { FoundersDayWorld } from '../../support/world';
import { expect } from 'chai';

Given('the test environment is configured', async function(this: FoundersDayWorld) {
  // Verify basic configuration
  expect(this.apiUrl).to.exist;
  expect(this.testData).to.exist;
  
  this.attach('Test environment configured successfully', 'text/plain');
});

When('I run a simple test', async function(this: FoundersDayWorld) {
  // Perform a simple operation
  this.testData.testRun = true;
  this.attach('Simple test executed', 'text/plain');
});

Then('the test should pass successfully', async function(this: FoundersDayWorld) {
  // Verify the test ran
  expect(this.testData.testRun).to.equal(true);
  this.attach('Test passed successfully', 'text/plain');
});