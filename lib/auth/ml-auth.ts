/**
 * Sistema de Autenticação Principal via Mercado Livre
 * O usuário faz login com sua conta ML principal
 * Depois pode adicionar mais contas ML à sua organização
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { 
  generateSecureToken, 
  encryptToken
} from '@/lib/security/encryption'
import { auditLog, AUDIT_ACTIONS } from '@/lib/audit/audit-logger'

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 dias

export interface MLSession {
  id: string;
  organizationId: string
  primaryMLUserId: string
  primaryNickname: string
  activeMLAccountId: string
  sessionToken: string
  expiresAt: Date
}

/**
 * Cria uma nova sessão após login com ML OAuth
 */
export async function createSession(
  mlUserId: string,
  nickname: string,
  email: string | null,
  siteId: string,
  tokens: {
    access_token: string
    refresh_token: string
    expires_in: number
  },
  thumbnail?: string | null,
  permalink?: string | null
): Promise<MLSession> {
  // REAL FIX: Atomic duplicate prevention with proper error handling
  return await prisma.$transaction(async (tx) => {
    // STEP 1: Try to find existing ML account (ATOMIC CHECK)
    const existingAccount = await tx.mLAccount.findUnique({
      where: { mlUserId },
      include: { organization: true }
    })
    
    // STEP 2: If account exists, use existing organization
    if (existingAccount) {
      // Account already exists - NEVER create duplicate
      logger.info(`[Auth] Existing ML user ${mlUserId} found, using organization ${existingAccount.organizationId}`)
      
      // Update tokens for existing account
      const encryptedAccess = encryptToken(tokens.access_token)
      const encryptedRefresh = encryptToken(tokens.refresh_token)
      
      await tx.mLAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: encryptedAccess.encrypted,
          accessTokenIV: encryptedAccess.iv,
          accessTokenTag: encryptedAccess.authTag,
          refreshToken: encryptedRefresh.encrypted,
          refreshTokenIV: encryptedRefresh.iv,
          refreshTokenTag: encryptedRefresh.authTag,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          lastSyncAt: new Date(),
          isActive: true,
          connectionError: null,
          thumbnail: thumbnail || existingAccount.thumbnail, // Always update with new one if available
          permalink: permalink || existingAccount.permalink
        }
      })
      
      // Create new session for existing organization
      const sessionToken = generateSecureToken(32)
      const expiresAt = new Date(Date.now() + SESSION_DURATION)
      
      const session = await tx.session.create({
        data: {
          sessionToken,
          organizationId: existingAccount.organizationId,
          activeMLAccountId: existingAccount.id,
          expiresAt,
          ipAddress: await getClientIP(),
          userAgent: await getUserAgent()
        }
      })
      
      return {
        id: session.id,
        organizationId: existingAccount.organizationId,
        primaryMLUserId: existingAccount.organization?.primaryMLUserId || mlUserId,
        primaryNickname: existingAccount.organization?.primaryNickname || nickname,
        activeMLAccountId: existingAccount.id,
        sessionToken,
        expiresAt
      }
    }
    
    // STEP 3: No existing account - check for existing organization
    let organization = await tx.organization.findUnique({
      where: { primaryMLUserId: mlUserId }
    })
    
    // STEP 4: Create new organization ONLY if doesn't exist
    if (!organization) {
      // Use try-catch to handle concurrent creation attempts
      try {
        organization = await tx.organization.create({
          data: {
            primaryMLAccountId: '', // Will be filled after creating account
            primaryMLUserId: mlUserId,
            primaryNickname: nickname,
            primaryEmail: email,
            primarySiteId: siteId
          }
        })
        logger.info(`[Auth] Created new organization for ${nickname} (${mlUserId})`)
      } catch (error: any) {
        // If unique constraint violation, another transaction created it
        if (error.code === 'P2002') {
          // Try to find the organization created by another transaction
          organization = await tx.organization.findUnique({
            where: { primaryMLUserId: mlUserId }
          })
          if (!organization) {
            throw new Error('Failed to create or find organization')
          }
          logger.info(`[Auth] Organization already created by concurrent request`)
        } else {
          throw error
        }
      }
    }
    
    // STEP 5: Encrypt tokens
    const encryptedAccess = encryptToken(tokens.access_token)
    const encryptedRefresh = encryptToken(tokens.refresh_token)
    
    // STEP 6: Create ML account (NO UPSERT - only CREATE)
    let mlAccount: any
    try {
      mlAccount = await tx.mLAccount.create({
        data: {
          mlUserId,
          nickname,
          email,
          siteId,
          thumbnail: thumbnail || null,
          permalink: permalink || null,
          isPrimary: true,
          organizationId: organization.id,
          accessToken: encryptedAccess.encrypted,
          accessTokenIV: encryptedAccess.iv,
          accessTokenTag: encryptedAccess.authTag,
          refreshToken: encryptedRefresh.encrypted,
          refreshTokenIV: encryptedRefresh.iv,
          refreshTokenTag: encryptedRefresh.authTag,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          isActive: true
        }
      })
      logger.info(`[Auth] Created ML account for ${nickname}`)
    } catch (error: any) {
      // If unique constraint violation, the account was created by another transaction
      if (error.code === 'P2002') {
        // Find the account created by another transaction
        mlAccount = await tx.mLAccount.findUnique({
          where: { mlUserId }
        })
        if (!mlAccount) {
          throw new Error('Failed to create or find ML account')
        }
        // Update tokens for the existing account
        await tx.mLAccount.update({
          where: { id: mlAccount.id },
          data: {
            accessToken: encryptedAccess.encrypted,
            accessTokenIV: encryptedAccess.iv,
            accessTokenTag: encryptedAccess.authTag,
            refreshToken: encryptedRefresh.encrypted,
            refreshTokenIV: encryptedRefresh.iv,
            refreshTokenTag: encryptedRefresh.authTag,
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            lastSyncAt: new Date(),
            isActive: true,
            connectionError: null
          }
        })
        logger.info(`[Auth] ML account already created by concurrent request`)
      } else {
        throw error
      }
    }
    
    // Update organization with primary ML account ID within transaction
    if (!organization.primaryMLAccountId) {
      await tx.organization.update({
        where: { id: organization.id },
        data: { primaryMLAccountId: mlAccount.id }
      })
    }
    
    // Create session within transaction
    const sessionToken = generateSecureToken(32)
    const expiresAt = new Date(Date.now() + SESSION_DURATION)
    
    const session = await tx.session.create({
      data: {
        sessionToken,
        organizationId: organization.id,
        activeMLAccountId: mlAccount.id,
        expiresAt,
        ipAddress: await getClientIP(),
        userAgent: await getUserAgent()
      }
    })
    
    // Audit log within transaction
    await auditLog({
      action: AUDIT_ACTIONS.USER_LOGIN,
      entityType: 'organization',
      entityId: organization.id,
      organizationId: organization.id,
      mlAccountId: mlAccount.id,
      metadata: {
        mlUserId,
        nickname,
        siteId,
        isPrimaryLogin: true
      }
    })
    
    logger.info(`[Auth] Session created for ${nickname} (org: ${organization.id})`)
    
    return {
      id: session.id,
      organizationId: organization.id,
      primaryMLUserId: mlUserId,
      primaryNickname: nickname,
      activeMLAccountId: mlAccount.id,
      sessionToken,
      expiresAt
    }
  }, {
    isolationLevel: 'Serializable', // Prevent race conditions
    timeout: 10000, // 10 second timeout
    maxWait: 5000 // Max 5 seconds waiting for transaction slot
  })
}

/**
 * Adiciona uma nova conta ML à organização existente
 */
export async function addMLAccountToOrganization(
  organizationId: string,
  mlUserId: string,
  nickname: string,
  email: string | null,
  siteId: string,
  tokens: {
    access_token: string
    refresh_token: string
    expires_in: number
  },
  thumbnail?: string | null,
  permalink?: string | null
): Promise<string> {
  // Verifica se a organização existe
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  })
  
  if (!organization) {
    throw new Error('Organization not found')
  }
  
  // Verifica se esta conta ML já está em uso
  const existingAccount = await prisma.mLAccount.findUnique({
    where: { mlUserId }
  })
  
  if (existingAccount) {
    throw new Error(`Esta conta ML (${nickname}) já está conectada a outra organização`)
  }
  
  // Criptografa os tokens
  const encryptedAccess = encryptToken(tokens.access_token)
  const encryptedRefresh = encryptToken(tokens.refresh_token)
  
  // Adiciona a nova conta ML
  const mlAccount = await prisma.mLAccount.create({
    data: {
      mlUserId,
      nickname,
      email,
      siteId,
      thumbnail: thumbnail || null,
      permalink: permalink || null,
      isPrimary: false,
      organizationId,
      accessToken: encryptedAccess.encrypted,
      accessTokenIV: encryptedAccess.iv,
      accessTokenTag: encryptedAccess.authTag,
      refreshToken: encryptedRefresh.encrypted,
      refreshTokenIV: encryptedRefresh.iv,
      refreshTokenTag: encryptedRefresh.authTag,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000)
    }
  })
  
  // Audit log
  await auditLog({
    action: AUDIT_ACTIONS.ML_ACCOUNT_CONNECTED,
    entityType: 'ml_account',
    entityId: mlAccount.id,
    organizationId,
    metadata: {
      mlUserId,
      nickname,
      siteId,
      isPrimary: false
    }
  })
  
  logger.info(`[Auth] Added ML account ${nickname} to org ${organizationId}`)
  
  return mlAccount.id
}

/**
 * Obtém a sessão atual
 */
export async function getCurrentSession(): Promise<MLSession | null> {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('ml-agent-session')?.value
    
    if (!sessionToken) return null
    
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        organization: true
      }
    })
    
    if (!session || session.expiresAt < new Date()) {
      return null
    }
    
    return {
      id: session.id,
      organizationId: session.organizationId,
      primaryMLUserId: session.organization.primaryMLUserId || '',
      primaryNickname: session.organization.primaryNickname || '',
      activeMLAccountId: session.activeMLAccountId || session.organization.primaryMLAccountId || '',
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt
    }
  } catch (error) {
    logger.error('[Auth] Error getting session:', { error })
    return null
  }
}

/**
 * Alterna entre contas ML na sessão
 */
export async function switchMLAccount(
  sessionToken: string,
  newMLAccountId: string
): Promise<boolean> {
  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken }
    })
    
    if (!session) return false
    
    // Verifica se a conta pertence à organização
    const mlAccount = await prisma.mLAccount.findFirst({
      where: {
        id: newMLAccountId,
        organizationId: session.organizationId
      }
    })
    
    if (!mlAccount) return false
    
    // Atualiza a conta ativa na sessão
    await prisma.session.update({
      where: { sessionToken },
      data: {
        activeMLAccountId: newMLAccountId,
        updatedAt: new Date()
      }
    })
    
    logger.info(`[Auth] Switched to ML account ${mlAccount.nickname}`)
    
    return true
  } catch (error) {
    logger.error('[Auth] Error switching account:', { error })
    return false
  }
}

/**
 * Lista todas as contas ML da organização
 */
export async function getOrganizationMLAccounts(organizationId: string) {
  return prisma.mLAccount.findMany({
    where: {
      organizationId,
      isActive: true
    },
    select: {
      id: true,
      mlUserId: true,
      nickname: true,
      email: true,
      siteId: true,
      thumbnail: true,
      isPrimary: true,
      lastSyncAt: true,
      connectionError: true,
      sellerReputation: true,
      powerSellerStatus: true
    },
    orderBy: [
      { isPrimary: 'desc' },
      { nickname: 'asc' }
    ]
  })
}

/**
 * Remove uma conta ML da organização
 */
export async function removeMLAccount(
  organizationId: string,
  mlAccountId: string
): Promise<boolean> {
  try {
    const account = await prisma.mLAccount.findFirst({
      where: {
        id: mlAccountId,
        organizationId,
        isPrimary: false // Não pode remover a conta principal
      }
    })
    
    if (!account) return false
    
    // Marca como inativa ao invés de deletar (preserva histórico)
    await prisma.mLAccount.update({
      where: { id: mlAccountId },
      data: {
        isActive: false,
        connectionError: 'Account removed by user'
      }
    })
    
    // Audit log
    await auditLog({
      action: AUDIT_ACTIONS.ML_ACCOUNT_DISCONNECTED,
      entityType: 'ml_account',
      entityId: mlAccountId,
      organizationId,
      metadata: {
        mlUserId: account.mlUserId,
        nickname: account.nickname
      }
    })
    
    logger.info(`[Auth] Removed ML account ${account.nickname}`)
    
    return true
  } catch (error) {
    logger.error('[Auth] Error removing account:', { error })
    return false
  }
}

/**
 * Faz logout e limpa a sessão
 */
export async function logout(sessionToken: string): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { sessionToken }
  })
  
  if (session) {
    await prisma.session.delete({
      where: { sessionToken }
    })
    
    // Audit log
    await auditLog({
      action: AUDIT_ACTIONS.USER_LOGOUT,
      entityType: 'organization',
      entityId: session.organizationId,
      organizationId: session.organizationId
    })
  }
}

// Helper functions
async function getClientIP(): Promise<string> {
  try {
    const { headers } = await import('next/headers')
    const headersList = await headers()
    const forwardedFor = headersList.get('x-forwarded-for')
    if (forwardedFor) {
      const ips = forwardedFor.split(',')
      if (ips[0]) {
        return ips[0].trim()
      }
    }
    return headersList.get('x-real-ip') || 'unknown'
  } catch {
    return 'unknown'
  }
}

async function getUserAgent(): Promise<string> {
  try {
    const { headers } = await import('next/headers')
    const headersList = await headers()
    return headersList.get('user-agent') || 'unknown'
  } catch {
    return 'unknown'
  }
}