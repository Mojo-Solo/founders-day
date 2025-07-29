#!/bin/bash

echo "🧪 Running BDD Tests with Mocked Pages..."
echo "========================================="

START_SERVERS=false CUCUMBER_PROFILE=smoke npm run test:cucumber:smoke 2>&1 | tee test-output.log

echo ""
echo "📊 Test Summary:"
echo "----------------"
grep -E "(scenarios|steps)" test-output.log | tail -2

echo ""
echo "✅ Passing Scenarios:"
grep -B2 "✔ After" test-output.log | grep "Scenario:" | sort | uniq

echo ""
echo "❌ Failing Scenarios:"
grep -A5 "Failures:" test-output.log | grep "Scenario:" | head -5

echo ""
echo "🎯 Current Progress:"
if grep -q "6 scenarios.*2 passed" test-output.log; then
  echo "33% tests passing (2/6 scenarios)"
elif grep -q "6 scenarios.*4 passed" test-output.log; then
  echo "67% tests passing (4/6 scenarios)"
elif grep -q "6 scenarios.*6 passed" test-output.log; then
  echo "100% tests passing! 🎉"
else
  echo "Check test-output.log for details"
fi

rm -f test-output.log