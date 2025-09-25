#!/usr/bin/env node

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3007,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ ML Agent is healthy');
    process.exit(0);
  } else {
    console.error('❌ ML Agent is unhealthy - Status:', res.statusCode);
    process.exit(1);
  }
});

req.on('error', (error) => {
  console.error('❌ ML Agent is down:', error.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ ML Agent health check timeout');
  req.destroy();
  process.exit(1);
});

req.end();