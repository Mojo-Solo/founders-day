#!/usr/bin/env python3
"""BMAD BUILD Phase: Analyze current BDD test state"""

import os
import json
import subprocess
import sys
from pathlib import Path

# Change to project directory
os.chdir('/Users/david/Documents/root/founders-day')

print("=== BMAD BUILD PHASE: ANALYZING CURRENT STATE ===\n")

# 1. Check feature files
print("1. FEATURE FILES:")
feature_files = list(Path('features').glob('**/*.feature'))
for f in sorted(feature_files):
    if not any(part.startswith('.') for part in f.parts):
        print(f"   - {f}")

# 2. Check if servers are running
print("\n2. SERVER STATUS:")
def check_port(port):
    result = subprocess.run(['lsof', '-i', f':{port}'], capture_output=True)
    return result.returncode == 0

frontend_running = check_port(5173)
backend_running = check_port(5000)
admin_running = check_port(5174)

print(f"   - Frontend (5173): {'RUNNING' if frontend_running else 'NOT RUNNING'}")
print(f"   - Backend (5000): {'RUNNING' if backend_running else 'NOT RUNNING'}")
print(f"   - Admin (5174): {'RUNNING' if admin_running else 'NOT RUNNING'}")

# 3. Check test configuration
print("\n3. TEST CONFIGURATION:")
if os.path.exists('cucumber.js'):
    print("   - cucumber.js: EXISTS")
    with open('cucumber.js', 'r') as f:
        print("   - Config preview:")
        for i, line in enumerate(f):
            if i < 10:
                print(f"     {line.rstrip()}")

# 4. Run a quick test to see actual failures
print("\n4. RUNNING QUICK TEST TO IDENTIFY FAILURES:")
print("   Executing: npm run test:bdd -- features/navigation.feature")

result = subprocess.run(
    ['npm', 'run', 'test:bdd', '--', 'features/navigation.feature'],
    capture_output=True,
    text=True
)

print(f"\n   Exit Code: {result.returncode}")
print("\n   --- OUTPUT ---")
print(result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout)

if result.stderr:
    print("\n   --- ERRORS ---")
    print(result.stderr[-1000:] if len(result.stderr) > 1000 else result.stderr)

# 5. Check for common issues
print("\n5. COMMON ISSUES CHECK:")

# Check if login route exists
login_route_files = [
    'founders-day-frontend/src/pages/Login.tsx',
    'founders-day-frontend/src/pages/login.tsx',
    'founders-day-frontend/src/components/Login.tsx',
    'founders-day-frontend/src/routes/login.tsx'
]

login_found = False
for file in login_route_files:
    if os.path.exists(file):
        print(f"   ✓ Login component found: {file}")
        login_found = True
        break

if not login_found:
    print("   ✗ Login component NOT FOUND - this explains ERR_EMPTY_RESPONSE")

# Check router configuration
router_files = [
    'founders-day-frontend/src/App.tsx',
    'founders-day-frontend/src/main.tsx',
    'founders-day-frontend/src/router.tsx'
]

print("\n   Router files:")
for file in router_files:
    if os.path.exists(file):
        print(f"   - {file}: EXISTS")

print("\n=== ANALYSIS COMPLETE ===")