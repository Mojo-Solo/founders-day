#!/usr/bin/env node

/**
 * Production Monitoring Setup Script
 * Configures monitoring tools for the Founders Day Frontend
 */

const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

// Configuration templates
const configurations = {
  newRelic: {
    configFile: 'newrelic.js',
    content: `/**
 * New Relic configuration file
 */
'use strict'

exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'Founders Day Frontend'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info'
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization'
    ]
  },
  browser_monitoring: {
    enable: true
  },
  distributed_tracing: {
    enabled: true
  }
}
`
  }
};

async function createMonitoringFiles() {
  log('\n🔧 Creating monitoring configuration files...', 'cyan');
  
  for (const [tool, config] of Object.entries(configurations)) {
    const filePath = path.join(process.cwd(), config.configFile);
    const dir = path.dirname(filePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`  📁 Created directory: ${dir}`, 'blue');
    }
    
    fs.writeFileSync(filePath, config.content);
    log(`  ✅ Created: ${config.configFile}`, 'green');
  }
}

async function main() {
  log('🚀 Monitoring Setup', 'bold');
  
  try {
    await createMonitoringFiles();
    log('\n✅ Setup completed!', 'green');
  } catch (error) {
    log(`\n💥 Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}