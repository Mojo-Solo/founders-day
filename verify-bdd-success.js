#!/usr/bin/env node

/**
 * BMAD DECIDE Phase: Verify 100% BDD Test Success
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

// Test features
const features = [
  { name: 'Navigation', file: 'features/navigation.feature' },
  { name: 'Profile Management', file: 'features/profile-management.feature' },
  { name: 'Registration', file: 'features/registration.feature' }
];

let totalTests = 0;
let passedTests = 0;
const results = [];

console.log('=== BMAD DECIDE PHASE: FINAL VERIFICATION ===\n');

// Ensure reports directory exists
if (!fs.existsSync('reports')) {
  fs.mkdirSync('reports', { recursive: true });
}

// Function to run a single feature test
function runFeatureTest(feature, index) {
  return new Promise((resolve) => {
    console.log(`${index + 1}. Testing ${feature.name}...`);
    
    const startTime = Date.now();
    
    exec(`npx cucumber-js ${feature.file} --format json --publish-quiet`, (error, stdout, stderr) => {
      const duration = Date.now() - startTime;
      totalTests++;
      
      let passed = false;
      let scenarios = 0;
      let steps = 0;
      
      try {
        // Parse JSON output
        const jsonResults = JSON.parse(stdout);
        
        if (jsonResults && jsonResults.length > 0) {
          const feature = jsonResults[0];
          
          // Count scenarios and check if all passed
          passed = true;
          feature.elements?.forEach(element => {
            scenarios++;
            element.steps?.forEach(step => {
              steps++;
              if (step.result?.status !== 'passed') {
                passed = false;
              }
            });
          });
        }
      } catch (e) {
        // If JSON parsing fails, check exit code
        passed = !error;
      }
      
      if (passed) {
        passedTests++;
        console.log(`   ${colors.green}✅ PASSED${colors.reset} (${scenarios} scenarios, ${steps} steps, ${duration}ms)\n`);
      } else {
        console.log(`   ${colors.red}❌ FAILED${colors.reset} (${duration}ms)`);
        if (stderr) {
          console.log(`   Error: ${stderr.slice(0, 200)}...\n`);
        }
      }
      
      results.push({
        feature: feature.name,
        passed,
        scenarios,
        steps,
        duration
      });
      
      resolve();
    });
  });
}

// Run all tests sequentially
async function runAllTests() {
  for (let i = 0; i < features.length; i++) {
    await runFeatureTest(features[i], i);
  }
  
  // Calculate success rate
  const successRate = Math.round((passedTests / totalTests) * 100);
  
  // Display summary
  console.log('=== FINAL RESULTS ===');
  console.log(`Total Features: ${totalTests}`);
  console.log(`Passed: ${colors.green}${passedTests}${colors.reset}`);
  console.log(`Failed: ${colors.red}${totalTests - passedTests}${colors.reset}`);
  console.log(`Success Rate: ${successRate}%\n`);
  
  // Save results to file
  const report = {
    timestamp: new Date().toISOString(),
    phase: 'DECIDE',
    totalFeatures: totalTests,
    passed: passedTests,
    failed: totalTests - passedTests,
    successRate: successRate,
    targetAchieved: successRate === 100,
    details: results
  };
  
  fs.writeFileSync(
    path.join('reports', 'bmad-final-results.json'),
    JSON.stringify(report, null, 2)
  );
  
  if (successRate === 100) {
    console.log(`${colors.green}🎉 SUCCESS! All BDD tests are now passing at 100%!${colors.reset}`);
    console.log('BMAD cycle completed successfully.\n');
    process.exit(0);
  } else {
    console.log(`${colors.red}⚠️  Target not achieved. Success rate: ${successRate}%${colors.reset}`);
    console.log('Review the failures and apply additional fixes.\n');
    process.exit(1);
  }
}

// Start the test run
runAllTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});