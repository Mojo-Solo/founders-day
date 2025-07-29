#!/usr/bin/env python3
"""Verify BMAD fixes achieved 100% pass rate"""

import subprocess
import time
import sys

print("=== BMAD VERIFICATION ===")
print(f"Starting verification at {time.strftime('%Y-%m-%d %H:%M:%S')}")

# Start servers
print("\nStarting test servers...")
server_proc = subprocess.Popen(['npm', 'run', 'test:servers:start'], 
                              stdout=subprocess.PIPE, 
                              stderr=subprocess.PIPE)
time.sleep(5)  # Wait for servers to start

try:
    # Run tests
    print("\nRunning BDD tests...")
    result = subprocess.run(['npm', 'run', 'test:bdd'], 
                           capture_output=True, text=True)
    
    print("\n=== TEST OUTPUT ===")
    print(result.stdout)
    
    # Parse results
    output = result.stdout
    if "6 scenarios (6 passed)" in output:
        print("\n✅ SUCCESS! All 6 scenarios passed!")
        print("BMAD cycle successfully achieved 100% pass rate")
        
        # Extract timing
        if "steps" in output:
            steps_line = [l for l in output.split('\n') if 'steps' in l][-1]
            print(f"\nExecution details: {steps_line}")
    else:
        print("\n❌ Some tests are still failing")
        # Find failing scenarios
        for line in output.split('\n'):
            if 'failed' in line or 'Error' in line:
                print(f"  - {line}")
                
finally:
    # Clean up
    server_proc.terminate()
    time.sleep(1)
    
print("\n=== BMAD CYCLE SUMMARY ===")
print("Initial state: 33% (2/6 scenarios)")
print("Target state: 100% (6/6 scenarios)")
print("Changes made:")
print("  1. Updated profile-steps.ts to use specific testIds")
print("  2. Updated registration-steps.ts to use fill() instead of selectOption()")
print("\nCheck output above for final results.")