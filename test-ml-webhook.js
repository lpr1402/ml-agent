#!/usr/bin/env node

/**
 * TEST WEBHOOK ML - Simula pergunta real do Mercado Livre
 */

const https = require('https');

console.log('🚀 Simulating ML Webhook Question...\n');

const webhookData = {
  _id: 'TEST-' + Date.now(),
  resource: `/questions/${Date.now()}`,
  user_id: 1192624784,  // Real ML user ID
  topic: 'questions',
  application_id: 8077330788571096,
  attempts: 1,
  sent: new Date().toISOString(),
  received: new Date().toISOString()
};

const postData = JSON.stringify(webhookData);

const options = {
  hostname: 'gugaleo.axnexlabs.com.br',
  port: 443,
  path: '/api/ml-webhook/handler',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length,
    'X-Signature': 'test-signature'
  }
};

const req = https.request(options, (res) => {
  console.log('📡 Response Status:', res.statusCode);
  console.log('📋 Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📦 Response Body:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log(data);
    }
    
    console.log('\n✅ Webhook test completed!');
    console.log('Check PM2 logs to see if the question was processed:');
    console.log('pm2 logs --lines 50 --nostream | grep -E "(Webhook|Question|SSE)"');
  });
});

req.on('error', (e) => {
  console.error('❌ Error:', e.message);
});

req.write(postData);
req.end();
