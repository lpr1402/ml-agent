/**
 * Session Store para Sistema Multi-Tenant
 * Gerencia sessões e tokens em memória
 * Integrado com MLAccount (novo sistema)
 */

import { logger } from '@/lib/logger'
import { prisma } from "./prisma"
import { decryptToken } from "./security/encryption"
import { fetchWithRateLimit } from '@/lib/api/smart-rate-limiter'

interface SessionData {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  userId: string
  nickname: string
  mlAccountId?: string
  organizationId?: string
}

class SessionStore {
  private sessions: Map<string, SessionData> = new Map()
  
  constructor() {
    logger.info(`[SessionStore] Initialized - Multi-tenant MLAccount System`)
    this.loadActiveSessions()
  }
  
  /**
   * Carrega sessões ativas do banco na inicialização
   */
  private async loadActiveSessions() {
    try {
      const activeAccounts = await prisma.mLAccount.findMany({
        where: {
          isActive: true,
          tokenExpiresAt: { gt: new Date() }
        }
      })

      for (const account of activeAccounts) {
        if (account.accessToken && account.accessTokenIV && account.accessTokenTag) {
          try {
            const accessToken = decryptToken({
              encrypted: account.accessToken,
              iv: account.accessTokenIV,
              authTag: account.accessTokenTag
            })
            
            const refreshToken = account.refreshToken && account.refreshTokenIV && account.refreshTokenTag
              ? decryptToken({
                  encrypted: account.refreshToken,
                  iv: account.refreshTokenIV,
                  authTag: account.refreshTokenTag
                })
              : ""

            this.sessions.set(account.mlUserId, {
              accessToken,
              refreshToken,
              expiresAt: account.tokenExpiresAt,
              userId: account.mlUserId,
              nickname: account.nickname,
              mlAccountId: account.id,
              organizationId: account.organizationId
            })

            logger.info(`[SessionStore] Loaded session for ${account.nickname} (${account.mlUserId})`)
          } catch {
            logger.error(`[SessionStore] Failed to decrypt token for ${account.nickname}`)
          }
        }
      }

      logger.info(`[SessionStore] Loaded ${this.sessions.size} active sessions`)
    } catch (error) {
      logger.error('[SessionStore] Error loading sessions:', { error })
    }
  }
  
  // Store session data for a user
  setSession(userId: string, data: {
    accessToken: string
    refreshToken: string
    expiresIn: number
    nickname: string
  }) {
    const expiresAt = new Date(Date.now() + (data.expiresIn * 1000))
    
    this.sessions.set(userId, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt,
      userId,
      nickname: data.nickname
    })
    
    logger.info(`[SessionStore] Stored session for user ${userId} (${data.nickname}), expires at ${expiresAt}`)
  }
  
  // Get access token for a user
  async getAccessToken(userId: string): Promise<string | null> {
    const session = this.sessions.get(userId)
    
    if (!session) {
      logger.info(`[SessionStore] No session found for user ${userId}`)
      logger.info(`[SessionStore] Active sessions:`, { data: this.getActiveSessions() })
      return null
    }
    
    // Check if token is expired
    if (new Date() >= session.expiresAt) {
      logger.info(`[SessionStore] Token expired for user ${userId}, attempting refresh...`)
      
      // In production, refresh the token here
      const refreshed = await this.refreshAccessToken(userId, session.refreshToken)
      if (refreshed) {
        return refreshed.accessToken
      }
      
      // If refresh fails, remove session
      this.sessions.delete(userId)
      return null
    }
    
    return session.accessToken
  }
  
  // Refresh access token usando novo sistema
  private async refreshAccessToken(userId: string, refreshToken: string): Promise<{ accessToken: string } | null> {
    try {
      // Usar fetchWithRateLimit para evitar erro 429
      const response = await fetchWithRateLimit(
        "https://api.mercadolibre.com/oauth/token",
        {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: process.env['ML_CLIENT_ID']!,
            client_secret: process.env['ML_CLIENT_SECRET']!,
            refresh_token: refreshToken
          })
        },
        'oauth/token'
      )
      
      if (!response.ok) {
        logger.error(`[SessionStore] Failed to refresh token for user ${userId}`)
        return null
      }
      
      const data = await response.json()
      
      // Update session with new tokens
      const session = this.sessions.get(userId)
      if (session) {
        this.setSession(userId, {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
          nickname: session.nickname
        })
        
        // Atualiza no banco também (novo sistema)
        const { encryptToken } = await import("./security/encryption")
        const encryptedAccess = encryptToken(data.access_token)
        const encryptedRefresh = encryptToken(data.refresh_token)
        
        await prisma.mLAccount.updateMany({
          where: { mlUserId: userId },
          data: {
            accessToken: encryptedAccess.encrypted,
            accessTokenIV: encryptedAccess.iv,
            accessTokenTag: encryptedAccess.authTag,
            refreshToken: encryptedRefresh.encrypted,
            refreshTokenIV: encryptedRefresh.iv,
            refreshTokenTag: encryptedRefresh.authTag,
            tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
            lastSyncAt: new Date()
          }
        })
      }
      
      return { accessToken: data.access_token }
    } catch (error) {
      logger.error(`[SessionStore] Error refreshing token for user ${userId}:`, { error })
      return null
    }
  }
  
  // Remove session
  removeSession(userId: string) {
    this.sessions.delete(userId)
    logger.info(`[SessionStore] Removed session for user ${userId}`)
  }
  
  // Check if user has active session
  hasSession(userId: string): boolean {
    return this.sessions.has(userId)
  }
  
  // Get all active sessions (for monitoring)
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys())
  }
}

// Singleton instance
export const sessionStore = new SessionStore()

// Helper function to store session from auth callback
export function storeUserSession(userData: {
  userId: string
  accessToken: string
  refreshToken: string
  expiresIn: number
  nickname: string
}) {
  sessionStore.setSession(userData.userId, {
    accessToken: userData.accessToken,
    refreshToken: userData.refreshToken,
    expiresIn: userData.expiresIn,
    nickname: userData.nickname
  })
}