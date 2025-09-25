/**
 * Token Manager para Sistema Multi-Tenant
 * Gerencia tokens do MLAccount com refresh automático
 * Compatível com webhooks e operação 24/7
 */

import { logger } from '@/lib/logger'
import { prisma } from "./prisma"
import { decryptToken, encryptToken } from "./security/encryption"
import { cache } from '@/lib/cache/cache-strategy'
import { fetchWithRateLimit } from '@/lib/api/smart-rate-limiter'

export class TokenManager {
  // Usa Redis para sincronizar refresh entre workers PM2
  // private refreshing: Map<string, Promise<string | null>> = new Map()

  constructor() {
    logger.info('[TokenManager] Initialized - Multi-tenant MLAccount System with Redis Sync')
  }

  /**
   * Obtém access token válido para um usuário ML
   * Busca primeiro no MLAccount (novo sistema multi-tenant)
   */
  async getAccessToken(mlUserId: string): Promise<string | null> {
    try {
      // Verifica se já está fazendo refresh usando Redis ao invés de Map local
      const refreshLockKey = `ml:refreshing:${mlUserId}`
      const isRefreshing = await cache.get(refreshLockKey)
      if (isRefreshing) {
        // Aguarda refresh terminar (máximo 10 segundos)
        let attempts = 0
        while (attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 500))
          const stillRefreshing = await cache.get(refreshLockKey)
          if (!stillRefreshing) break
          attempts++
        }
      }

      // CACHE: Tenta buscar token do cache primeiro
      const cacheKey = `ml:token:${mlUserId}`
      const cachedToken = await cache.get(cacheKey) as string
      if (cachedToken) {
        logger.debug(`[TokenManager] Token found in cache for ${mlUserId}`)
        return cachedToken as string
      }

      // Busca conta ML no novo sistema
      const mlAccount = await prisma.mLAccount.findFirst({
        where: { 
          mlUserId: mlUserId,
          isActive: true 
        },
        select: {
          id: true,
          nickname: true,
          accessToken: true,
          accessTokenIV: true,
          accessTokenTag: true,
          refreshToken: true,
          refreshTokenIV: true,
          refreshTokenTag: true,
          tokenExpiresAt: true
        }
      })

      if (!mlAccount) {
        logger.info(`[TokenManager] No ML account found for user ${mlUserId}`)
        return null
      }

      // Verifica se tem dados de criptografia
      if (!mlAccount.accessToken || !mlAccount.accessTokenIV || !mlAccount.accessTokenTag) {
        logger.error(`[TokenManager] Missing encryption data for ${mlAccount.nickname}`)
        return null
      }

      // Descriptografa o token
      let accessToken: string
      try {
        accessToken = decryptToken({
          encrypted: mlAccount.accessToken,
          iv: mlAccount.accessTokenIV,
          authTag: mlAccount.accessTokenTag
        })
      } catch (_error) {
        logger.error(`[TokenManager] Failed to decrypt token for ${mlAccount.nickname}:`, { _error })
        return null
      }

      // Verifica se precisa refresh (5 min antes de expirar)
      const now = new Date()
      const expirationBuffer = new Date(mlAccount.tokenExpiresAt.getTime() - 5 * 60 * 1000)
      
      if (now < expirationBuffer) {
        // Token ainda válido - adiciona ao cache
        const ttl = Math.floor((mlAccount.tokenExpiresAt.getTime() - now.getTime()) / 1000)
        await cache.mlToken(mlUserId, accessToken, ttl)
        return accessToken
      }

      // Token precisa refresh
      logger.info(`[TokenManager] Token expired for ${mlAccount.nickname}, refreshing...`)
      
      if (!mlAccount.refreshToken || !mlAccount.refreshTokenIV || !mlAccount.refreshTokenTag) {
        logger.error(`[TokenManager] Missing refresh token data for ${mlAccount.nickname}`)
        return null
      }

      // Marca como refreshing no Redis para evitar múltiplos refreshes simultâneos
      const refreshLockKey2 = `ml:refreshing:${mlUserId}`
      await cache.set(refreshLockKey2, 'true', 30) // TTL de 30 segundos para evitar lock permanente

      try {
        const newToken = await this.refreshAccessToken(mlAccount)
        return newToken
      } finally {
        // Remove flag de refreshing do Redis
        await cache.invalidate(refreshLockKey2)
      }
      
    } catch (_error) {
      logger.error(`[TokenManager] Error getting token for user ${mlUserId}:`, { _error })
      return null
    }
  }

  /**
   * Faz refresh do access token usando refresh token
   */
  private async refreshAccessToken(account: any): Promise<string | null> {
    try {
      // Descriptografa refresh token
      const refreshToken = decryptToken({
        encrypted: account.refreshToken,
        iv: account.refreshTokenIV,
        authTag: account.refreshTokenTag
      })

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
        const error = await response.text()
        logger.error(`[TokenManager] Failed to refresh token for ${account.nickname}:`, { error })
        
        // Marca conta como inativa se refresh falhar
        await prisma.mLAccount.update({
          where: { id: account.id },
          data: {
            isActive: false,
            connectionError: `Refresh failed: ${error}`
          }
        })
        
        return null
      }

      const data = await response.json()
      
      // Criptografa novos tokens
      const encryptedAccess = encryptToken(data.access_token)
      const encryptedRefresh = encryptToken(data.refresh_token)
      
      // Atualiza tokens no banco
      await prisma.mLAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encryptedAccess.encrypted,
          accessTokenIV: encryptedAccess.iv,
          accessTokenTag: encryptedAccess.authTag,
          refreshToken: encryptedRefresh.encrypted,
          refreshTokenIV: encryptedRefresh.iv,
          refreshTokenTag: encryptedRefresh.authTag,
          tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
          lastSyncAt: new Date(),
          connectionError: null
        }
      })
      
      logger.info(`[TokenManager] Successfully refreshed token for ${account.nickname}`)
      
      // CACHE: Adiciona novo token ao cache
      await cache.mlToken(account.mlUserId, data.access_token, data.expires_in)
      
      return data.access_token
      
    } catch (_error) {
      logger.error(`[TokenManager] Error refreshing token:`, { _error })
      return null
    }
  }

  /**
   * Armazena ou atualiza tokens para um usuário
   * Usado quando recebe novos tokens do OAuth
   */
  async storeTokens(data: {
    mlUserId: string
    accessToken: string
    refreshToken: string
    expiresIn: number
  }): Promise<void> {
    try {
      // Busca conta ML existente
      const mlAccount = await prisma.mLAccount.findFirst({
        where: { mlUserId: data.mlUserId }
      })

      if (!mlAccount) {
        logger.error(`[TokenManager] No ML account found to store tokens for user ${data.mlUserId}`)
        return
      }

      // Criptografa tokens
      const encryptedAccess = encryptToken(data.accessToken)
      const encryptedRefresh = encryptToken(data.refreshToken)

      // Atualiza tokens
      await prisma.mLAccount.update({
        where: { id: mlAccount.id },
        data: {
          accessToken: encryptedAccess.encrypted,
          accessTokenIV: encryptedAccess.iv,
          accessTokenTag: encryptedAccess.authTag,
          refreshToken: encryptedRefresh.encrypted,
          refreshTokenIV: encryptedRefresh.iv,
          refreshTokenTag: encryptedRefresh.authTag,
          tokenExpiresAt: new Date(Date.now() + data.expiresIn * 1000),
          lastSyncAt: new Date(),
          isActive: true,
          connectionError: null
        }
      })

      logger.info(`[TokenManager] Stored tokens for ${mlAccount.nickname}`)
    } catch (_error) {
      logger.error(`[TokenManager] Error storing tokens:`, { _error })
    }
  }

  /**
   * Remove tokens de um usuário (para logout)
   */
  async removeTokens(mlUserId: string): Promise<void> {
    try {
      await prisma.mLAccount.updateMany({
        where: { mlUserId },
        data: {
          accessToken: "",
          accessTokenIV: "",
          accessTokenTag: "",
          refreshToken: "",
          refreshTokenIV: "",
          refreshTokenTag: "",
          isActive: false,
          connectionError: "User logged out"
        }
      })
      
      logger.info(`[TokenManager] Removed tokens for user ${mlUserId}`)
    } catch (_error) {
      logger.error(`[TokenManager] Error removing tokens:`, { _error })
    }
  }

  /**
   * Verifica se usuário tem token válido
   */
  async hasValidToken(mlUserId: string): Promise<boolean> {
    const token = await this.getAccessToken(mlUserId)
    return token !== null
  }

  /**
   * Obtém todos os usuários com tokens ativos
   */
  async getAllTokenUsers(): Promise<string[]> {
    const accounts = await prisma.mLAccount.findMany({
      where: { isActive: true },
      select: { mlUserId: true }
    })
    return accounts.map(a => a.mlUserId)
  }

  /**
   * Limpa tokens expirados (executar periodicamente)
   */
  async cleanupExpiredTokens(): Promise<void> {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    
    const result = await prisma.mLAccount.updateMany({
      where: {
        lastSyncAt: { lt: sixMonthsAgo },
        isActive: false
      },
      data: {
        accessToken: "",
        accessTokenIV: "",
        accessTokenTag: "",
        refreshToken: "",
        refreshTokenIV: "",
        refreshTokenTag: ""
      }
    })
    
    if (result.count > 0) {
      logger.info(`[TokenManager] Cleaned up ${result.count} expired token(s)`)
    }
  }
}

// Singleton instance
export const tokenManager = new TokenManager()

// Helper function para compatibilidade
export async function storeUserTokens(data: {
  userId: string
  accessToken: string
  refreshToken: string
  expiresIn: number
}) {
  await tokenManager.storeTokens({
    mlUserId: data.userId,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn
  })
}

// Job de limpeza periódica
if (typeof global !== 'undefined') {
  const g = global as any
  if (!g.tokenCleanupJob) {
    g.tokenCleanupJob = setInterval(() => {
      tokenManager.cleanupExpiredTokens()
    }, 24 * 60 * 60 * 1000) // 24 horas
    
    logger.info('[TokenManager] Cleanup job scheduled')
  }
}