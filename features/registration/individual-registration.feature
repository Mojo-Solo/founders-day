Feature: Individual Event Registration
  As a Minnesota resident interested in attending Founders Day
  I want to register for the event online
  So that I can secure my spot and receive event information

  Background:
    Given the Founders Day 2025 event is open for registration
    And I am on the Founders Day website

  @smoke @critical
  Scenario: Successful individual registration with early bird pricing
    Given the current date is "2025-05-15" which is before the early bird deadline
    And individual tickets are priced at "$75" regular and "$65" early bird
    When I navigate to the registration page
    And I select "1" individual ticket
    Then I should see the early bird price of "$65"
    When I fill in my registration details:
      | Field          | Value                    |
      | First Name     | Sarah                    |
      | Last Name      | Johnson                  |
      | Email          | sarah.j@example.com      |
      | Phone          | (612) 555-1234          |
      | Dietary Needs  | Vegetarian               |
    And I proceed to payment
    And I complete payment with test card "4111 1111 1111 1111"
    Then I should see a confirmation page with:
      | Confirmation Number | Format: FD-XXXXXX              |
      | QR Code            | Displayed                       |
      | Total Paid         | $65.00                         |
      | Receipt Email      | Sent to sarah.j@example.com    |

  @edge-case
  Scenario: Registration when event is nearly sold out
    Given there are only "3" tickets remaining for the event
    When I navigate to the registration page
    Then I should see a warning "Only 3 tickets remaining!"
    When I try to select "5" individual tickets
    Then I should see an error "Only 3 tickets available"
    And the quantity should be limited to "3"

  @validation
  Scenario Outline: Registration form validation
    When I navigate to the registration page
    And I select "1" individual ticket
    And I fill in the "<Field>" with "<Invalid Value>"
    And I try to proceed to payment
    Then I should see the validation error "<Error Message>"

    Examples:
      | Field      | Invalid Value | Error Message                    |
      | Email      | invalid-email | Please enter a valid email       |
      | Phone      | 123          | Please enter a valid phone number |
      | First Name |              | First name is required           |
      | Last Name  |              | Last name is required            |

  @accessibility
  Scenario: Registration with accessibility requirements
    When I navigate to the registration page using a screen reader
    Then all form fields should have proper labels
    And error messages should be announced
    And the progress indicator should be accessible
    When I request accessibility accommodations
    And I select "Wheelchair accessible seating"
    And I add a note "Requires ASL interpreter"
    Then these requirements should be included in my registration

  @integration
  Scenario: Registration data flows to admin dashboard
    Given I am monitoring the admin dashboard in another session
    When I complete a registration for "2" tickets
    Then within "5" seconds the admin dashboard should show:
      | Metric                | Update                   |
      | Total Registrations   | Increased by 1           |
      | Tickets Sold         | Increased by 2           |
      | Revenue              | Increased by ticket price |
      | Recent Registrations | Shows new entry          |