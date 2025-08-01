#!/bin/bash

echo "=== FOUNDERS DAY SQUARE PAYMENT INTEGRATION ANALYSIS ==="
echo

# Check current directory
echo "Current directory: $(pwd)"
echo

# Check if package.json exists
if [ -f "package.json" ]; then
    echo "=== PACKAGE.JSON ANALYSIS ==="
    echo "Project name: $(cat package.json | grep '"name"' | cut -d'"' -f4)"
    echo "Version: $(cat package.json | grep '"version"' | cut -d'"' -f4)"
    echo
    
    echo "=== PAYMENT-RELATED DEPENDENCIES ==="
    cat package.json | grep -E "(square|payment|stripe|checkout|axios|react-hook-form)" | head -10
    echo
fi

# List main directories
echo "=== MAIN DIRECTORIES ==="
ls -la | grep ^d | grep -v node_modules | awk '{print "📁 " $9 "/"}'
echo

# Find payment-related files
echo "=== PAYMENT-RELATED FILES ==="
find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v node_modules | grep -iE "(square|payment|checkout|billing|order)" | head -20
echo

# Look for API routes
echo "=== API ROUTES ==="
find . -path "*/api/*" -name "*.ts" -o -path "*/api/*" -name "*.js" | grep -v node_modules | head -10
echo

# Look for components
echo "=== COMPONENT FILES (Sample) ==="
find . -path "*/components/*" -name "*.tsx" -o -path "*/components/*" -name "*.jsx" | grep -v node_modules | head -10
echo

echo "Analysis complete!"