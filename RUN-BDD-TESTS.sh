#!/bin/bash

# Founders Day BDD Test Runner
# This script provides various options for running Cucumber BDD tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    color=$1
    message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print section headers
print_header() {
    echo
    print_color "$BLUE" "=================================================================================="
    print_color "$BLUE" "$1"
    print_color "$BLUE" "=================================================================================="
    echo
}

# Function to check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_color "$RED" "❌ Node.js is not installed"
        exit 1
    fi
    print_color "$GREEN" "✅ Node.js $(node --version)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_color "$RED" "❌ npm is not installed"
        exit 1
    fi
    print_color "$GREEN" "✅ npm $(npm --version)"
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_color "$YELLOW" "⚠️  Dependencies not installed. Installing..."
        npm ci
    else
        print_color "$GREEN" "✅ Dependencies installed"
    fi
    
    # Check if Playwright browsers are installed
    if [ ! -d "$HOME/.cache/ms-playwright" ]; then
        print_color "$YELLOW" "⚠️  Playwright browsers not installed. Installing..."
        npx playwright install --with-deps chromium
    else
        print_color "$GREEN" "✅ Playwright browsers installed"
    fi
}

# Function to build shared packages
build_packages() {
    print_header "Building Shared Packages"
    
    print_color "$YELLOW" "Building shared-types..."
    npm run build --workspace=shared-types --if-present || true
    
    print_color "$YELLOW" "Building @founders-day/test-utils..."
    npm run build --workspace=@founders-day/test-utils --if-present || true
    
    print_color "$GREEN" "✅ Packages built"
}

# Function to run tests
run_tests() {
    mode=$1
    shift
    additional_args=$@
    
    case $mode in
        "all")
            print_header "Running ALL BDD Tests"
            npm run test:cucumber $additional_args
            ;;
        "smoke")
            print_header "Running Smoke Tests Only"
            npm run test:cucumber:smoke $additional_args
            ;;
        "parallel")
            print_header "Running Tests in Parallel (4 workers)"
            npm run test:cucumber:parallel $additional_args
            ;;
        "sequential")
            print_header "Running Tests Sequentially"
            npm run test:cucumber:sequential $additional_args
            ;;
        "feature")
            feature=$2
            print_header "Running Feature: $feature"
            npx cucumber-js "features/**/*${feature}*.feature" $additional_args
            ;;
        "tag")
            tag=$1
            print_header "Running Tests with Tag: $tag"
            shift
            npx cucumber-js --tags "$tag" $@
            ;;
        "ci")
            print_header "Running Tests in CI Mode"
            npm run test:cucumber:ci $additional_args
            ;;
        "watch")
            print_header "Running Tests in Watch Mode"
            npm run test:cucumber:watch $additional_args
            ;;
        *)
            print_color "$RED" "❌ Unknown mode: $mode"
            show_usage
            exit 1
            ;;
    esac
}

# Function to generate reports
generate_reports() {
    print_header "Generating Test Reports"
    
    # Check if there are JSON reports to merge
    if ls reports/*.json 1> /dev/null 2>&1; then
        print_color "$YELLOW" "Merging test reports..."
        npm run report:merge
        
        print_color "$YELLOW" "Generating HTML report..."
        npm run report:generate
        
        print_color "$GREEN" "✅ Reports generated at reports/final-report.html"
        
        # Open report if not in CI
        if [ -z "$CI" ]; then
            if command -v open &> /dev/null; then
                open reports/final-report.html
            elif command -v xdg-open &> /dev/null; then
                xdg-open reports/final-report.html
            fi
        fi
    else
        print_color "$YELLOW" "⚠️  No test reports found to merge"
    fi
}

# Function to clean reports
clean_reports() {
    print_header "Cleaning Previous Reports"
    rm -rf reports/
    mkdir -p reports/
    print_color "$GREEN" "✅ Reports directory cleaned"
}

# Function to show usage
show_usage() {
    cat << EOF

Usage: $0 [command] [options]

Commands:
    all         Run all BDD tests
    smoke       Run smoke tests only (fast, high-priority tests)
    parallel    Run tests in parallel (4 workers)
    sequential  Run tests sequentially (for debugging)
    feature     Run specific feature (e.g., feature registration)
    tag         Run tests with specific tag (e.g., tag @profile)
    ci          Run tests in CI mode with full reporting
    watch       Run tests in watch mode for development
    report      Generate test reports from existing results
    clean       Clean previous test reports
    help        Show this help message

Options:
    --headed    Run with browser visible
    --debug     Run with debug logging
    --fail-fast Stop on first failure
    --dry-run   Show what would be run without executing

Environment Variables:
    HEADLESS=false     Show browser (same as --headed)
    PARALLEL_WORKERS=N Use N parallel workers
    BASE_URL=url       Override base URL for tests

Examples:
    # Run all smoke tests
    $0 smoke

    # Run specific feature with browser visible
    $0 feature profile --headed

    # Run tests with specific tag in parallel
    $0 tag @registration

    # Run in CI mode
    $0 ci

    # Debug a specific scenario
    HEADLESS=false $0 sequential --name "User registers successfully"

EOF
}

# Main script logic
main() {
    # Default to help if no arguments
    if [ $# -eq 0 ]; then
        show_usage
        exit 0
    fi
    
    command=$1
    shift
    
    case $command in
        "help"|"-h"|"--help")
            show_usage
            exit 0
            ;;
        "clean")
            clean_reports
            exit 0
            ;;
        "report")
            generate_reports
            exit 0
            ;;
        *)
            # Check prerequisites
            check_prerequisites
            
            # Build packages
            build_packages
            
            # Clean old reports
            clean_reports
            
            # Run tests
            run_tests $command $@
            
            # Generate reports
            generate_reports
            
            # Show summary
            print_header "Test Execution Complete"
            
            if [ -f "reports/cucumber-report.json" ]; then
                # Parse and show summary (requires jq)
                if command -v jq &> /dev/null; then
                    scenarios=$(jq '[.[] | .elements[]] | length' reports/cucumber-report.json 2>/dev/null || echo "?")
                    print_color "$GREEN" "✅ Executed $scenarios scenarios"
                fi
            fi
            
            print_color "$BLUE" "📊 View detailed report: reports/final-report.html"
            ;;
    esac
}

# Handle script arguments for environment variables
for arg in "$@"; do
    case $arg in
        --headed)
            export HEADLESS=false
            ;;
        --debug)
            export DEBUG=true
            ;;
        --fail-fast)
            export FAIL_FAST=true
            ;;
        --dry-run)
            export DRY_RUN=true
            ;;
    esac
done

# Run main function
main "$@"