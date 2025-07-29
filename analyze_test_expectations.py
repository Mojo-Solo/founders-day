#!/usr/bin/env python3
"""Analyze test expectations for BMAD BUILD phase"""

import re
import json

def analyze_profile_test():
    """Analyze profile test expectations"""
    with open('features/step-definitions/profile-steps.ts', 'r') as f:
        content = f.read()
    
    print("=== PROFILE TEST ANALYSIS ===")
    
    # Find the fill profile form step
    step_pattern = r'When\([\'"]I fill in the profile form with:(.*?)\}\);'
    step_match = re.search(step_pattern, content, re.DOTALL)
    
    if step_match:
        step_code = step_match.group(0)
        # Extract testId usage
        testid_pattern = r'getByTestId\([\'"]([^\'"]+)[\'"]\)'
        testids = re.findall(testid_pattern, step_code)
        
        print("TestIds expected in 'fill profile form' step:")
        for tid in testids:
            print(f"  - {tid}")
            
        # Check if it's looking for generic 'profile-field'
        if 'profile-field' in testids:
            print("\nWARNING: Test expects generic 'profile-field' testId")
            
    # Check mock implementation
    print("\n=== MOCK HTML ANALYSIS ===")
    with open('features/support/mock-pages/profile.html', 'r') as f:
        mock_content = f.read()
        
    # Extract testIds from mock
    mock_testids = re.findall(r'data-testid=[\'"]([^\'"]+)[\'"]', mock_content)
    print("TestIds available in mock HTML:")
    for tid in set(mock_testids):
        print(f"  - {tid}")
        
    return testids, mock_testids

def analyze_registration_test():
    """Analyze registration test expectations"""
    print("\n=== REGISTRATION TEST ANALYSIS ===")
    
    with open('features/step-definitions/frontend/registration-steps.ts', 'r') as f:
        content = f.read()
    
    # Find ticket selector step
    ticket_pattern = r'When\([\'"]I select (\d+) tickets?.*?\{(.*?)\}\);'
    ticket_match = re.search(ticket_pattern, content, re.DOTALL)
    
    if ticket_match:
        print("Ticket selection step code found")
        step_code = ticket_match.group(0)
        
        # Extract selector usage
        selector_patterns = [
            r'getByTestId\([\'"]([^\'"]+)[\'"]\)',
            r'getByRole\([\'"]([^\'"]+)[\'"]\)',
            r'locator\([\'"]([^\'"]+)[\'"]\)',
            r'click\([\'"]([^\'"]+)[\'"]\)'
        ]
        
        for pattern in selector_patterns:
            matches = re.findall(pattern, step_code)
            if matches:
                print(f"Selectors found with pattern {pattern}:")
                for m in matches:
                    print(f"  - {m}")
                    
    # Check mock for ticket input
    print("\n=== REGISTRATION MOCK ANALYSIS ===")
    with open('features/support/mock-pages/registration.html', 'r') as f:
        mock_content = f.read()
        
    # Check for ticket-related elements
    ticket_elements = re.findall(r'(data-testid=[\'"][^\'"]*(ticket|quantity)[^\'"]*[\'"]|id=[\'"]ticket[^\'"]*[\'"]|name=[\'"]ticket[^\'"]*[\'"])', mock_content, re.IGNORECASE)
    print("Ticket-related elements in mock:")
    for elem in ticket_elements:
        print(f"  - {elem}")

if __name__ == '__main__':
    profile_testids, mock_testids = analyze_profile_test()
    analyze_registration_test()
    
    print("\n=== MISMATCH ANALYSIS ===")
    print("Profile test expects:", profile_testids)
    print("Mock provides:", list(set(mock_testids)))