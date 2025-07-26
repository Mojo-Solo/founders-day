Feature: Admin Event Management Dashboard
  As an event administrator
  I want to manage events and monitor registrations in real-time
  So that I can ensure smooth event operations

  Background:
    Given I am logged in as an admin with email "admin@foundersday.com"
    And I am on the admin dashboard

  @real-time @dashboard
  Scenario: Real-time registration monitoring
    Given the dashboard is displaying current metrics:
      | Metric              | Value |
      | Total Registrations | 150   |
      | Revenue            | $11,250 |
      | Tickets Remaining  | 350   |
    When a new registration is completed for "2" tickets at "$75" each
    Then within "2" seconds the dashboard should update to show:
      | Metric              | Value |
      | Total Registrations | 151   |
      | Revenue            | $11,400 |
      | Tickets Remaining  | 348   |
    And the recent registrations list should show the new attendee at the top
    And a notification should appear "New registration received!"

  @capacity-management
  Scenario: Managing event capacity limits
    Given the event has a capacity of "500" attendees
    And "498" tickets have been sold
    When I view the capacity warning
    Then I should see "ALMOST SOLD OUT - Only 2 tickets remaining!"
    When I click "Manage Capacity"
    Then I can:
      | Action                | Result                           |
      | Increase capacity     | Add more tickets to inventory    |
      | Create waiting list   | Enable waitlist registration     |
      | Close registration    | Prevent further registrations    |

  @email-campaign
  Scenario: Sending targeted email campaigns
    Given there are "200" registered attendees
    And "50" have dietary restrictions
    When I create a new email campaign
    And I select the segment "Attendees with dietary restrictions"
    Then "50" recipients should be selected
    When I use the template "Dietary Information Update"
    And I customize the content:
      """
      Dear {{firstName}},
      
      We have noted your dietary requirement: {{dietaryNeeds}}
      Our catering team has been informed and will ensure appropriate options are available.
      """
    And I click "Send Campaign"
    Then the campaign should be queued for delivery
    And I should see real-time delivery metrics:
      | Metric     | Updates            |
      | Sent       | Incrementing to 50 |
      | Delivered  | Real-time count    |
      | Opened     | Real-time count    |
      | Clicked    | Real-time count    |

  @financial-reporting
  Scenario: Generating financial reports
    Given the event has the following registration data:
      | Type               | Quantity | Price Each | Total    |
      | Individual Tickets | 120      | $75        | $9,000   |
      | Table of 10       | 8        | $650       | $5,200   |
      | Sponsor Package   | 3        | $2,500     | $7,500   |
    When I generate a financial report for "March 2025"
    Then the report should show:
      | Metric                 | Value    |
      | Gross Revenue         | $21,700  |
      | Payment Processing Fees| $630.30  |
      | Net Revenue           | $21,069.70|
      | Average Ticket Value  | $105.34  |
    And I should be able to export as "PDF" or "Excel"

  @check-in-management
  Scenario: Event day check-in process
    Given today is the event date "2025-07-04"
    And the check-in mode is activated
    When an attendee presents QR code "FD-123456"
    And I scan it with the mobile app
    Then the system should:
      | Check                  | Result                          |
      | Validate ticket        | Show "Valid - Sarah Johnson"    |
      | Mark as checked in     | Update status immediately       |
      | Display seat info      | "Table 12, Seat 3"             |
      | Show dietary needs     | "Vegetarian"                   |
    And the check-in count should increment
    When the same QR code is scanned again
    Then it should show "Already checked in at 10:30 AM"

  @cms-integration
  Scenario: Managing event content through CMS
    When I navigate to "Content Management"
    And I edit the "Founders Day 2025" event
    Then I can update:
      | Field              | Type        | Preview |
      | Event Description  | Rich Text   | Live    |
      | Schedule          | Timeline    | Live    |
      | Speaker Bios      | Cards       | Live    |
      | Venue Information | Map + Text  | Live    |
      | Sponsor Logos     | Image Grid  | Live    |
    When I update the event schedule
    And I click "Publish Changes"
    Then the changes should appear on the public site immediately
    And a version history entry should be created

  @analytics-dashboard
  Scenario: Viewing comprehensive analytics
    When I navigate to the analytics dashboard
    Then I should see visualizations for:
      | Chart Type    | Data Displayed                        |
      | Line Graph    | Registration trend over time          |
      | Pie Chart     | Ticket type distribution             |
      | Heat Map      | Registration geography (by ZIP)       |
      | Bar Chart     | Daily revenue comparison             |
      | Funnel        | Registration completion rate         |
    And I can filter data by:
      | Filter        | Options                              |
      | Date Range    | Last 7/30/90 days, Custom           |
      | Ticket Type   | Individual, Table, Sponsor          |
      | Status        | Completed, Pending, Refunded        |

  @permission-management
  Scenario: Managing admin user permissions
    Given I have super admin privileges
    When I navigate to "Team Management"
    And I invite a new admin with email "volunteer@foundersday.com"
    Then I can assign permissions:
      | Permission          | Access Level          |
      | View Registrations  | ✓ Allowed            |
      | Process Refunds     | ✗ Denied             |
      | Send Emails         | ✓ Allowed            |
      | Edit Event Details  | ✗ Denied             |
      | View Reports        | ✓ Allowed            |
      | Manage Users        | ✗ Denied             |
    When they accept the invitation
    Then they should only see allowed menu items
    And restricted actions should be hidden