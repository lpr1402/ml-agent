#!/usr/bin/env node

const https = require('https');
const querystring = require('querystring');

// Configurações
const CLIENT_ID = '8077330788571096';
const CLIENT_SECRET = 'jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha';
const REDIRECT_URI = 'https://gugaleo.axnexlabs.com.br/api/auth/callback/mercadolibre';

const code = process.argv[2];
const state = process.argv[3];

if (!code) {
  console.error('Uso: node exchange-code.js TG-CODIGO [STATE]');
  process.exit(1);
}

console.log('Trocando código por access token...');
console.log('Código:', code);
if (state) console.log('State:', state);

// Preparar dados seguindo recomendações ML (enviar no body, não na querystring)
const postData = querystring.stringify({
  'grant_type': 'authorization_code',
  'client_id': CLIENT_ID,
  'client_secret': CLIENT_SECRET,
  'code': code,
  'redirect_uri': REDIRECT_URI
});

const options = {
  hostname: 'api.mercadolibre.com',
  port: 443,
  path: '/oauth/token',
  method: 'POST',
  headers: {
    'accept': 'application/json',
    'content-type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.access_token) {
        console.log('\n✅ TOKEN OBTIDO COM SUCESSO!\n');
        console.log('Access Token:', response.access_token);
        console.log('User ID:', response.user_id);
        console.log('Refresh Token:', response.refresh_token);
        console.log('Expires In:', response.expires_in, 'segundos');
        console.log('\n📝 Salve estas informações no banco de dados:');
        console.log('-------------------------------------------');
        console.log(`
-- Execute este SQL no PostgreSQL:
INSERT INTO "User" (
  "id",
  "mlUserId", 
  "nickname",
  "email",
  "accessToken",
  "refreshToken",
  "createdAt",
  "updatedAt"
) VALUES (
  'user-${response.user_id}',
  '${response.user_id}',
  'ELITESAUDEANIMAL',
  'contato@elitesaudeanimal.com',
  '${response.access_token}',
  '${response.refresh_token}',
  NOW(),
  NOW()
) ON CONFLICT ("mlUserId") DO UPDATE SET
  "accessToken" = EXCLUDED."accessToken",
  "refreshToken" = EXCLUDED."refreshToken",
  "updatedAt" = NOW();
        `);
      } else {
        console.error('\n❌ Erro ao obter token:', response);
      }
    } catch (error) {
      console.error('Erro ao processar resposta:', error);
      console.log('Resposta raw:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Erro na requisição:', error);
});

req.write(postData);
req.end();