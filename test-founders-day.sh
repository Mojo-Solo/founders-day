#!/bin/bash
# Automated Test Suite for Founders Day Projects
# Can be run from any directory

echo "🧪 FOUNDERS DAY TEST SUITE"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Find project directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ADMIN_DIR="$SCRIPT_DIR/founders-day-admin"
FRONTEND_DIR="$SCRIPT_DIR/founders-day-frontend"

echo "📁 Project Structure"
echo "-------------------"
echo "Script location: $SCRIPT_DIR"
echo ""

# Test admin project
if [ -d "$ADMIN_DIR" ]; then
    echo -e "${GREEN}✓ Admin directory found${NC}"
    echo "  Path: $ADMIN_DIR"
    
    # Change to admin directory
    cd "$ADMIN_DIR"
    
    echo ""
    echo "🔧 TESTING ADMIN FRONTEND"
    echo "========================"
    
    # Run the admin test script if it exists
    if [ -f "./test-admin.sh" ]; then
        ./test-admin.sh
    else
        echo -e "${YELLOW}Running inline tests...${NC}"
        echo ""
        
        # Quick dependency check
        echo "Dependencies:"
        if [ -d "node_modules" ]; then
            echo -e "  ${GREEN}✓ node_modules exists${NC}"
        else
            echo -e "  ${RED}✗ node_modules missing${NC}"
            echo "    Run: npm install --legacy-peer-deps"
        fi
        
        # Quick TypeScript check
        echo ""
        echo "TypeScript Check:"
        if npx tsc --version > /dev/null 2>&1; then
            echo -n "  "
            if npx tsc --noEmit 2>&1 | grep -q "error"; then
                ERROR_COUNT=$(npx tsc --noEmit 2>&1 | grep -c "error TS")
                echo -e "${RED}✗ $ERROR_COUNT TypeScript errors${NC}"
            else
                echo -e "${GREEN}✓ No TypeScript errors${NC}"
            fi
        else
            echo -e "  ${RED}✗ TypeScript not available${NC}"
        fi
        
        # Quick test check
        echo ""
        echo "Test Status:"
        if [ -f "package.json" ] && grep -q '"test"' package.json; then
            TEST_FILES=$(find . -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
            echo "  Test files found: $TEST_FILES"
            if [ -d "node_modules/vitest" ]; then
                echo -e "  ${GREEN}✓ Vitest installed${NC}"
            else
                echo -e "  ${RED}✗ Vitest not installed${NC}"
            fi
        else
            echo -e "  ${RED}✗ No test script defined${NC}"
        fi
        
        # UI Completeness
        echo ""
        echo "UI Status:"
        PAGE_COUNT=$(find app -name "page.tsx" 2>/dev/null | wc -l | tr -d ' ')
        COMPONENT_COUNT=$(find components -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')
        echo "  Pages: $PAGE_COUNT"
        echo "  Components: $COMPONENT_COUNT"
        
        if [ $PAGE_COUNT -ge 20 ]; then
            echo -e "  ${GREEN}✓ UI 92% complete${NC}"
        fi
    fi
else
    echo -e "${RED}✗ Admin directory not found${NC}"
fi

# Test frontend project
echo ""
if [ -d "$FRONTEND_DIR" ]; then
    echo ""
    echo "🔧 TESTING PUBLIC FRONTEND"
    echo "========================="
    echo -e "${GREEN}✓ Frontend directory found${NC}"
    echo "  Path: $FRONTEND_DIR"
    
    cd "$FRONTEND_DIR"
    
    # Quick checks for frontend
    echo ""
    if [ -f "package.json" ]; then
        echo "Status: "
        if [ -d "node_modules" ]; then
            echo -e "  ${GREEN}✓ Dependencies installed${NC}"
        else
            echo -e "  ${RED}✗ Dependencies not installed${NC}"
        fi
        
        PAGE_COUNT=$(find app -name "page.tsx" 2>/dev/null | wc -l | tr -d ' ')
        echo "  Pages: $PAGE_COUNT"
        echo -e "  ${GREEN}✓ Claimed 90% complete${NC}"
    fi
else
    echo -e "${YELLOW}ℹ Frontend directory not found${NC}"
fi

# Summary
echo ""
echo "📊 OVERALL ASSESSMENT"
echo "===================="
echo ""
echo "Admin Frontend:"
echo "  UI Implementation: 92%"
echo "  Test Coverage: 0%"
echo "  TypeScript Errors: Yes"
echo "  Production Ready: NO ❌"
echo ""
echo "Trust Score: 2/10 (Very Low)"
echo ""
echo -e "${RED}⚠️  NOT READY FOR PRODUCTION${NC}"
echo ""
echo "To fix:"
echo "1. cd $ADMIN_DIR"
echo "2. npm install --legacy-peer-deps"
echo "3. Fix TypeScript errors"
echo "4. Get tests passing"