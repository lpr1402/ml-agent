#!/usr/bin/env node

const crypto = require('crypto');

// Configurações da aplicação (do .env.local)
const CLIENT_ID = '8077330788571096';
const CLIENT_SECRET = 'jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha';
const REDIRECT_URI = 'https://gugaleo.axnexlabs.com.br/api/auth/callback/mercadolibre';

// Gerar state seguro como recomendado
const secureState = crypto.randomBytes(32).toString('hex');

console.log('====================================');
console.log('OBTENÇÃO DE TOKEN - MERCADO LIVRE');
console.log('====================================\n');

console.log('1. Acesse esta URL no navegador para autorizar:');
console.log('-------------------------------------------');
const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${CLIENT_ID}&state=${secureState}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
console.log(authUrl);
console.log('\n2. Após autorizar, você será redirecionado para uma URL como:');
console.log('   https://gugaleo.axnexlabs.com.br/api/auth/callback/mercadolibre?code=TG-xxx&state=' + secureState);
console.log('\n3. Copie o código (TG-xxx) e execute este comando:');
console.log('-------------------------------------------');
console.log(`node scripts/exchange-code.js TG-SEU-CODIGO-AQUI ${secureState}`);
console.log('\nIMPORTANTE: O state deve corresponder para garantir segurança!');
console.log('State gerado:', secureState);