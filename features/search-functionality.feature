Feature: Search Functionality
  As a user of the Founders Day platform
  I want to search for events, people, and information
  So that I can quickly find what I'm looking for

  Background:
    Given the following events exist:
      | Name                    | Date       | Category   | Status    |
      | Founders Day Gala 2025  | 2025-06-15 | Gala       | Upcoming  |
      | Summer Golf Tournament  | 2025-07-20 | Sports     | Upcoming  |
      | Winter Charity Auction  | 2024-12-10 | Fundraiser | Past      |
      | Spring Volunteer Drive  | 2025-04-05 | Community  | Upcoming  |

  @smoke @search
  Scenario: Basic search functionality
    Given I am on the homepage
    When I click the search icon
    And I search for "gala"
    Then the search functionality should be working
    
  @search @complete
  Scenario: Full search test with results
    Given I am on the homepage
    When I click the search icon
    And I search for "gala"
    Then I should see search results containing:
      | Founders Day Gala 2025 |
    And I should see "1 result found"
    And the search term "gala" should be highlighted in results

  @search @filters
  Scenario: Search with filters
    Given I am on the search page
    When I search for "event"
    And I apply the following filters:
      | Filter Type | Value    |
      | Category    | Gala     |
      | Status      | Upcoming |
      | Date Range  | Next 6 months |
    Then I should see filtered results
    And each result should match the applied filters

  @search @autocomplete
  Scenario: Search autocomplete suggestions
    Given I am on the homepage
    When I click the search icon
    And I type "found" in the search box
    Then I should see autocomplete suggestions:
      | Founders Day Gala 2025 |
      | Founders Day History |
      | Founding Members |
    When I click on "Founders Day Gala 2025"
    Then I should be taken to the gala event page

  @search @advanced
  Scenario: Advanced search options
    Given I am on the search page
    When I click "Advanced Search"
    Then I should see advanced search fields:
      | Field              | Type        |
      | Keywords           | Text        |
      | Event Category     | Dropdown    |
      | Date Range         | Date Picker |
      | Price Range        | Slider      |
      | Location           | Text        |
      | Ticket Availability| Checkbox    |
    When I fill in advanced search:
      | Field          | Value           |
      | Keywords       | golf tournament |
      | Event Category | Sports          |
      | Price Range    | $50-$200        |
    And I click "Search"
    Then I should see "Summer Golf Tournament" in results

  @search @no-results
  Scenario: Search with no results
    Given I am on the search page
    When I search for "xyz123nonexistent"
    Then I should see "No results found for 'xyz123nonexistent'"
    And I should see search suggestions:
      | Try different keywords |
      | Remove some filters |
      | Browse all events |

  @search @history
  Scenario: Recent searches
    Given I am logged in as "user@example.com"
    And I have previously searched for:
      | gala |
      | volunteer |
      | auction |
    When I click the search icon
    Then I should see "Recent Searches"
    And I should see my recent searches
    When I click on "gala" from recent searches
    Then the search should be performed for "gala"

  @search @registration
  Scenario: Search within my registrations
    Given I am logged in as "user@example.com"
    And I have registered for multiple events
    When I go to "My Registrations"
    And I search for "golf"
    Then I should only see my registrations matching "golf"
    And the search scope indicator should show "Searching in: My Registrations"

  @search @people
  Scenario: Search for people (admin only)
    Given I am logged in as an admin
    When I go to the admin dashboard
    And I search for "john.doe@example.com"
    Then I should see user profile for "John Doe"
    And I should see their registration history
    And I should see their volunteer activities

  @search @export
  Scenario: Export search results
    Given I am logged in as an admin
    And I am on the search page
    When I search for "2025"
    And I click "Export Results"
    Then I should see export options:
      | CSV |
      | PDF |
      | Excel |
    When I select "CSV"
    Then a CSV file should be downloaded with the search results

  @search @mobile
  Scenario: Mobile search experience
    Given I am using a mobile device
    When I tap the search icon
    Then the search overlay should cover the full screen
    And the keyboard should appear automatically
    When I search for "gala"
    Then results should be displayed in a mobile-friendly format
    And I should be able to swipe through results

  @search @voice
  Scenario: Voice search (if supported)
    Given my device supports voice input
    And I am on the search page
    When I click the microphone icon
    And I say "Founders Day Gala"
    Then the search box should show "Founders Day Gala"
    And search should be performed automatically

  @search @realtime
  Scenario: Real-time search updates
    Given I am on the search page
    When I type "g" in the search box
    Then I should see results update in real-time
    When I continue typing "ga"
    Then results should refine to show more relevant matches
    When I complete typing "gala"
    Then I should see the most relevant results for "gala"