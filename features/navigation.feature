Feature: Site Navigation
  As a user of the Founders Day platform
  I want to navigate between different sections easily
  So that I can access all features efficiently

  @smoke @navigation
  Scenario: Navigate main menu as guest
    Given I am on the homepage
    Then I should see the following navigation links:
      | Home |
      | About |
      | Events |
      | Register |
      | Contact |
      | Login |
    And I should not see the following links:
      | Dashboard |
      | My Profile |
      | Logout |

  @navigation @authenticated
  Scenario: Navigate main menu as authenticated user
    Given I am logged in as "user@example.com"
    When I visit the homepage
    Then I should see the following navigation links:
      | Home |
      | About |
      | Events |
      | Dashboard |
      | My Profile |
    And I should see a user menu with "user@example.com"
    And I should not see "Login"

  @navigation @mobile
  Scenario: Mobile navigation menu
    Given I am using a mobile device
    When I visit the homepage
    Then I should see a hamburger menu icon
    When I click the hamburger menu
    Then I should see the mobile navigation drawer
    And I should see all navigation links in the drawer

  @navigation @breadcrumbs
  Scenario: Breadcrumb navigation
    Given I am on the homepage
    When I navigate to "Events"
    And I click on "Founders Day Gala 2025"
    Then I should see breadcrumbs:
      | Home | Events | Founders Day Gala 2025 |
    When I click on "Events" in the breadcrumbs
    Then I should be on the events listing page

  @navigation @footer
  Scenario: Footer navigation links
    Given I am on any page
    Then I should see footer sections:
      | Section      | Links                                    |
      | About        | Our Story, Mission, Board Members        |
      | Events       | Upcoming Events, Past Events, Gallery    |
      | Support      | Donate, Volunteer, Sponsorship          |
      | Connect      | Contact Us, Newsletter, Social Media     |
      | Legal        | Privacy Policy, Terms of Service         |

  @navigation @quicklinks
  Scenario: Quick action navigation for logged in users
    Given I am logged in as "user@example.com"
    And I have registered for an event
    When I hover over "My Profile" 
    Then I should see a dropdown with:
      | My Registrations |
      | Payment History |
      | Profile Settings |
      | Logout |

  @navigation @search
  Scenario: Navigate using search
    Given I am on the homepage
    When I click the search icon
    And I search for "gala"
    Then I should see search results for "gala"
    When I click on "Founders Day Gala 2025" in the results
    Then I should be on the gala event page

  @navigation @accessibility
  Scenario: Keyboard navigation
    Given I am on the homepage
    When I press Tab
    Then the "Skip to main content" link should be focused
    When I continue pressing Tab
    Then I should be able to navigate through all interactive elements
    And focus indicators should be clearly visible

  @navigation @deeplink
  Scenario: Direct link navigation
    Given I have a direct link to "/events/founders-day-gala-2025"
    When I visit the link
    Then I should be on the "Founders Day Gala 2025" page
    And the page should load correctly
    And navigation should highlight "Events"

  @navigation @404
  Scenario: Navigate to non-existent page
    Given I visit "/non-existent-page"
    Then I should see a 404 error page
    And I should see "Page not found"
    And I should see a link to "Return to Homepage"
    When I click "Return to Homepage"
    Then I should be on the homepage

  @navigation @restricted
  Scenario: Navigate to restricted area
    Given I am not logged in
    When I try to visit "/dashboard"
    Then I should be redirected to "/login"
    And I should see "Please log in to access this page"
    When I log in with valid credentials
    Then I should be redirected to "/dashboard"

  @navigation @language
  Scenario: Language switcher navigation
    Given I am on the homepage
    When I click the language selector
    Then I should see available languages:
      | English |
      | Spanish |
      | French |
    When I select "Spanish"
    Then the page should reload in Spanish
    And navigation items should be in Spanish