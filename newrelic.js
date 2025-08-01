/**
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
