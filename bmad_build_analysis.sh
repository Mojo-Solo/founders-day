#!/bin/bash
# BMAD BUILD Phase: Analyze test expectations

echo "=== PROFILE TEST ANALYSIS ==="
echo "Checking profile-steps.ts for expected testIds..."
grep -n "getByTestId" features/step-definitions/profile-steps.ts | grep -E "(profile-field|profile-)" || true

echo -e "\n=== PROFILE MOCK ANALYSIS ==="
echo "Checking profile.html mock for available testIds..."
grep -n "data-testid" features/support/mock-pages/profile.html || true

echo -e "\n=== REGISTRATION TEST ANALYSIS ==="
echo "Checking registration-steps.ts for ticket selector..."
grep -n -A5 -B5 "I select.*ticket" features/step-definitions/frontend/registration-steps.ts || true

echo -e "\n=== REGISTRATION MOCK ANALYSIS ==="
echo "Checking registration.html for ticket elements..."
grep -n -E "(ticket|quantity)" features/support/mock-pages/registration.html || true

echo -e "\n=== ACTUAL TEST FAILURES ==="
echo "Running tests to capture exact error messages..."
npm run test:bdd -- --name "profile" 2>&1 | grep -A10 -B2 "Error\|Failed\|timeout" || true