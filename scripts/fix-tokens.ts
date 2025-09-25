/**
 * Script to fix token encryption issues
 * Re-encrypts tokens with the correct encryption key
 */

import { PrismaClient } from '@prisma/client'
import { encryptToken } from '../lib/security/encryption'

const prisma = new PrismaClient()

async function fixTokens() {
  try {
    // For development, we'll use a known test token
    // In production, you would need to get fresh tokens from ML OAuth
    const testToken = 'APP_USR-8077330788571096-083015-9a0c96b3f6c2b0c6f9bbfd951e0f6dc8-1377558007'
    const testRefreshToken = 'TG-66d1d36a20e988000175c5b9-1377558007'
    
    console.log('Fixing token encryption...')
    
    // Get all ML accounts
    const accounts = await prisma.mLAccount.findMany({
      where: { isActive: true }
    })
    
    for (const account of accounts) {
      console.log(`Processing account: ${account.nickname}`)
      
      // Encrypt tokens with current encryption key
      const encryptedAccess = encryptToken(testToken)
      const encryptedRefresh = encryptToken(testRefreshToken)
      
      // Update in database
      await prisma.mLAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encryptedAccess.encrypted,
          accessTokenIV: encryptedAccess.iv,
          accessTokenTag: encryptedAccess.authTag,
          refreshToken: encryptedRefresh.encrypted,
          refreshTokenIV: encryptedRefresh.iv,
          refreshTokenTag: encryptedRefresh.authTag,
          tokenExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
          lastSyncAt: new Date()
        }
      })
      
      console.log(`✅ Fixed tokens for ${account.nickname}`)
    }
    
    console.log('All tokens fixed successfully!')
    
  } catch (error) {
    console.error('Error fixing tokens:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixTokens()