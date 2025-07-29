#!/bin/bash
cd /Users/david/Documents/root/founders-day

echo "=== Running BDD Tests for Analysis ==="
npm run test:bdd 2>&1 | tee bdd_output.log

echo -e "\n=== Analyzing Output ==="

echo -e "\n--- Undefined Steps ---"
grep -A2 -B2 "undefined" bdd_output.log || echo "No undefined steps found"

echo -e "\n--- Ambiguous Steps ---"
grep -A2 -B2 "ambiguous" bdd_output.log || echo "No ambiguous steps found"

echo -e "\n--- Failed Steps ---"
grep -A2 -B2 "failed\|✗" bdd_output.log || echo "No failed steps found"

echo -e "\n--- Summary ---"
grep -E "scenarios|steps" bdd_output.log || echo "No summary found"