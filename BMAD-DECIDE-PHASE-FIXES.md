# BMAD DECIDE Phase: Fix Implementation

## Decision Summary
Implemented **Option 1**: Updated tests to match existing mock structure

## Changes Made

### 1. Profile Test Fix
**File**: `features/step-definitions/profile-steps.ts`

**Change**: Replaced generic `profile-field` testId with specific field mapping
```typescript
const fieldMapping: Record<string, string> = {
  'email': 'profile-email',
  'first name': 'profile-first-name',
  'last name': 'profile-last-name',
  'bio': 'profile-bio'
};
```

**Rationale**: 
- Matches existing mock HTML structure
- More explicit and maintainable
- Faster than changing mock HTML

### 2. Registration Test Fix
**File**: `features/step-definitions/frontend/registration-steps.ts`

**Change**: Replaced `selectOption()` with `fill()` for number input
```typescript
// Before: await page.getByTestId('ticket-quantity').selectOption(ticketCount.toString());
// After:
await page.getByTestId('ticket-quantity').fill(ticketCount.toString());
```

**Rationale**:
- Correct method for input[type="number"] elements
- Maintains same functionality
- No mock changes required

## Expected Outcomes
- Profile tests: Should now find correct elements and pass
- Registration tests: Should now interact correctly with number input
- Overall success rate: Should increase from 33% to 100%

## Risk Mitigation
- Changes are minimal and targeted
- No architectural changes required
- Easy to revert if needed

## Next Steps
- Run tests to verify 100% pass rate
- Document success metrics
- Close BMAD cycle