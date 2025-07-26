Feature: Event Management
  As a Lodge Administrator
  I want to manage Founders Day events
  So that members can register and participate

  Background:
    Given I am logged in as a lodge administrator
    And I have permission to manage events for "Minneapolis Lodge #19"

  Scenario: Create a new Founders Day event
    When I navigate to the event management dashboard
    And I click "Create New Event"
    And I fill in the event details:
      | Field               | Value                                    |
      | Event Name          | Founders Day 2024 Celebration           |
      | Event Type          | Annual Banquet                          |
      | Date                | 2024-03-15                              |
      | Start Time          | 18:00                                   |
      | End Time            | 21:00                                   |
      | Venue               | Minneapolis Masonic Center              |
      | Address             | 123 Main St, Minneapolis, MN 55401      |
      | Capacity            | 150                                     |
      | Registration Opens  | 2024-02-01                              |
      | Registration Closes | 2024-03-10                              |
      | Member Price        | 50.00                                   |
      | Guest Price         | 65.00                                   |
      | Description         | Annual celebration of our founding      |
    And I upload an event banner image
    And I click "Save and Publish"
    Then I should see a success message "Event created successfully"
    And the event should appear in the events list with status "Published"
    And members should be able to see the event on the public calendar

  Scenario: Edit existing event with registrations
    Given an event "Spring Gathering" exists with 25 registrations
    When I edit the event details
    And I change the venue to "St. Paul Masonic Center"
    And I click "Save Changes"
    Then I should see a warning "This event has existing registrations. Attendees will be notified of changes."
    When I confirm the changes
    Then all 25 registered attendees should receive an email notification
    And the event history should show the venue change

  Scenario Outline: Event capacity management
    Given an event exists with capacity <capacity>
    And <registered> members are already registered
    When a member tries to register
    Then they should <result>
    And the available spots should show <available>

    Examples:
      | capacity | registered | result                         | available |
      | 100      | 50         | be able to register           | 49        |
      | 100      | 99         | be able to register           | 0         |
      | 100      | 100        | see "Event is full" message   | 0         |
      | 100      | 100        | be added to waitlist          | 0         |

  Scenario: Cancel an event
    Given an event "Summer Picnic" exists with 45 registrations
    When I navigate to the event details page
    And I click "Cancel Event"
    Then I should see a warning "This will cancel the event and notify all 45 registered attendees. This action cannot be undone."
    When I provide a cancellation reason "Venue unavailable due to renovations"
    And I confirm the cancellation
    Then the event status should change to "Cancelled"
    And all registered attendees should receive a cancellation email with the reason
    And all payments should be marked for refund

  Scenario: Manage event registrations
    Given an event "Annual Dinner" exists
    When I navigate to the event registrations page
    Then I should see a list of all registered members
    And I should be able to:
      | Action                   | Description                              |
      | View attendee details    | See member info and guest count         |
      | Check-in attendees       | Mark attendees as present               |
      | Export registration list | Download CSV of all registrations       |
      | Send bulk email         | Email all registered attendees          |
      | Add manual registration  | Register a member manually              |

  Scenario: Event reporting and analytics
    Given multiple events have been completed
    When I navigate to the events analytics page
    Then I should see:
      | Metric                    | Description                             |
      | Total events              | Number of events created                |
      | Average attendance        | Mean attendance across events           |
      | Revenue by event          | Total revenue per event                 |
      | Popular event types       | Most attended event categories          |
      | Registration trends       | Graph of registrations over time        |
    And I should be able to export reports as PDF or Excel

  @permissions
  Scenario: Role-based event management
    Given I am logged in as a "Lodge Secretary"
    When I navigate to the event management dashboard
    Then I should only see events for my assigned lodge
    And I should be able to:
      | Action          | Allowed |
      | View events     | Yes     |
      | Create events   | Yes     |
      | Edit own events | Yes     |
      | Delete events   | No      |
      | View analytics  | Yes     |

  Scenario: Recurring event creation
    When I create a new event
    And I enable "Make this a recurring event"
    And I set recurrence pattern:
      | Pattern    | Monthly                    |
      | Day        | Third Thursday            |
      | Duration   | 6 months                  |
      | Start Date | 2024-01-18               |
    And I save the event
    Then 6 individual events should be created
    And each event should have the correct date:
      | Event # | Date       |
      | 1       | 2024-01-18 |
      | 2       | 2024-02-15 |
      | 3       | 2024-03-21 |
      | 4       | 2024-04-18 |
      | 5       | 2024-05-16 |
      | 6       | 2024-06-20 |