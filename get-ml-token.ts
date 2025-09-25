import { prisma } from './lib/prisma';
import crypto from 'crypto';

// Chave correta do .env.local (que o sistema está usando)
const ENCRYPTION_KEY = 'ml-agent-encryption-key-2025-secure-32bytes!!';
const SALT = 'ml-agent-salt-2025';
const ALGORITHM = 'aes-256-gcm';

// Deriva a chave real usando scrypt
const KEY = crypto.scryptSync(ENCRYPTION_KEY, SALT, 32);

function decryptToken(data: { encrypted: string; iv: string; authTag: string }): string {
  try {
    const { encrypted, iv, authTag } = data;
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      KEY,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

async function getRealToken() {
  const account = await prisma.mLAccount.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
    select: {
      nickname: true,
      mlUserId: true,
      accessToken: true,
      accessTokenIV: true,
      accessTokenTag: true,
      tokenExpiresAt: true
    }
  });

  if (!account) {
    console.log('No active ML account found');
    return;
  }

  console.log('Account:', account.nickname);
  console.log('Token expires:', account.tokenExpiresAt);
  
  try {
    const token = decryptToken({
      encrypted: account.accessToken,
      iv: account.accessTokenIV,
      authTag: account.accessTokenTag
    });

    console.log('\n=== 🔓 TOKEN DESCRIPTOGRAFADO COM SUCESSO ===');
    console.log('Token ML:', token);
    console.log('===========================================\n');
    
    // Comando para reconfigurar MCP
    console.log('📌 Para reconfigurar o MCP, execute:');
    console.log('\nclaud mcp remove mercadolibre-mcp-server');
    console.log(`claude mcp add mercadolibre-mcp-server -- npx -y mcp-remote https://mcp.mercadolibre.com/mcp --header "Authorization:Bearer ${token}"\n`);
    
    // Validar token
    console.log('🔍 Validando token...');
    const response = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Token válido! Usuário:', data.nickname);
      console.log('   Site:', data.site_id);
      console.log('   ID:', data.id);
    } else {
      console.log('❌ Token expirado ou inválido. Status:', response.status);
      if (response.status === 401) {
        console.log('\n⚠️  Faça login novamente em: https://gugaleo.axnexlabs.com.br');
      }
    }
    
  } catch (error) {
    console.error('Erro ao descriptografar:', error);
  }
  
  await prisma.$disconnect();
}

getRealToken();