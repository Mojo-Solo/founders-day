Feature: Payment Processing with Square
  As an event organizer
  I want to securely process payments through Square
  So that attendees can purchase tickets safely and efficiently

  Background:
    Given Square payment integration is configured
    And I have items in my registration cart

  @critical @payment
  Scenario: Successful payment with Square
    Given my cart contains:
      | Item              | Quantity | Unit Price | Total   |
      | Individual Ticket | 2        | $75.00     | $150.00 |
    When I proceed to checkout
    Then I should see the Square payment form embedded
    When I enter payment details:
      | Card Number | 4111 1111 1111 1111 |
      | Expiry      | 12/25               |
      | CVV         | 123                 |
      | ZIP         | 55401               |
    And I submit the payment
    Then I should see "Processing payment..." 
    And within "10" seconds I should see "Payment successful!"
    And a Square transaction should be created with:
      | Amount | $150.00    |
      | Status | COMPLETED  |
      | Type   | CHARGE     |

  @security
  Scenario: Payment form security validations
    When I inspect the payment form
    Then the Square iframe should be loaded from "https://web.squarecdn.com"
    And the card number field should not be accessible from our JavaScript
    And the form should use SCA (Strong Customer Authentication) when required

  @error-handling
  Scenario: Handling declined payments
    Given my cart total is "$75.00"
    When I enter the test card number "4000 0000 0000 0002" (decline)
    And I submit the payment
    Then I should see "Payment declined. Please try another card."
    And no order should be created in the database
    And the cart should remain intact

  @network-resilience  
  Scenario: Payment retry on network timeout
    Given my cart total is "$75.00"
    When I submit a valid payment
    And the network connection is interrupted
    Then the system should retry the payment "3" times
    And show "Retrying payment..." to the user
    When the connection is restored
    Then the payment should complete successfully
    And only one charge should appear in Square

  @refund
  Scenario: Processing a refund through admin
    Given there is a completed order "#FD-789012" for "$150.00"
    And I am logged in as an admin
    When I navigate to the order details
    And I click "Process Refund"
    And I select "Full Refund"
    And I provide the reason "Event cancelled"
    And I confirm the refund
    Then a Square refund should be initiated for "$150.00"
    And the order status should change to "Refunded"
    And an email should be sent to the customer
    And the tickets should be released back to inventory

  @webhook
  Scenario: Square webhook payment confirmation
    Given I have initiated a payment for "$75.00"
    When Square sends a payment.created webhook
    Then our system should verify the webhook signature
    And update the order status to "Payment Confirmed"
    And send a confirmation email
    But if the signature is invalid
    Then the webhook should be rejected with status "401"

  @3d-secure
  Scenario: European card requiring 3D Secure authentication
    Given my cart total is "$75.00"
    When I enter a European test card "4000 0027 6000 3184"
    And I submit the payment
    Then I should be redirected to 3D Secure authentication
    When I complete the authentication successfully
    Then I should return to the confirmation page
    And the payment should be completed

  @reporting
  Scenario: Payment reconciliation for accounting
    Given the following payments were processed today:
      | Order ID   | Amount  | Fee   | Net     |
      | FD-100001  | $75.00  | $2.18 | $72.82  |
      | FD-100002  | $150.00 | $4.35 | $145.65 |
      | FD-100003  | $75.00  | $2.18 | $72.82  |
    When an admin generates the daily payment report
    Then the report should show:
      | Gross Revenue | $300.00 |
      | Square Fees   | $8.71   |
      | Net Revenue   | $291.29 |
    And should match the Square dashboard totals