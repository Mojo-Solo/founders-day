#!/usr/bin/env python3
"""Direct analysis of BDD test files and their current state"""

import os
import re
import json

os.chdir('/Users/david/Documents/root/founders-day')

# Read the registration feature file
print("=== REGISTRATION FEATURE ===")
with open('features/registration.feature', 'r') as f:
    reg_content = f.read()
    print(reg_content)

print("\n=== PROFILE FEATURE ===")
with open('features/profile-management.feature', 'r') as f:
    prof_content = f.read()
    print(prof_content)

print("\n=== SEARCH FEATURE ===")
with open('features/search-functionality.feature', 'r') as f:
    search_content = f.read()
    print(search_content)

# Now check step definitions
print("\n\n=== STEP DEFINITIONS ===")

print("\n--- Registration Steps ---")
with open('features/step-definitions/frontend/registration-steps.ts', 'r') as f:
    print(f.read())

print("\n--- Profile Steps ---")
if os.path.exists('features/step-definitions/profile-steps.ts'):
    with open('features/step-definitions/profile-steps.ts', 'r') as f:
        print(f.read())

print("\n--- Search Steps ---")
if os.path.exists('features/step-definitions/common/search-steps.ts'):
    with open('features/step-definitions/common/search-steps.ts', 'r') as f:
        print(f.read())

# Extract all steps from features
all_steps = []
for content, feature_name in [(reg_content, 'registration'), (prof_content, 'profile'), (search_content, 'search')]:
    steps = re.findall(r'(Given|When|Then|And) (.+)', content)
    for step_type, step_text in steps:
        all_steps.append({
            'feature': feature_name,
            'type': step_type,
            'text': step_text.strip()
        })

print(f"\n\n=== TOTAL STEPS NEEDED: {len(all_steps)} ===")
for step in all_steps:
    print(f"{step['feature']}: {step['type']} {step['text']}")

# Save for reference
with open('BMAD-ALL-STEPS.json', 'w') as f:
    json.dump(all_steps, f, indent=2)