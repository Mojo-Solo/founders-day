module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: [
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    format: [
      'progress-bar',
      'json:reports/cucumber-report.json',
      'html:reports/cucumber-report.html',
      '@cucumber/pretty-formatter'
    ],
    formatOptions: {
      snippetInterface: 'async-await'
    },
    publishQuiet: true,
    dryRun: false,
    failFast: false,
    parallel: 4,
    retry: 1,
    retryTagFilter: '@flaky'
  },
  
  // Parallel execution profile
  parallel: {
    paths: ['features/**/*.feature'],
    require: [
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    format: [
      'progress-bar',
      'json:reports/cucumber-parallel-report.json'
    ],
    parallel: 4,
    retry: 1,
    tags: 'not @sequential'
  },
  
  // Sequential execution for specific scenarios
  sequential: {
    paths: ['features/**/*.feature'],
    require: [
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
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
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    format: ['progress'],
    tags: '@smoke',
    failFast: true,
    parallel: 2
  },
  
  // CI profile with detailed reporting
  ci: {
    paths: ['features/**/*.feature'],
    require: [
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    format: [
      'json:reports/cucumber-ci.json',
      'html:reports/cucumber-ci.html',
      'junit:reports/cucumber-junit.xml',
      '@cucumber/pretty-formatter'
    ],
    parallel: process.env.CI ? 4 : 1,
    retry: 2,
    retryTagFilter: '@flaky or @unstable'
  }
};