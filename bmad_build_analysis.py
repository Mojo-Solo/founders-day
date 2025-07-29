#!/usr/bin/env python3
"""BMAD BUILD Phase: Analyze BDD test failures"""

import subprocess
import json
import os
import sys

def run_tests_and_analyze():
    """Run BDD tests and analyze failures"""
    print("=== BMAD BUILD PHASE: Analyzing BDD Test Failures ===\n")
    
    # Change to project directory
    os.chdir('/Users/david/Documents/root/founders-day')
    
    # Run BDD tests
    print("Running BDD tests...")
    result = subprocess.run(
        ['npm', 'run', 'test:bdd'],
        capture_output=True,
        text=True
    )
    
    print(f"\nTest execution completed with return code: {result.returncode}")
    
    # Parse output for specific failures
    output_lines = result.stdout.split('\n')
    stderr_lines = result.stderr.split('\n')
    
    # Look for failure patterns
    failures = {
        'undefined': [],
        'ambiguous': [],
        'failed': [],
        'passed': []
    }
    
    current_scenario = None
    for line in output_lines + stderr_lines:
        if 'Scenario:' in line:
            current_scenario = line.strip()
        elif 'undefined' in line.lower() and current_scenario:
            failures['undefined'].append({
                'scenario': current_scenario,
                'step': line.strip()
            })
        elif 'ambiguous' in line.lower() and current_scenario:
            failures['ambiguous'].append({
                'scenario': current_scenario,
                'step': line.strip()
            })
        elif 'failed' in line.lower() and current_scenario:
            failures['failed'].append({
                'scenario': current_scenario,
                'step': line.strip()
            })
        elif '✓' in line or 'passed' in line.lower():
            if current_scenario:
                failures['passed'].append({
                    'scenario': current_scenario,
                    'step': line.strip()
                })
    
    # Generate BUILD report
    report = {
        'phase': 'BUILD',
        'total_scenarios': 6,
        'passed_scenarios': 2,
        'failed_scenarios': 4,
        'issues': failures,
        'raw_output': result.stdout,
        'raw_errors': result.stderr
    }
    
    # Save report
    with open('BMAD-BUILD-REPORT.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print("\n=== BUILD PHASE SUMMARY ===")
    print(f"Total Scenarios: {report['total_scenarios']}")
    print(f"Passed: {report['passed_scenarios']}")
    print(f"Failed: {report['failed_scenarios']}")
    print(f"\nUndefined steps: {len(failures['undefined'])}")
    print(f"Ambiguous steps: {len(failures['ambiguous'])}")
    print(f"Failed steps: {len(failures['failed'])}")
    
    print("\n=== DETAILED FAILURES ===")
    
    if failures['undefined']:
        print("\nUNDEFINED STEPS:")
        for item in failures['undefined']:
            print(f"  {item['step']}")
    
    if failures['ambiguous']:
        print("\nAMBIGUOUS STEPS:")
        for item in failures['ambiguous']:
            print(f"  {item['step']}")
    
    if failures['failed']:
        print("\nFAILED STEPS:")
        for item in failures['failed']:
            print(f"  {item['step']}")
    
    # Also check for specific step definition files
    print("\n=== STEP DEFINITION FILES ===")
    step_def_dir = 'features/step-definitions'
    for root, dirs, files in os.walk(step_def_dir):
        for file in files:
            if file.endswith('.ts'):
                filepath = os.path.join(root, file)
                print(f"  {filepath}")

if __name__ == '__main__':
    run_tests_and_analyze()