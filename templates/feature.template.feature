Feature: [Feature Name]
  As a [user role]
  I want to [action/goal]
  So that [benefit/value]

  # Optional: Background for common setup
  Background:
    Given [common precondition]
    And [another common precondition]

  # Happy path scenario
  Scenario: [Successful primary action]
    Given [initial context]
    When [user action]
    And [additional action]
    Then [expected outcome]
    And [additional verification]

  # Error handling scenario
  Scenario: [Error case description]
    Given [initial context]
    And [condition that will cause error]
    When [user action that triggers error]
    Then [error should be handled gracefully]
    And [user should see helpful message]

  # Edge case scenario
  Scenario: [Edge case description]
    Given [unusual but valid context]
    When [user action]
    Then [system should handle correctly]

  # Data-driven scenario
  Scenario Outline: [Parameterized test description]
    Given [context with <parameter>]
    When [action with <input>]
    Then [result should be <output>]

    Examples:
      | parameter | input | output |
      | value1    | data1 | result1 |
      | value2    | data2 | result2 |

  # Tagged scenarios for specific test runs
  @smoke @critical
  Scenario: [Critical functionality]
    Given [minimal setup]
    When [core action]
    Then [core functionality works]

  @mobile
  Scenario: [Mobile-specific behavior]
    Given [mobile context]
    When [mobile interaction]
    Then [mobile-optimized result]

  @performance
  Scenario: [Performance-sensitive operation]
    Given [large dataset or complex state]
    When [potentially slow operation]
    Then [operation completes within acceptable time]
    And [system remains responsive]

  @security
  Scenario: [Security-related behavior]
    Given [security context]
    When [security-sensitive action]
    Then [appropriate security measures are enforced]

  # Rule-based scenarios (Gherkin 6+)
  Rule: [Business rule description]

    Example: [Scenario demonstrating the rule]
      Given [context where rule applies]
      When [action that triggers rule]
      Then [rule is enforced]

    Example: [Another scenario for same rule]
      Given [different context]
      When [different action]
      Then [same rule applies]