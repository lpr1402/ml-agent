/**
 * Profile Refresh Manager - Enterprise Grade
 * Smart polling adaptativo para dados que não têm webhook
 * Atualiza perfil do vendedor (nickname, avatar, reputação) de forma inteligente
 */

import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/security/encryption'
import { logger } from '@/lib/logger'
import { globalMLRateLimiter } from '@/lib/ml-api/global-rate-limiter'

class ProfileRefreshManager {
  private static instance: ProfileRefreshManager
  private refreshQueue = new Map<string, Promise<{ success: boolean; changes: string[]; error?: string }>>() // Previne chamadas duplicadas

  private constructor() {}

  static getInstance(): ProfileRefreshManager {
    if (!ProfileRefreshManager.instance) {
      ProfileRefreshManager.instance = new ProfileRefreshManager()
    }
    return ProfileRefreshManager.instance
  }

  /**
   * Verifica se o perfil precisa ser atualizado
   * Threshold: 6 horas
   */
  async shouldRefreshProfile(accountId: string, force: boolean = false): Promise<boolean> {
    if (force) return true

    const account = await prisma.mLAccount.findUnique({
      where: { id: accountId },
      select: {
        updatedAt: true,
        lastProfileSync: true
      }
    })

    if (!account) return false

    // Usar lastProfileSync se disponível, senão updatedAt
    const lastUpdate = account.lastProfileSync || account.updatedAt
    const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60)

    return hoursSinceUpdate >= 6 // 6 horas threshold
  }

  /**
   * Extrai avatar URL do objeto retornado pela API do ML
   */
  private extractAvatarUrl(userData: any): string | null {
    let avatarUrl = null

    if (userData.thumbnail && typeof userData.thumbnail === 'object' && userData.thumbnail.picture_url) {
      avatarUrl = userData.thumbnail.picture_url
    } else if (userData.thumbnail && typeof userData.thumbnail === 'string') {
      avatarUrl = userData.thumbnail
    } else if (userData.logo && typeof userData.logo === 'string') {
      avatarUrl = userData.logo
    }

    if (avatarUrl) {
      if (avatarUrl.startsWith('//')) {
        avatarUrl = 'https:' + avatarUrl
      } else if (!avatarUrl.startsWith('http')) {
        avatarUrl = 'https://http2.mlstatic.com' + avatarUrl
      }
    }

    return avatarUrl
  }

  /**
   * Atualiza perfil da conta com dados do ML
   * Implementa diff detection e update atômico
   */
  async refreshProfile(
    accountId: string,
    trigger: 'login' | 'webhook' | 'manual' | 'scheduled' | 'stale',
    force: boolean = false
  ): Promise<{ success: boolean; changes: string[]; error?: string }> {
    // Debounce: Se já está atualizando, retornar promise existente
    if (this.refreshQueue.has(accountId)) {
      logger.info('[ProfileRefresh] Already refreshing, waiting...', { accountId })
      await this.refreshQueue.get(accountId)
      return { success: true, changes: [] }
    }

    const refreshPromise = this._doRefresh(accountId, trigger, force)
    this.refreshQueue.set(accountId, refreshPromise)

    try {
      const result = await refreshPromise
      return result
    } finally {
      this.refreshQueue.delete(accountId)
    }
  }

  private async _doRefresh(
    accountId: string,
    trigger: string,
    force: boolean
  ): Promise<{ success: boolean; changes: string[]; error?: string }> {
    const startTime = Date.now()

    try {
      // 1. Buscar conta do banco
      const account = await prisma.mLAccount.findUnique({
        where: { id: accountId },
        include: { organization: true }
      })

      if (!account || !account.isActive) {
        return { success: false, changes: [], error: 'Account not found or inactive' }
      }

      // 2. Verificar se precisa atualizar
      if (!force && !(await this.shouldRefreshProfile(accountId, force))) {
        logger.info('[ProfileRefresh] Skipping (recently updated)', {
          accountId,
          nickname: account.nickname,
          lastUpdate: account.lastProfileSync || account.updatedAt
        })
        return { success: true, changes: [] }
      }

      // 3. Verificar token encryption data
      if (!account.accessToken || !account.accessTokenIV || !account.accessTokenTag) {
        logger.error('[ProfileRefresh] Missing token encryption data', { accountId })
        return { success: false, changes: [], error: 'Missing token data' }
      }

      // 4. Descriptografar token
      const accessToken = decryptToken({
        encrypted: account.accessToken,
        iv: account.accessTokenIV,
        authTag: account.accessTokenTag
      })

      // 5. Buscar dados do ML usando Global Rate Limiter
      logger.info('[ProfileRefresh] Fetching from ML API (via rate limiter)', {
        accountId,
        nickname: account.nickname,
        trigger
      })

      const userData = await globalMLRateLimiter.executeRequest({
        mlAccountId: accountId,
        organizationId: account.organizationId,
        endpoint: '/users/me',
        priority: trigger === 'login' ? 'high' : 'normal',
        requestFn: async () => {
          const response = await fetch('https://api.mercadolibre.com/users/me', {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          })

          if (!response.ok) {
            const error: any = new Error(`ML API returned ${response.status}`)
            error.statusCode = response.status
            throw error
          }

          return response.json()
        }
      })

      // 6. DIFF DETECTION: Comparar campos
      const changes: string[] = []
      const updates: any = {
        lastProfileSync: new Date(),
        updatedAt: new Date()
      }

      // Nickname
      if (userData.nickname && userData.nickname !== account.nickname) {
        updates.nickname = userData.nickname
        changes.push('nickname')
      }

      // Thumbnail
      const newThumbnail = this.extractAvatarUrl(userData)
      if (newThumbnail && newThumbnail !== account.thumbnail) {
        updates.thumbnail = newThumbnail
        changes.push('thumbnail')
      }

      // Email
      if (userData.email && userData.email !== account.email) {
        updates.email = userData.email
        changes.push('email')
      }

      // Seller Reputation
      if (userData.seller_reputation) {
        const rep = userData.seller_reputation

        // Level (red, orange, yellow, green)
        if (rep.level_id && rep.level_id !== account.sellerReputationLevel) {
          updates.sellerReputationLevel = rep.level_id
          changes.push('reputation_level')
        }

        // Transactions
        if (rep.transactions?.completed !== undefined) {
          updates.sellerTransactionsCompleted = rep.transactions.completed
          changes.push('transactions_completed')
        }
        if (rep.transactions?.canceled !== undefined) {
          updates.sellerTransactionsCanceled = rep.transactions.canceled
          changes.push('transactions_canceled')
        }

        // Power Seller Status
        if (rep.power_seller_status !== undefined) {
          updates.isPowerSeller = rep.power_seller_status === 'platinum' ||
                                  rep.power_seller_status === 'gold'
          changes.push('power_seller')
        }
      }

      // 7. UPDATE no banco APENAS se houver mudanças
      if (changes.length > 0 || !account.lastProfileSync) {
        await prisma.mLAccount.update({
          where: { id: accountId },
          data: updates
        })

        logger.info('[ProfileRefresh] ✅ Profile updated', {
          accountId,
          nickname: account.nickname,
          trigger,
          changes,
          latency: Date.now() - startTime
        })

        // 8. BROADCAST WebSocket se houve mudanças
        if (changes.length > 0) {
          try {
            const { emitToOrganization } = require('@/lib/websocket/emit-events')

            emitToOrganization(
              account.organizationId,
              'account:profile:updated',
              {
                accountId,
                nickname: updates.nickname || account.nickname,
                thumbnail: updates.thumbnail || account.thumbnail,
                changes,
                updatedAt: new Date()
              }
            )

            logger.info('[ProfileRefresh] WebSocket event emitted', {
              accountId,
              changes
            })
          } catch (wsError) {
            logger.warn('[ProfileRefresh] Failed to emit WebSocket', { error: wsError })
          }
        }
      } else {
        // Atualizar apenas timestamp mesmo sem mudanças
        await prisma.mLAccount.update({
          where: { id: accountId },
          data: { lastProfileSync: new Date() }
        })

        logger.info('[ProfileRefresh] ℹ️ No changes detected', {
          accountId,
          nickname: account.nickname,
          trigger,
          latency: Date.now() - startTime
        })
      }

      return { success: true, changes }

    } catch (error) {
      logger.error('[ProfileRefresh] Fatal error', {
        error,
        accountId,
        trigger,
        latency: Date.now() - startTime
      })
      return {
        success: false,
        changes: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Atualiza se os dados estiverem desatualizados (> 6h)
   */
  async refreshIfStale(accountId: string, trigger: string): Promise<void> {
    const shouldRefresh = await this.shouldRefreshProfile(accountId, false)

    if (shouldRefresh) {
      await this.refreshProfile(accountId, trigger as any, false)
    } else {
      logger.debug('[ProfileRefresh] Profile is fresh, skipping', { accountId })
    }
  }

  /**
   * Atualiza múltiplas contas em batch (com throttling)
   */
  async refreshMultipleAccounts(
    accountIds: string[],
    trigger: 'login' | 'webhook' | 'manual' | 'scheduled' | 'stale',
    delayMs: number = 30000
  ): Promise<void> {
    logger.info('[ProfileRefresh] Batch refresh started', {
      count: accountIds.length,
      trigger
    })

    for (let i = 0; i < accountIds.length; i++) {
      const accountId = accountIds[i]
      if (!accountId) continue

      await this.refreshProfile(accountId, trigger, false)

      // Delay entre contas (rate limit protection)
      if (i < accountIds.length - 1) {
        logger.info('[ProfileRefresh] Waiting before next account', {
          delayMs,
          progress: `${i + 1}/${accountIds.length}`
        })
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }

    logger.info('[ProfileRefresh] Batch refresh completed', {
      count: accountIds.length
    })
  }

  /**
   * Worker: Verifica e atualiza contas desatualizadas
   * Executar via cron ou worker dedicado
   */
  async checkAndRefreshStaleAccounts(): Promise<void> {
    try {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

      const staleAccounts = await prisma.mLAccount.findMany({
        where: {
          isActive: true,
          OR: [
            { lastProfileSync: null },
            { lastProfileSync: { lt: sixHoursAgo } }
          ]
        },
        select: {
          id: true,
          nickname: true,
          lastProfileSync: true
        },
        orderBy: {
          lastProfileSync: 'asc' // Mais antigos primeiro
        },
        take: 20 // Limitar para evitar sobrecarga
      })

      if (staleAccounts.length === 0) {
        logger.info('[ProfileRefresh] No stale accounts found')
        return
      }

      logger.info('[ProfileRefresh] Found stale accounts', {
        count: staleAccounts.length
      })

      await this.refreshMultipleAccounts(
        staleAccounts.map(a => a.id),
        'stale',
        30000 // 30s delay entre contas
      )

    } catch (error) {
      logger.error('[ProfileRefresh] Error checking stale accounts', { error })
    }
  }
}

export const profileRefreshManager = ProfileRefreshManager.getInstance()
