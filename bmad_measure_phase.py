#!/usr/bin/env python3
"""BMAD MEASURE Phase: Map current vs expected step definitions"""

import os
import re
import json
from collections import defaultdict

os.chdir('/Users/david/Documents/root/founders-day')

def extract_steps_from_features():
    """Extract all steps from feature files"""
    steps_needed = []
    
    features = {
        'registration': 'features/registration.feature',
        'profile': 'features/profile-management.feature',
        'search': 'features/search-functionality.feature'
    }
    
    for feature_name, filepath in features.items():
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                content = f.read()
                
                # Find all scenarios
                scenarios = re.split(r'(?=Scenario:)', content)
                for scenario in scenarios:
                    if 'Scenario:' in scenario:
                        scenario_name = re.search(r'Scenario: (.+)', scenario)
                        if scenario_name:
                            scenario_name = scenario_name.group(1).strip()
                            
                            # Extract steps
                            steps = re.findall(r'(Given|When|Then|And) (.+)', scenario)
                            for step_type, step_text in steps:
                                steps_needed.append({
                                    'feature': feature_name,
                                    'scenario': scenario_name,
                                    'type': step_type,
                                    'text': step_text.strip(),
                                    'full_step': f"{step_type} {step_text.strip()}"
                                })
    
    return steps_needed

def extract_step_definitions():
    """Extract all step definitions from TypeScript files"""
    step_definitions = []
    
    # Check all step definition files
    step_files = [
        'features/step-definitions/frontend/registration-steps.ts',
        'features/step-definitions/profile-steps.ts',
        'features/step-definitions/common/search-steps.ts',
        'features/step-definitions/common/form-steps.ts',
        'features/step-definitions/common/ui-steps.ts',
        'features/step-definitions/common/navigation-steps.ts',
        'features/step-definitions/common/general-steps.ts'
    ]
    
    for filepath in step_files:
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                content = f.read()
                
                # Extract step definitions - handle various formats
                # Pattern 1: @Given('pattern')
                pattern1 = re.findall(r'@(Given|When|Then)\([\'"`]([^\'"`]+)[\'"`]', content)
                for step_type, pattern in pattern1:
                    step_definitions.append({
                        'file': filepath,
                        'type': step_type,
                        'pattern': pattern,
                        'is_regex': '{' in pattern or '(' in pattern
                    })
                
                # Pattern 2: Given('pattern', async function)
                pattern2 = re.findall(r'(Given|When|Then)\([\'"`]([^\'"`]+)[\'"`]', content)
                for step_type, pattern in pattern2:
                    if not any(d['pattern'] == pattern for d in step_definitions):
                        step_definitions.append({
                            'file': filepath,
                            'type': step_type,
                            'pattern': pattern,
                            'is_regex': '{' in pattern or '(' in pattern
                        })
    
    return step_definitions

def match_step_to_definition(step, definitions):
    """Try to match a step to its definition"""
    matches = []
    
    # Normalize the step text (handle 'And' by using previous step type)
    step_text = step['text']
    
    for definition in definitions:
        # Skip if step types don't match (unless step is 'And')
        if step['type'] != 'And' and step['type'] != definition['type']:
            continue
            
        # Try exact match first
        if definition['pattern'] == step_text:
            matches.append(definition)
            continue
            
        # Try regex match
        if definition['is_regex']:
            # Convert Cucumber expression to regex
            pattern = definition['pattern']
            # Replace {string} with quoted string pattern
            pattern = pattern.replace('{string}', '"[^"]*"')
            # Replace {int} with number pattern
            pattern = pattern.replace('{int}', r'\d+')
            # Replace {word} with word pattern
            pattern = pattern.replace('{word}', r'\w+')
            
            try:
                if re.match(f"^{pattern}$", step_text):
                    matches.append(definition)
            except:
                pass
    
    return matches

def generate_measure_report():
    """Generate MEASURE phase report"""
    print("=== BMAD MEASURE PHASE: Step Definition Mapping ===\n")
    
    # Extract data
    steps_needed = extract_steps_from_features()
    step_definitions = extract_step_definitions()
    
    print(f"Total steps needed: {len(steps_needed)}")
    print(f"Total step definitions found: {len(step_definitions)}")
    
    # Analyze matches
    mapping_results = {
        'matched': [],
        'unmatched': [],
        'ambiguous': []
    }
    
    for step in steps_needed:
        matches = match_step_to_definition(step, step_definitions)
        
        if len(matches) == 0:
            mapping_results['unmatched'].append(step)
        elif len(matches) == 1:
            mapping_results['matched'].append({
                'step': step,
                'definition': matches[0]
            })
        else:
            mapping_results['ambiguous'].append({
                'step': step,
                'definitions': matches
            })
    
    # Generate report
    report = {
        'phase': 'MEASURE',
        'total_steps': len(steps_needed),
        'total_definitions': len(step_definitions),
        'matched_steps': len(mapping_results['matched']),
        'unmatched_steps': len(mapping_results['unmatched']),
        'ambiguous_steps': len(mapping_results['ambiguous']),
        'mapping_results': mapping_results,
        'steps_by_feature': defaultdict(lambda: {'matched': 0, 'unmatched': 0, 'ambiguous': 0})
    }
    
    # Count by feature
    for item in mapping_results['matched']:
        feature = item['step']['feature']
        report['steps_by_feature'][feature]['matched'] += 1
    
    for step in mapping_results['unmatched']:
        feature = step['feature']
        report['steps_by_feature'][feature]['unmatched'] += 1
    
    for item in mapping_results['ambiguous']:
        feature = item['step']['feature']
        report['steps_by_feature'][feature]['ambiguous'] += 1
    
    # Print summary
    print(f"\n=== MAPPING SUMMARY ===")
    print(f"Matched: {report['matched_steps']} ({report['matched_steps']/report['total_steps']*100:.1f}%)")
    print(f"Unmatched: {report['unmatched_steps']} ({report['unmatched_steps']/report['total_steps']*100:.1f}%)")
    print(f"Ambiguous: {report['ambiguous_steps']} ({report['ambiguous_steps']/report['total_steps']*100:.1f}%)")
    
    print(f"\n=== BY FEATURE ===")
    for feature, counts in report['steps_by_feature'].items():
        print(f"\n{feature.upper()}:")
        print(f"  Matched: {counts['matched']}")
        print(f"  Unmatched: {counts['unmatched']}")
        print(f"  Ambiguous: {counts['ambiguous']}")
    
    # Print unmatched steps
    if mapping_results['unmatched']:
        print(f"\n=== UNMATCHED STEPS (need definitions) ===")
        for step in mapping_results['unmatched']:
            print(f"\n{step['feature']} - {step['scenario']}:")
            print(f"  {step['full_step']}")
    
    # Print ambiguous steps
    if mapping_results['ambiguous']:
        print(f"\n=== AMBIGUOUS STEPS (multiple matches) ===")
        for item in mapping_results['ambiguous']:
            step = item['step']
            print(f"\n{step['feature']} - {step['scenario']}:")
            print(f"  Step: {step['full_step']}")
            print(f"  Matches:")
            for defn in item['definitions']:
                print(f"    - {defn['pattern']} (in {os.path.basename(defn['file'])})")
    
    # Save detailed report
    with open('BMAD-MEASURE-REPORT.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"\n\nDetailed report saved to: BMAD-MEASURE-REPORT.json")
    
    return report

if __name__ == '__main__':
    generate_measure_report()