#!/usr/bin/env python3
"""BMAD BUILD Phase: Detailed analysis of BDD test state"""

import os
import re
import subprocess
import json
from collections import defaultdict

def extract_feature_steps():
    """Extract all steps from feature files"""
    features = {}
    
    for root, dirs, files in os.walk('features'):
        for file in files:
            if file.endswith('.feature'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r') as f:
                    content = f.read()
                    
                feature_name = re.search(r'Feature: (.+)', content)
                if feature_name:
                    feature_name = feature_name.group(1)
                    features[filepath] = {
                        'name': feature_name,
                        'scenarios': []
                    }
                    
                    # Extract scenarios and their steps
                    scenario_blocks = re.split(r'(?=Scenario:)', content)[1:]
                    for block in scenario_blocks:
                        scenario_match = re.match(r'Scenario: (.+)', block)
                        if scenario_match:
                            scenario_name = scenario_match.group(1)
                            steps = re.findall(r'(Given|When|Then|And) (.+)', block)
                            
                            features[filepath]['scenarios'].append({
                                'name': scenario_name,
                                'steps': [(step_type, step_text.strip()) for step_type, step_text in steps]
                            })
    
    return features

def extract_step_definitions():
    """Extract all step definitions from .ts files"""
    step_defs = defaultdict(list)
    
    for root, dirs, files in os.walk('features/step-definitions'):
        for file in files:
            if file.endswith('.ts'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r') as f:
                    content = f.read()
                    
                    # Extract step definitions with their patterns
                    # Handle both @Given, @When, @Then and Given, When, Then
                    patterns = [
                        r'@(Given|When|Then)\(([\'"`])(.*?)\2',
                        r'(Given|When|Then)\(([\'"`])(.*?)\2'
                    ]
                    
                    for pattern in patterns:
                        matches = re.findall(pattern, content, re.DOTALL)
                        for match in matches:
                            step_type = match[0]
                            step_pattern = match[2].strip()
                            # Remove regex markers if present
                            step_pattern = step_pattern.strip('/^$')
                            step_defs[filepath].append({
                                'type': step_type,
                                'pattern': step_pattern,
                                'regex': '/' in match[1] or match[1] == '`'
                            })
    
    return step_defs

def run_tests_for_output():
    """Run tests and capture detailed output"""
    result = subprocess.run(
        ['npm', 'run', 'test:bdd'],
        capture_output=True,
        text=True,
        cwd=os.getcwd()
    )
    return result.stdout, result.stderr

def analyze_test_output(stdout, stderr):
    """Analyze test output for failures"""
    issues = {
        'undefined': [],
        'ambiguous': [],
        'failed': [],
        'passed': []
    }
    
    # Parse the output
    lines = (stdout + '\n' + stderr).split('\n')
    
    current_feature = None
    current_scenario = None
    
    for i, line in enumerate(lines):
        if 'Feature:' in line:
            current_feature = line.strip()
        elif 'Scenario:' in line:
            current_scenario = line.strip()
        elif 'undefined' in line.lower():
            # Look for the actual undefined step
            if i > 0:
                prev_line = lines[i-1].strip()
                if prev_line and (prev_line.startswith('Given') or 
                                prev_line.startswith('When') or 
                                prev_line.startswith('Then') or
                                prev_line.startswith('And')):
                    issues['undefined'].append({
                        'feature': current_feature,
                        'scenario': current_scenario,
                        'step': prev_line,
                        'message': line
                    })
        elif 'ambiguous' in line.lower():
            if i > 0:
                prev_line = lines[i-1].strip()
                if prev_line and (prev_line.startswith('Given') or 
                                prev_line.startswith('When') or 
                                prev_line.startswith('Then') or
                                prev_line.startswith('And')):
                    issues['ambiguous'].append({
                        'feature': current_feature,
                        'scenario': current_scenario,
                        'step': prev_line,
                        'message': line
                    })
        elif '✗' in line or 'failed' in line.lower():
            if current_scenario and 'step' in line.lower():
                issues['failed'].append({
                    'feature': current_feature,
                    'scenario': current_scenario,
                    'message': line
                })
        elif '✓' in line:
            if current_scenario:
                issues['passed'].append({
                    'feature': current_feature,
                    'scenario': current_scenario,
                    'step': line
                })
    
    return issues

def generate_build_report():
    """Generate comprehensive BUILD phase report"""
    print("=== BMAD BUILD PHASE: Comprehensive Analysis ===\n")
    
    # Extract all data
    features = extract_feature_steps()
    step_defs = extract_step_definitions()
    stdout, stderr = run_tests_for_output()
    issues = analyze_test_output(stdout, stderr)
    
    # Generate report
    report = {
        'phase': 'BUILD',
        'features': features,
        'step_definitions': step_defs,
        'test_issues': issues,
        'analysis': {
            'total_features': len(features),
            'total_scenarios': sum(len(f['scenarios']) for f in features.values()),
            'total_steps': sum(len(s['steps']) for f in features.values() for s in f['scenarios']),
            'total_step_definitions': sum(len(defs) for defs in step_defs.values()),
            'undefined_steps': len(issues['undefined']),
            'ambiguous_steps': len(issues['ambiguous']),
            'failed_steps': len(issues['failed'])
        }
    }
    
    # Print summary
    print(f"Total Features: {report['analysis']['total_features']}")
    print(f"Total Scenarios: {report['analysis']['total_scenarios']}")
    print(f"Total Steps: {report['analysis']['total_steps']}")
    print(f"Total Step Definitions: {report['analysis']['total_step_definitions']}")
    print(f"\nIssues Found:")
    print(f"  Undefined Steps: {report['analysis']['undefined_steps']}")
    print(f"  Ambiguous Steps: {report['analysis']['ambiguous_steps']}")
    print(f"  Failed Steps: {report['analysis']['failed_steps']}")
    
    # Print detailed issues
    if issues['undefined']:
        print("\n=== UNDEFINED STEPS ===")
        for issue in issues['undefined']:
            print(f"\nScenario: {issue['scenario']}")
            print(f"Step: {issue['step']}")
            print(f"Message: {issue['message']}")
    
    if issues['ambiguous']:
        print("\n=== AMBIGUOUS STEPS ===")
        for issue in issues['ambiguous']:
            print(f"\nScenario: {issue['scenario']}")
            print(f"Step: {issue['step']}")
            print(f"Message: {issue['message']}")
    
    if issues['failed']:
        print("\n=== FAILED STEPS ===")
        for issue in issues['failed']:
            print(f"\nScenario: {issue['scenario']}")
            print(f"Message: {issue['message']}")
    
    # Save full report
    with open('BMAD-BUILD-DETAILED.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    # Also save a simplified mapping for the MEASURE phase
    step_mapping = []
    for feature_path, feature_data in features.items():
        for scenario in feature_data['scenarios']:
            for step_type, step_text in scenario['steps']:
                step_mapping.append({
                    'feature': feature_data['name'],
                    'scenario': scenario['name'],
                    'step_type': step_type,
                    'step_text': step_text,
                    'defined': False  # Will be updated in MEASURE phase
                })
    
    with open('BMAD-STEP-MAPPING.json', 'w') as f:
        json.dump(step_mapping, f, indent=2)
    
    print(f"\n\nDetailed reports saved to:")
    print("  - BMAD-BUILD-DETAILED.json")
    print("  - BMAD-STEP-MAPPING.json")
    
    return report

if __name__ == '__main__':
    os.chdir('/Users/david/Documents/root/founders-day')
    generate_build_report()