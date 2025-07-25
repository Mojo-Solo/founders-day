#!/bin/bash
# Automated Test Suite for Founders Day Projects
# Created: January 21, 2025
# Purpose: Programmatic verification of project status

set -e

echo "🧪 FOUNDERS DAY AUTOMATED TEST SUITE"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results file
RESULTS_DIR="test-results"
mkdir -p $RESULTS_DIR

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $1 is installed${NC}"
        return 0
    fi
}

# Function to run tests and capture results
run_test() {
    local test_name=$1
    local test_command=$2
    local output_file="$RESULTS_DIR/$test_name.log"
    
    echo -n "Running $test_name... "
    if $test_command > "$output_file" 2>&1; then
        echo -e "${GREEN}PASSED${NC}"
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        echo "  See $output_file for details"
        return 1
    fi
}

# Start testing
echo "1️⃣ CHECKING DEPENDENCIES"
echo "------------------------"
check_command "node"
check_command "npm"
check_command "npx"
echo ""

echo "2️⃣ INSTALLING DEPENDENCIES"
echo "--------------------------"
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --legacy-peer-deps
else
    echo "Dependencies already installed"
fi
echo ""

echo "3️⃣ TYPE CHECKING"
echo "----------------"
run_test "typescript" "npx tsc --noEmit"
echo ""

echo "4️⃣ LINTING"
echo "-----------"
run_test "eslint" "npm run lint"
echo ""

echo "5️⃣ UNIT TESTS"
echo "--------------"
run_test "vitest" "npm test -- --run --reporter=json"
UNIT_TESTS_PASSED=$?
echo ""

echo "6️⃣ TEST COVERAGE"
echo "-----------------"
if [ $UNIT_TESTS_PASSED -eq 0 ]; then
    run_test "coverage" "npm run test:coverage"
else
    echo -e "${YELLOW}⚠️  Skipping coverage (tests not passing)${NC}"
fi
echo ""

echo "7️⃣ E2E TESTS"
echo "-------------"
# Check if server is running
if curl -s http://localhost:3001/api/health > /dev/null; then
    run_test "playwright" "npm run test:playwright"
else
    echo -e "${YELLOW}⚠️  Dev server not running on port 3001${NC}"
    echo "  Start with: npm run dev"
fi
echo ""

echo "8️⃣ BUILD TEST"
echo "--------------"
run_test "build" "npm run build"
echo ""

echo "9️⃣ SECURITY AUDIT"
echo "------------------"
npm audit --json > "$RESULTS_DIR/security-audit.json" 2>&1
VULNS=$(cat "$RESULTS_DIR/security-audit.json" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
if [ "$VULNS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $VULNS vulnerabilities${NC}"
else
    echo -e "${GREEN}✅ No vulnerabilities found${NC}"
fi
echo ""

echo "🔟 BUNDLE SIZE ANALYSIS"
echo "-----------------------"
if [ -f ".next/build-manifest.json" ]; then
    echo "Analyzing bundle sizes..."
    node -e "
    const manifest = require('./.next/build-manifest.json');
    const pages = Object.keys(manifest.pages);
    console.log('Pages found:', pages.length);
    console.log('Top 5 pages:');
    pages.slice(0, 5).forEach(page => console.log('  -', page));
    "
else
    echo -e "${YELLOW}⚠️  No build output found${NC}"
fi
echo ""

echo "📊 FINAL REPORT"
echo "==============="
echo ""

# Count results
TOTAL_TESTS=0
PASSED_TESTS=0

for result in $RESULTS_DIR/*.log; do
    if [ -f "$result" ]; then
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
        if ! grep -q "error\|fail\|Error\|Failed" "$result" 2>/dev/null; then
            PASSED_TESTS=$((PASSED_TESTS + 1))
        fi
    fi
done

# Calculate percentage
if [ $TOTAL_TESTS -gt 0 ]; then
    PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
else
    PERCENTAGE=0
fi

echo "Tests Run: $TOTAL_TESTS"
echo "Tests Passed: $PASSED_TESTS"
echo "Success Rate: $PERCENTAGE%"
echo ""

# Trust score
if [ $PERCENTAGE -ge 80 ]; then
    TRUST="HIGH (8-10/10)"
    COLOR=$GREEN
elif [ $PERCENTAGE -ge 50 ]; then
    TRUST="MEDIUM (5-7/10)"
    COLOR=$YELLOW
else
    TRUST="LOW (0-4/10)"
    COLOR=$RED
fi

echo -e "Trust Score: ${COLOR}$TRUST${NC}"
echo ""

# Recommendations
echo "📝 RECOMMENDATIONS"
echo "------------------"
if [ $PERCENTAGE -lt 100 ]; then
    echo "1. Fix failing tests before deployment"
    echo "2. Achieve at least 70% test coverage"
    echo "3. Resolve all security vulnerabilities"
    echo "4. Run visual regression tests"
    echo "5. Perform accessibility audit"
else
    echo "✅ All tests passing! Ready for deployment review."
fi

echo ""
echo "Test results saved in: $RESULTS_DIR/"
echo ""
echo "Run this script anytime with: ./test-all.sh"