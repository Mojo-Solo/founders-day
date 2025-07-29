# BMAD BDD Test Fix Implementation

## Quick Fix Script

```bash
#!/bin/bash
# Save as: fix-bdd-tests.sh

echo "🔧 BMAD BDD Test Fix - Starting..."

# Fix 1: Update search selector (Priority 1)
echo "📝 Fixing search test selector..."
sed -i.bak "s/\[data-testid='search-results'\]/.search-results/g" features/step-definitions/common/search-steps.ts

# Fix 2: Add flexible registration selector (Priority 2)
echo "📝 Updating registration ticket selector..."

# Create a temporary fix for registration
cat > /tmp/registration-fix.ts << 'EOF'
// Flexible ticket selection that tries multiple selector strategies
async selectTicket(ticketCount: string) {
  const selectors = [
    `[data-testid='ticket-quantity-${ticketCount}']`,
    `.ticket-quantity-${ticketCount}`,
    `[name="ticketQuantity"][value="${ticketCount}"]`,
    `input[type="number"][name*="ticket"]`
  ];
  
  for (const selector of selectors) {
    try {
      const element = await this.page.$(selector);
      if (element) {
        const tagName = await element.evaluate(el => el.tagName.toLowerCase());
        
        if (tagName === 'input') {
          await this.page.fill(selector, ticketCount);
        } else {
          await this.page.click(selector);
        }
        
        console.log(`✅ Found ticket selector: ${selector}`);
        return;
      }
    } catch (e) {
      // Try next selector
    }
  }
  
  throw new Error(`Could not find ticket quantity selector for ${ticketCount} tickets. Tried: ${selectors.join(', ')}`);
}
EOF

echo "✅ Fixes prepared. Run tests to validate."
```

## Manual Fix Steps

### 1. Fix Search Test (Immediate)

**File**: `features/step-definitions/common/search-steps.ts`  
**Line**: 39

**Change**:
```typescript
// FROM:
const resultsSelector = '[data-testid=\'search-results\']';

// TO:
const resultsSelector = '.search-results';
```

### 2. Fix Registration Test (Investigation Required)

**File**: `features/step-definitions/frontend/registration-steps.ts`  
**Line**: 83

**Add Debug First**:
```typescript
When('I select {string} individual ticket(s)', async function(ticketCount: string) {
  // Add debug logging
  console.log('🔍 Debugging ticket selection...');
  console.log('Looking for ticket quantity:', ticketCount);
  
  // Log page content for inspection
  const pageContent = await this.page.content();
  console.log('Ticket area HTML:', pageContent.match(/<[^>]*ticket[^>]*>[\s\S]*?<\/[^>]+>/gi));
  
  // Try multiple selector strategies
  const selectors = [
    `[data-testid='ticket-quantity-${ticketCount}']`,
    `.ticket-quantity-${ticketCount}`,
    `[value="${ticketCount}"]`,
    `input[name*="ticket"]`
  ];
  
  let found = false;
  for (const selector of selectors) {
    try {
      const element = await this.page.$(selector);
      if (element) {
        console.log(`✅ Found with selector: ${selector}`);
        
        // Determine interaction type
        const tagName = await element.evaluate(el => el.tagName.toLowerCase());
        const type = await element.evaluate(el => (el as HTMLInputElement).type);
        
        if (tagName === 'input' && (type === 'number' || type === 'text')) {
          await this.page.fill(selector, ticketCount);
        } else {
          await this.page.click(selector);
        }
        
        found = true;
        break;
      }
    } catch (e) {
      console.log(`❌ Selector failed: ${selector}`);
    }
  }
  
  if (!found) {
    throw new Error(`Could not find ticket quantity selector for ${ticketCount} tickets`);
  }
});
```

## Validation Commands

```bash
# Test search fix only
npm run test:bdd -- features/search-functionality.feature

# Test registration fix only  
npm run test:bdd -- features/registration.feature

# Run all tests after fixes
npm run test:bdd

# Run with debug output
DEBUG=pw:api npm run test:bdd
```

## Expected Results

### After Search Fix:
```
✅ Scenario: Basic search functionality
    ✓ Given I am on the home page
    ✓ When I search for "test event"
    ✓ Then I should see search results containing "test"
```

### After Registration Fix:
```
✅ Scenario: Successful individual registration
    ✓ Given I am on the registration page
    ✓ When I select "1" individual ticket
    ✓ And I fill in the registration form
    ✓ Then I should see a confirmation message
```

## Next Steps

1. Apply search fix first (highest confidence)
2. Run search test to validate
3. Apply registration debug code
4. Run registration test to see actual selectors
5. Update registration fix based on debug output
6. Run full test suite
7. Remove debug code after fixes confirmed