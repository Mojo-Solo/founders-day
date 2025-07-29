#!/bin/bash
# BMAD MEASURE Phase: Capture exact failure metrics

echo "=== BMAD MEASURE PHASE ==="
echo "Timestamp: $(date)"
echo ""

# Run tests and capture output
echo "Running all BDD tests to measure failure points..."
npm run test:bdd 2>&1 > test_output.log

# Extract metrics
echo "=== TEST METRICS ==="
grep -E "scenarios|steps" test_output.log | tail -5

echo -e "\n=== FAILURE DETAILS ==="
# Extract specific failures
grep -A10 "✖ failed" test_output.log | grep -E "(Error:|Timeout:|Expected|Received|profile-field|ticket-quantity)" || true

echo -e "\n=== EXACT ERROR MESSAGES ==="
# Get the actual error messages
grep -A5 "Error:" test_output.log || true

echo -e "\n=== TIMEOUT ANALYSIS ==="
grep -B2 -A2 "timeout" test_output.log || true

# Summary
echo -e "\n=== FAILURE SUMMARY ==="
echo "Profile Test Issues:"
grep -c "profile-field" test_output.log || echo "0"
echo "Registration Test Issues:"  
grep -c "ticket-quantity" test_output.log || echo "0"

# Save detailed log
cp test_output.log bmad_measure_output.log