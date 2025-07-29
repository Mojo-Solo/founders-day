#!/bin/bash

# BMAD MEASURE Phase: Run all tests and collect metrics

echo "=== BMAD MEASURE PHASE ==="
echo "Collecting test metrics..."
echo

# Create reports directory
mkdir -p reports

# Function to run a test and capture results
run_test() {
    local feature=$1
    local name=$2
    echo "Testing: $name"
    echo "-------------------"
    
    # Run the test and capture exit code
    npm run test:bdd -- "$feature" --format json:reports/${name}-result.json > reports/${name}-output.log 2>&1
    local exit_code=$?
    
    # Show summary
    if [ $exit_code -eq 0 ]; then
        echo "✅ PASSED"
    else
        echo "❌ FAILED (exit code: $exit_code)"
        # Show last few lines of error
        echo "Error details:"
        tail -n 10 reports/${name}-output.log | sed 's/^/  /'
    fi
    echo
    
    return $exit_code
}

# Track overall results
total_tests=0
passed_tests=0

# Run each feature test
echo "1. NAVIGATION TEST"
if run_test "features/navigation.feature" "navigation"; then
    ((passed_tests++))
fi
((total_tests++))

echo "2. PROFILE MANAGEMENT TEST"
if run_test "features/profile-management.feature" "profile"; then
    ((passed_tests++))
fi
((total_tests++))

echo "3. REGISTRATION TEST"
if run_test "features/registration.feature" "registration"; then
    ((passed_tests++))
fi
((total_tests++))

# Calculate metrics
success_rate=$((passed_tests * 100 / total_tests))

# Generate metrics report
cat > reports/bmad-metrics.json <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "total_tests": $total_tests,
  "passed_tests": $passed_tests,
  "failed_tests": $((total_tests - passed_tests)),
  "success_rate": $success_rate,
  "details": {
    "navigation": $([ -f reports/navigation-result.json ] && echo "true" || echo "false"),
    "profile": $([ -f reports/profile-result.json ] && echo "true" || echo "false"),
    "registration": $([ -f reports/registration-result.json ] && echo "true" || echo "false")
  }
}
EOF

echo "=== METRICS SUMMARY ==="
echo "Total Tests: $total_tests"
echo "Passed: $passed_tests"
echo "Failed: $((total_tests - passed_tests))"
echo "Success Rate: ${success_rate}%"
echo
echo "Detailed reports saved in reports/"
echo "Metrics saved to reports/bmad-metrics.json"