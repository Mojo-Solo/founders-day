Feature: User Registration
  As a Minnesota Freemason
  I want to register for Founders Day events
  So that I can participate in lodge activities

  Background:
    Given I am on the Founders Day Minnesota website
    And I am not logged in

  Scenario: Successful registration with valid information
    When I navigate to the registration page
    And I fill in the registration form with:
      | Field            | Value                    |
      | First Name       | John                     |
      | Last Name        | Smith                    |
      | Email            | john.smith@example.com   |
      | Phone            | 612-555-0123            |
      | Lodge Name       | Minneapolis Lodge #19    |
      | Lodge Number     | 19                       |
      | Member ID        | MN12345                  |
      | Password         | SecurePass123!           |
      | Confirm Password | SecurePass123!           |
    And I accept the terms and conditions
    And I click the "Register" button
    Then I should see a success message "Registration successful! Please check your email to verify your account."
    And I should receive a verification email at "john.smith@example.com"
    And my account should be created with status "pending_verification"

  Scenario: Registration fails with duplicate email
    Given a user already exists with email "john.smith@example.com"
    When I navigate to the registration page
    And I fill in the registration form with:
      | Field            | Value                    |
      | Email            | john.smith@example.com   |
      | Other Fields     | Valid Values             |
    And I click the "Register" button
    Then I should see an error message "An account with this email already exists"
    And the email field should be highlighted in red
    And I should remain on the registration page

  Scenario: Password validation
    When I navigate to the registration page
    And I enter "weak" in the password field
    Then I should see password requirements:
      """
      Password must contain:
      - At least 8 characters
      - One uppercase letter
      - One lowercase letter
      - One number
      - One special character
      """
    And the password strength indicator should show "Weak"

  @mobile
  Scenario: Mobile responsive registration
    Given I am using a mobile device
    When I navigate to the registration page
    Then the form should be displayed in a single column
    And all form fields should be easily tappable
    And the keyboard should automatically appear for the first field

  Scenario: Lodge membership validation
    When I navigate to the registration page
    And I fill in the registration form with:
      | Field            | Value                    |
      | Lodge Number     | 19                       |
      | Member ID        | INVALID123               |
      | Other Fields     | Valid Values             |
    And I click the "Register" button
    Then I should see an error message "Member ID not found in lodge records"
    And the member ID field should be highlighted in red

  Scenario: Email verification process
    Given I have registered with email "john.smith@example.com"
    And I have received a verification email
    When I click the verification link in the email
    Then I should be redirected to the login page
    And I should see a success message "Email verified successfully! You can now log in."
    And my account status should be updated to "active"

  Scenario Outline: Field validation
    When I navigate to the registration page
    And I enter "<value>" in the "<field>" field
    And I move to the next field
    Then I should see validation message "<message>"

    Examples:
      | field       | value          | message                                |
      | Email       | invalid-email  | Please enter a valid email address     |
      | Phone       | 123            | Please enter a valid phone number      |
      | Lodge Number| abc            | Lodge number must be numeric           |
      | First Name  |                | First name is required                 |
      | Last Name   |                | Last name is required                  |