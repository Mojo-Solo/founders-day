# BMAD Analysis: BDD Test Failures

**Date**: 2025-07-27  
**Phase**: Analyze  
**Project**: BDD Test Infrastructure  

## Executive Summary

Two critical BDD test failures are blocking the test suite:
1. Registration test cannot find ticket quantity selector
2. Search test cannot find visible search results element

Both failures indicate misalignment between test expectations and actual frontend implementation.

## Root Cause Analysis

### 1. Registration Test Failure

**Error**: "Could not find ticket quantity selector for 1 tickets"  
**Location**: `features/step-definitions/frontend/registration-steps.ts:83`  

**Root Cause**:
- Test expects selector: `[data-testid='ticket-quantity-1']`
- Frontend likely uses a different selector pattern or structure
- Possible causes:
  - Frontend uses class-based selectors instead of data-testid
  - Ticket quantity might be an input field, not a clickable element
  - The number "1" might not be part of the selector

**Evidence**:
```typescript
// Current failing code
const ticketSelector = `[data-testid='ticket-quantity-${ticketCount}']`;
await this.page.click(ticketSelector);
```

### 2. Search Test Failure

**Error**: "Element [data-testid='search-results'] not found"  
**Location**: `features/step-definitions/common/search-steps.ts:39`  

**Root Cause**:
- Element exists in DOM but lacks the expected data-testid attribute
- Actual HTML: `<div class="search-results"></div>`
- Test expects: `[data-testid='search-results']`
- This is a simple selector mismatch

**Evidence**:
```typescript
// Current failing code
const resultsSelector = '[data-testid=\'search-results\']';
await this.page.waitForSelector(resultsSelector, { visible: true });
```

## Fix Recommendations

### Priority 1: Search Test Fix (Quick Win)
**Why First**: Simplest fix with immediate impact

**Changes Needed**:
```typescript
// In features/step-definitions/common/search-steps.ts
// Change from:
const resultsSelector = '[data-testid=\'search-results\']';
// To:
const resultsSelector = '.search-results';
```

**Validation**:
1. Run search feature test in isolation
2. Verify element is found and visible
3. Check search results display correctly

### Priority 2: Registration Test Fix
**Why Second**: Requires investigation of actual frontend structure

**Investigation Steps**:
1. Inspect the actual registration page HTML
2. Identify how ticket quantity is implemented
3. Update selector accordingly

**Potential Solutions**:
```typescript
// Option A: If it's an input field
await this.page.fill('[name="ticketQuantity"]', ticketCount);

// Option B: If it's a select dropdown
await this.page.selectOption('[name="ticketType"]', { label: `${ticketCount} Individual Ticket${ticketCount > 1 ? 's' : ''}` });

// Option C: If it uses class selectors
const ticketSelector = `.ticket-quantity-${ticketCount}`;
```

## Implementation Plan

### Phase 1: Immediate Actions (5 minutes)
1. Fix search test selector
2. Run search test to validate
3. Commit fix if successful

### Phase 2: Registration Investigation (15 minutes)
1. Add debug logging to registration step
2. Capture actual page HTML during test
3. Identify correct selectors
4. Implement and test fix

### Phase 3: Validation (10 minutes)
1. Run full BDD test suite
2. Verify both fixes work in parallel execution
3. Update any related tests with similar patterns

## Success Metrics
- ✅ Search test passes consistently
- ✅ Registration test completes ticket selection
- ✅ No regression in other tests
- ✅ Tests run successfully in Docker environment

## Risk Mitigation
- **Risk**: Frontend changes break tests again
- **Mitigation**: Add selector validation helper that provides better error messages
- **Long-term**: Establish contract with frontend team for stable test selectors