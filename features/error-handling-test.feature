Feature: Error Handling Test

  As a test suite
  I want to handle errors gracefully
  So that tests provide meaningful feedback

  @smoke @error-handling
  Scenario: Navigate to homepage with error handling
    Given I am on the homepage
    Then the page should load with basic structure

  @error-handling  
  Scenario: Navigation links with fallbacks
    Given I am on the homepage
    Then I should see the following navigation links:
      | Home |