const { PrismaClient } = require('@prisma/client');
const { decryptToken } = require('./lib/security/encryption');

const prisma = new PrismaClient();

async function testToken() {
  const account = await prisma.mLAccount.findFirst({
    where: { isActive: true }
  });
  
  if (!account) {
    console.log('No active account found');
    process.exit(1);
  }
  
  const token = decryptToken({
    encrypted: account.accessToken,
    iv: account.accessTokenIV,
    authTag: account.accessTokenTag
  });
  
  // Test ML API
  const response = await fetch('https://api.mercadolibre.com/users/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log('✅ TOKEN VÁLIDO!');
    console.log('Conta:', data.nickname);
    console.log('ID:', data.id);
    console.log('Site:', data.site_id);
    console.log('Token expira em:', account.tokenExpiresAt);
    
    const minutesLeft = Math.floor((new Date(account.tokenExpiresAt) - new Date()) / 60000);
    console.log(`Tempo restante: ${minutesLeft} minutos`);
    console.log(`Refresh agendado para: ${minutesLeft - 5} minutos`);
  } else {
    console.log('❌ TOKEN INVÁLIDO!');
    console.log('Status:', response.status);
  }
  
  await prisma.$disconnect();
}

testToken();