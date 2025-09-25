import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.production
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

const prisma = new PrismaClient();

// Usar a mesma lógica de derivação de chave do sistema
const ENCRYPTION_KEY = process.env['ENCRYPTION_KEY'] || 'ml-agent-encryption-key-2025-secure-32bytes!!';
const SALT = process.env['ENCRYPTION_SALT'] || 'ml-agent-salt-2025';
const KEY = crypto.scryptSync(ENCRYPTION_KEY, SALT, 32);

// Função de descriptografia do token
function decryptToken(data: { encrypted: string; iv: string; authTag: string }): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(data.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
  
  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function getRealToken(): Promise<string | undefined> {
  try {
    const account = await prisma.mLAccount.findFirst({
      where: { isActive: true },
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
      return undefined;
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(account.tokenExpiresAt);
    const isExpired = now > expiresAt;
    
    if (isExpired) {
      console.log('⚠️  WARNING: Token is expired!');
      console.log(`Token expired at: ${expiresAt.toISOString()}`);
      console.log(`Current time: ${now.toISOString()}`);
      console.log('Please login again at https://gugaleo.axnexlabs.com.br to refresh the token');
      return undefined;
    }

    const token = decryptToken({
      encrypted: account.accessToken,
      iv: account.accessTokenIV,
      authTag: account.accessTokenTag
    });

    console.log('=== REAL MERCADO LIVRE TOKEN ===');
    console.log('Account:', account.nickname);
    console.log('User ID:', account.mlUserId);
    console.log('Token:', token);
    console.log('Expires at:', expiresAt.toISOString());
    console.log('Time remaining:', Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60), 'minutes');
    console.log('=================================');
    
    // Test token validity
    console.log('\nTesting token validity...');
    const response = await fetch('https://api.mercadolibre.com/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const user = await response.json();
      console.log('✅ Token is valid! User:', user.nickname);
    } else {
      console.log('❌ Token is invalid or expired. Status:', response.status);
      console.log('Please login again at https://gugaleo.axnexlabs.com.br');
      return undefined;
    }
    
    return token;
  } catch (error) {
    console.error('Error getting token:', error);
    return undefined;
  } finally {
    await prisma.$disconnect();
  }
}

getRealToken().then(token => {
  if (token) {
    console.log('\n📋 Use this token to configure MCP:');
    console.log(`claude mcp add mercadolibre-mcp-server -- npx -y mcp-remote https://mcp.mercadolibre.com/mcp --header "Authorization:Bearer ${token}"`);
  }
});