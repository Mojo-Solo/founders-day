#!/bin/bash

# Quick one-liner to run all BDD tests with best defaults
# This is the simplest way to run everything

set -e

echo "🥒 Running Founders Day BDD Tests..."
echo

# Run the main test script with optimal settings
./RUN-BDD-TESTS.sh parallel

# Exit code from the test run
exit $?