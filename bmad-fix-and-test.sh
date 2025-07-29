#!/bin/bash

# BMAD DECIDE Phase: Fix and Test Until 100% Success

echo "=== BMAD DECIDE PHASE: IMPLEMENTING FIXES ==="
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create reports directory
mkdir -p reports/screenshots

# Function to run a specific test
run_test() {
    local feature=$1
    local name=$2
    echo -e "${YELLOW}Testing: $name${NC}"
    
    # Run the test
    npm run test:bdd -- "$feature" --format progress --publish-quiet > "reports/${name}-output.log" 2>&1
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "Error details:"
        tail -n 20 "reports/${name}-output.log" | grep -E "(Error:|Failed:|expected|actual)" | sed 's/^/  /'
        return 1
    fi
}

# Track results
total=0
passed=0

echo "1. Running Navigation Tests..."
if run_test "features/navigation.feature" "navigation"; then
    ((passed++))
fi
((total++))
echo

echo "2. Running Profile Management Tests..."
if run_test "features/profile-management.feature" "profile"; then
    ((passed++))
fi
((total++))
echo

echo "3. Running Registration Tests..."
if run_test "features/registration.feature" "registration"; then
    ((passed++))
fi
((total++))
echo

# Calculate final metrics
success_rate=$((passed * 100 / total))

# Display summary
echo "=== FINAL RESULTS ==="
echo -e "Total Features: $total"
echo -e "Passed: ${GREEN}$passed${NC}"
echo -e "Failed: ${RED}$((total - passed))${NC}"
echo -e "Success Rate: ${success_rate}%"
echo

# Generate BMAD decision report
cat > reports/bmad-decision-report.json <<EOF
{
  "phase": "DECIDE",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "results": {
    "total_features": $total,
    "passed": $passed,
    "failed": $((total - passed)),
    "success_rate": $success_rate
  },
  "target_achieved": $([ $success_rate -eq 100 ] && echo "true" || echo "false"),
  "features": {
    "navigation": $(grep -q "passed" reports/navigation-output.log && echo "true" || echo "false"),
    "profile": $(grep -q "passed" reports/profile-output.log && echo "true" || echo "false"),
    "registration": $(grep -q "passed" reports/registration-output.log && echo "true" || echo "false")
  }
}
EOF

# Check if we achieved 100% success
if [ $success_rate -eq 100 ]; then
    echo -e "${GREEN}🎉 SUCCESS! All BDD tests are now passing at 100%!${NC}"
    echo "BMAD cycle completed successfully."
else
    echo -e "${RED}⚠️  Target not achieved. Success rate: ${success_rate}%${NC}"
    echo "Further fixes required to reach 100% success."
    echo
    echo "Next steps:"
    echo "1. Review error logs in reports/ directory"
    echo "2. Fix failing test implementations"
    echo "3. Re-run this script until 100% success"
fi

echo
echo "Full test outputs saved in reports/ directory"