Feature: Profile Management
  As a registered user
  I want to manage my profile information
  So that I can keep my details up to date and control my preferences

  Background:
    Given I am logged in as "user@example.com"
    And I navigate to my profile page

  @smoke @profile
  Scenario: View profile information
    Then I should see my profile details:
      | Field        | Value                |
      | Email        | user@example.com     |
      | First Name   | John                 |
      | Last Name    | Doe                  |
      | Phone        | (555) 123-4567       |
    And I should see my registration history

  @profile @update
  Scenario: Update profile information
    When I click "Edit Profile"
    And I update my profile with:
      | Field        | Value                |
      | First Name   | Jonathan             |
      | Phone        | (555) 987-6543       |
    And I click "Save Changes"
    Then I should see "Profile updated successfully"
    And my profile should display:
      | Field        | Value                |
      | First Name   | Jonathan             |
      | Phone        | (555) 987-6543       |

  @profile @password
  Scenario: Change password
    When I click "Change Password"
    And I enter my current password "CurrentPass123!"
    And I enter a new password "NewSecurePass456!"
    And I confirm the new password "NewSecurePass456!"
    And I click "Update Password"
    Then I should see "Password changed successfully"
    And I should receive a password change confirmation email

  @profile @preferences
  Scenario: Update communication preferences
    When I click "Communication Preferences"
    And I uncheck "Promotional emails"
    And I check "SMS notifications"
    And I select "Weekly" from "Email digest frequency"
    And I click "Save Preferences"
    Then I should see "Preferences updated"
    And my preferences should be saved

  @profile @avatar
  Scenario: Upload profile picture
    When I click "Change Profile Picture"
    And I upload an image "profile-photo.jpg"
    And I click "Save"
    Then I should see "Profile picture updated"
    And my new profile picture should be displayed

  @profile @dietary
  Scenario: Update dietary restrictions
    When I click "Dietary Preferences"
    And I select the following dietary restrictions:
      | Vegetarian |
      | Gluten-free |
    And I enter "Severe nut allergy" in the additional notes
    And I click "Save Dietary Preferences"
    Then I should see "Dietary preferences saved"
    And my dietary restrictions should be updated

  @profile @emergency
  Scenario: Add emergency contact
    When I click "Emergency Contacts"
    And I click "Add Emergency Contact"
    And I fill in the emergency contact form:
      | Field         | Value              |
      | Name          | Jane Doe           |
      | Relationship  | Spouse             |
      | Phone         | (555) 999-8888     |
      | Email         | jane@example.com   |
    And I click "Save Contact"
    Then I should see "Emergency contact added"
    And "Jane Doe" should appear in my emergency contacts list

  @profile @validation
  Scenario: Profile validation errors
    When I click "Edit Profile"
    And I clear the "Email" field
    And I enter "invalid-phone" in the "Phone" field
    And I click "Save Changes"
    Then I should see the following errors:
      | Email is required |
      | Please enter a valid phone number |

  @profile @deactivate
  Scenario: Deactivate account
    When I click "Account Settings"
    And I click "Deactivate Account"
    Then I should see "Are you sure you want to deactivate your account?"
    When I enter my password "CurrentPass123!"
    And I click "Confirm Deactivation"
    Then I should see "Account deactivated"
    And I should be logged out
    And I should receive a deactivation confirmation email