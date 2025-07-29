module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: [
      'features/support/parameter-types.ts',
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    timeout: 15000, // Reduced timeout for faster feedback
    worldParameters: {
      timeout: 15000,
      defaultTimeout: 15000
    },
    format: [
      'progress-bar',
      'json:reports/cucumber-report.json',
      'html:reports/cucumber-report.html',
      '@cucumber/pretty-formatter'
    ],
    formatOptions: {
      snippetInterface: 'async-await'
    },
    dryRun: false,
    failFast: false,
    parallel: 1,
    retry: 1,
    retryTagFilter: '@flaky'
  },
  
  // Parallel execution profile
  parallel: {
    paths: ['features/**/*.feature'],
    require: [
      'features/support/parameter-types.ts',
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    timeout: 30000,
    format: [
      'progress-bar',
      'json:reports/cucumber-parallel-report.json'
    ],
    parallel: 4,
    retry: 0, // Disable retries for performance
    tags: 'not @sequential',
    worldParameters: {
      timeout: 10000,
      defaultTimeout: 10000,
      browserPooling: true
    }
  },
  
  // Sequential execution for specific scenarios
  sequential: {
    paths: ['features/**/*.feature'],
    require: [
      'features/support/parameter-types.ts',
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    timeout: 30000,
    format: [
      'progress',
      'json:reports/cucumber-sequential-report.json'
    ],
    parallel: 1,
    tags: '@sequential'
  },
  
  // Smoke test profile
  smoke: {
    paths: ['features/**/*.feature'],
    require: [
      'features/support/parameter-types.ts',
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    timeout: 30000,
    format: ['progress'],
    tags: '@smoke',
    failFast: true,
    parallel: 2
  },
  
  // CI profile with detailed reporting
  ci: {
    paths: ['features/**/*.feature'],
    require: [
      'features/support/parameter-types.ts',
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    timeout: 20000, // Reduced timeout for faster CI
    format: [
      'json:reports/cucumber-ci.json',
      'html:reports/cucumber-ci.html',
      'junit:reports/cucumber-junit.xml'
    ],
    parallel: process.env.CI ? 6 : 2, // Increased parallelism
    retry: 1, // Reduced retries
    retryTagFilter: '@flaky or @unstable',
    worldParameters: {
      timeout: 15000,
      defaultTimeout: 15000,
      browserPooling: true,
      fastMode: true
    }
  },
  
  // Watch mode profile for development
  watch: {
    paths: ['features/**/*.feature'],
    require: [
      'features/support/parameter-types.ts',
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    timeout: 30000,
    format: ['progress'],
    watch: true,
    watchForFileChanges: true
  }
};