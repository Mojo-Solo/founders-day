module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: [
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    format: [
      'progress',
      'json:reports/cucumber-fast-report.json'
    ],
    formatOptions: {
      snippetInterface: 'async-await'
    },
    dryRun: false,
    failFast: true, // Fail fast for quick feedback
    parallel: 6, // Aggressive parallelism
    retry: 0, // No retries for maximum speed
    timeout: 8000, // Reduced timeout
    worldParameters: {
      timeout: 8000,
      defaultTimeout: 8000,
      browserPooling: true,
      fastMode: true,
      aggressiveOptimizations: true
    },
    tags: 'not @slow and not @sequential'
  },
  
  // Ultra-fast smoke test profile
  smoke: {
    paths: ['features/**/*.feature'],
    require: [
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    format: ['progress'],
    tags: '@smoke and not @slow',
    failFast: true,
    parallel: 4,
    timeout: 5000,
    retry: 0,
    worldParameters: {
      timeout: 5000,
      defaultTimeout: 5000,
      browserPooling: true,
      fastMode: true,
      smokeMode: true
    }
  },
  
  // Performance benchmark profile
  benchmark: {
    paths: ['features/**/*.feature'],
    require: [
      'features/step-definitions/**/*.ts',
      'features/support/**/*.ts'
    ],
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    format: [
      'progress',
      'json:reports/cucumber-benchmark.json'
    ],
    parallel: 8, // Maximum parallelism
    retry: 0,
    timeout: 10000,
    worldParameters: {
      timeout: 10000,
      defaultTimeout: 10000,
      browserPooling: true,
      fastMode: true,
      benchmarkMode: true
    },
    tags: 'not @slow and not @sequential and not @flaky'
  }
};