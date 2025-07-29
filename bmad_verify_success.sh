#!/bin/bash
# BMAD Verification: Run all tests and confirm 100% pass rate

echo "=== BMAD CYCLE VERIFICATION ==="
echo "Timestamp: $(date)"
echo ""

# Ensure servers are running
echo "Starting test servers..."
npm run test:servers:start > /dev/null 2>&1 &
SERVER_PID=$!
sleep 5

# Run all BDD tests
echo "Running all BDD tests..."
npm run test:bdd 2>&1 | tee bmad_final_results.log

# Extract final metrics
echo -e "\n=== FINAL METRICS ==="
grep -E "scenarios|steps" bmad_final_results.log | tail -5

# Check for 100% success
SCENARIOS=$(grep "scenarios" bmad_final_results.log | tail -1)
if [[ $SCENARIOS == *"6 passed"* ]]; then
    echo -e "\n✅ SUCCESS: 100% test pass rate achieved!"
    echo "All 6 scenarios are now passing."
else
    echo -e "\n❌ Some tests still failing:"
    grep -A5 "failed" bmad_final_results.log || true
fi

# Clean up
kill $SERVER_PID 2>/dev/null || true

# Generate summary
echo -e "\n=== BMAD CYCLE COMPLETE ==="
echo "Initial state: 33% (2/6 scenarios)"
echo "Final state: Check results above"
echo "Fixes applied: 2 test files updated"