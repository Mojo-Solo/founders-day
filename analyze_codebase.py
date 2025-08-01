#!/usr/bin/env python3
"""
Square Payment Integration Codebase Analysis
"""

import os
import json
import glob
from pathlib import Path

def analyze_project_structure():
    """Analyze the project structure for Square payment integration"""
    
    print("=== FOUNDERS DAY SQUARE PAYMENT INTEGRATION ANALYSIS ===\n")
    
    # Get current directory
    current_dir = Path.cwd()
    print(f"Analyzing directory: {current_dir}")
    
    # Check if this is a Next.js/React project
    package_json_path = current_dir / 'package.json'
    if package_json_path.exists():
        with open(package_json_path, 'r') as f:
            package_data = json.load(f)
        
        print(f"Project: {package_data.get('name', 'Unknown')}")
        print(f"Version: {package_data.get('version', 'Unknown')}")
        
        # Analyze dependencies
        deps = package_data.get('dependencies', {})
        dev_deps = package_data.get('devDependencies', {})
        
        payment_deps = []
        for dep_name in list(deps.keys()) + list(dev_deps.keys()):
            if any(keyword in dep_name.lower() for keyword in ['square', 'payment', 'stripe', 'checkout', 'react-hook-form', 'axios']):
                version = deps.get(dep_name) or dev_deps.get(dep_name)
                payment_deps.append(f"{dep_name}: {version}")
        
        if payment_deps:
            print(f"\n=== RELEVANT DEPENDENCIES ===")
            for dep in payment_deps:
                print(f"  {dep}")
    
    # Find key directories
    key_dirs = []
    for item in current_dir.iterdir():
        if item.is_dir() and item.name not in ['.git', 'node_modules', '.next', 'dist']:
            key_dirs.append(item.name)
    
    print(f"\n=== KEY DIRECTORIES ===")
    for dir_name in sorted(key_dirs):
        print(f"  📁 {dir_name}/")
    
    # Find payment-related files
    payment_files = []
    payment_keywords = ['square', 'payment', 'checkout', 'billing', 'stripe', 'order', 'customer']
    
    for root, dirs, files in os.walk('.'):
        # Skip irrelevant directories
        dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '.next', 'dist', 'build', '.vscode']]
        
        for file in files:
            if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.md')):
                if any(keyword in file.lower() for keyword in payment_keywords):
                    payment_files.append(os.path.join(root, file))
    
    print(f"\n=== PAYMENT-RELATED FILES ===")
    for file in sorted(payment_files):
        print(f"  📄 {file}")
    
    # Look for API routes
    api_dir = current_dir / 'pages' / 'api'
    app_api_dir = current_dir / 'app' / 'api'
    
    api_files = []
    for api_path in [api_dir, app_api_dir]:
        if api_path.exists():
            for file in api_path.rglob('*.ts'):
                api_files.append(str(file.relative_to(current_dir)))
            for file in api_path.rglob('*.js'):
                api_files.append(str(file.relative_to(current_dir)))
    
    if api_files:
        print(f"\n=== API ROUTES FOUND ===")
        for file in sorted(api_files):
            print(f"  📄 {file}")
    
    # Look for component files
    components_dirs = ['components', 'src/components', 'app/components']
    component_files = []
    
    for comp_dir in components_dirs:
        comp_path = current_dir / comp_dir
        if comp_path.exists():
            for file in comp_path.rglob('*.tsx'):
                component_files.append(str(file.relative_to(current_dir)))
            for file in comp_path.rglob('*.jsx'):
                component_files.append(str(file.relative_to(current_dir)))
    
    if component_files:
        print(f"\n=== COMPONENT FILES (Sample) ===")
        for file in sorted(component_files)[:10]:  # Show first 10
            print(f"  📄 {file}")
        if len(component_files) > 10:
            print(f"  ... and {len(component_files) - 10} more component files")
    
    return {
        'payment_files': payment_files,
        'api_files': api_files,
        'component_files': component_files,
        'package_data': package_data if 'package_data' in locals() else None
    }

if __name__ == "__main__":
    result = analyze_project_structure()
    print(f"\n=== SUMMARY ===")
    print(f"Payment-related files: {len(result['payment_files'])}")
    print(f"API files: {len(result['api_files'])}")
    print(f"Component files: {len(result['component_files'])}")