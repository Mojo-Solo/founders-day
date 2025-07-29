#!/bin/bash

echo "=== BMAD BUILD PHASE: Current BDD Test State ==="
echo

# Run tests and capture output
echo "Running BDD tests..."
npm run test:bdd 2>&1 | tee test_output.log

echo
echo "=== Analyzing test output ==="

# Count results
echo
echo "Test Summary:"
grep -E "(Scenario:|✓|✗|undefined|ambiguous)" test_output.log

echo
echo "=== Checking Step Definition Files ==="
find features/step-definitions -name "*.ts" -type f | while read file; do
    echo "File: $file"
    echo "  Steps defined: $(grep -c "@(Given\|When\|Then)" "$file" 2>/dev/null || echo "0")"
done

echo
echo "=== Checking for Missing Steps ==="
grep -A2 -B2 "undefined" test_output.log || echo "No undefined steps found"

echo
echo "=== Checking for Ambiguous Steps ==="
grep -A2 -B2 "ambiguous" test_output.log || echo "No ambiguous steps found"