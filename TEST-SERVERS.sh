#!/bin/bash

# Test if servers can be started and are accessible

echo "🧪 Testing server startup..."

# Set environment for testing
export DEBUG=true
export HEADLESS=true

# Run a single test scenario to verify server startup
npx cucumber-js features/auth.feature --name "User registration with email" --exit

echo "✅ Server test complete"