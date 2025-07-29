#!/usr/bin/env python3
import os
import glob
import re
from collections import defaultdict

def analyze_bdd_status():
    """Analyze BDD implementation status"""
    
    # Find all feature files
    feature_files = glob.glob('features/**/*.feature', recursive=True)
    print(f"Total feature files found: {len(feature_files)}")
    
    # Find all step definition files
    step_def_files = glob.glob('features/**/*.ts', recursive=True) + \
                     glob.glob('features/**/*.js', recursive=True) + \
                     glob.glob('e2e/**/*.ts', recursive=True) + \
                     glob.glob('pages/**/*.ts', recursive=True)
    
    print(f"Total step definition files found: {len(step_def_files)}")
    
    # Count scenarios and steps
    total_scenarios = 0
    total_steps = 0
    step_patterns = defaultdict(int)
    
    for feature_file in feature_files:
        with open(feature_file, 'r') as f:
            content = f.read()
            scenarios = re.findall(r'^\s*Scenario.*?:', content, re.MULTILINE)
            total_scenarios += len(scenarios)
            
            # Count different step types
            given_steps = re.findall(r'^\s*Given\s+(.+)$', content, re.MULTILINE)
            when_steps = re.findall(r'^\s*When\s+(.+)$', content, re.MULTILINE)
            then_steps = re.findall(r'^\s*Then\s+(.+)$', content, re.MULTILINE)
            and_steps = re.findall(r'^\s*And\s+(.+)$', content, re.MULTILINE)
            
            total_steps += len(given_steps) + len(when_steps) + len(then_steps) + len(and_steps)
            
            for step in given_steps + when_steps + then_steps + and_steps:
                step_patterns[step.strip()] += 1
    
    print(f"\nTotal scenarios: {total_scenarios}")
    print(f"Total steps: {total_steps}")
    print(f"Unique step patterns: {len(step_patterns)}")
    
    # Show most common undefined steps
    print("\nTop 10 most frequent step patterns:")
    sorted_steps = sorted(step_patterns.items(), key=lambda x: x[1], reverse=True)
    for step, count in sorted_steps[:10]:
        print(f"  {count}x: {step}")
    
    # Check for existing step definitions
    defined_steps = set()
    for step_file in step_def_files:
        if os.path.exists(step_file):
            with open(step_file, 'r') as f:
                content = f.read()
                # Look for Cucumber step definitions
                given_defs = re.findall(r'@?Given\([\'"`](.+?)[\'"`]\)', content)
                when_defs = re.findall(r'@?When\([\'"`](.+?)[\'"`]\)', content)
                then_defs = re.findall(r'@?Then\([\'"`](.+?)[\'"`]\)', content)
                defined_steps.update(given_defs + when_defs + then_defs)
    
    print(f"\nDefined step patterns: {len(defined_steps)}")
    
    # Feature file breakdown
    print("\n\nFeature file breakdown:")
    for feature in sorted(feature_files):
        print(f"  - {feature}")

if __name__ == "__main__":
    analyze_bdd_status()