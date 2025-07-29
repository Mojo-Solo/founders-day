#!/bin/bash

# Quick test to verify setup
set -e

echo "🥒 Quick BDD Test Setup"
echo

# Install Playwright if needed
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
    echo "Installing Playwright browsers..."
    npx playwright install --with-deps chromium
fi

# Run a simple smoke test
echo "Running smoke tests..."
npm run test:cucumber:smoke || true

echo
echo "✅ Test setup complete!"