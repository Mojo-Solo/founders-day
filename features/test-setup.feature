Feature: Test Setup Verification
  As a developer
  I want to ensure the Cucumber setup is working correctly
  So that I can write and run BDD tests

  @smoke @setup
  Scenario: Basic setup verification
    Given the test environment is configured
    When I run a simple test
    Then the test should pass successfully