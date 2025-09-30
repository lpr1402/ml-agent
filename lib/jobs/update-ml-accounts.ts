/**
 * Job de Atualização de Contas ML
 * Atualiza dados das contas a cada 3 horas para manter cache sempre válido
 * Garante operação 24/7 sem necessidade de re-autenticação
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { MLCache } from '@/lib/cache/ml-cache'
import { decryptToken } from '@/lib/security/encryption'
import { fetchWithRateLimit } from '@/lib/api/smart-rate-limiter'

export class MLAccountsUpdater {
  private static instance: MLAccountsUpdater
  private updateInterval: NodeJS.Timeout | null = null
  private isUpdating = false

  // Singleton para garantir apenas uma instância
  static getInstance(): MLAccountsUpdater {
    if (!MLAccountsUpdater.instance) {
      MLAccountsUpdater.instance = new MLAccountsUpdater()
    }
    return MLAccountsUpdater.instance
  }

  /**
   * Inicia o job de atualização periódica
   */
  start() {
    // Executar imediatamente na inicialização
    this.updateAllAccounts()

    // Agendar para executar a cada 3 horas
    this.updateInterval = setInterval(() => {
      this.updateAllAccounts()
    }, 3 * 60 * 60 * 1000) // 3 horas

    logger.info('[MLAccountsUpdater] Started - updating every 3 hours')
  }

  /**
   * Para o job de atualização
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
      logger.info('[MLAccountsUpdater] Stopped')
    }
  }

  /**
   * Atualiza dados de todas as contas ativas
   */
  async updateAllAccounts() {
    if (this.isUpdating) {
      logger.info('[MLAccountsUpdater] Already updating, skipping...')
      return
    }

    this.isUpdating = true
    const startTime = Date.now()

    try {
      logger.info('[MLAccountsUpdater] Starting update of all ML accounts')

      // Buscar todas as contas ativas
      const accounts = await prisma.mLAccount.findMany({
        where: { isActive: true },
        select: {
          id: true,
          mlUserId: true,
          nickname: true,
          accessToken: true,
          accessTokenIV: true,
          accessTokenTag: true,
          organizationId: true
        }
      })

      logger.info(`[MLAccountsUpdater] Found ${accounts.length} active accounts to update`)

      let updated = 0
      let failed = 0

      // Atualizar cada conta
      for (const account of accounts) {
        try {
          await this.updateSingleAccount(account)
          updated++

          // Delay entre atualizações para respeitar rate limit
          if (updated < accounts.length) {
            await new Promise(resolve => setTimeout(resolve, 500)) // 500ms entre contas
          }
        } catch (error) {
          failed++
          logger.error(`[MLAccountsUpdater] Failed to update account ${account.nickname}:`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      const duration = Date.now() - startTime
      logger.info(`[MLAccountsUpdater] Update completed in ${duration}ms`, {
        total: accounts.length,
        updated,
        failed,
        successRate: `${((updated / accounts.length) * 100).toFixed(1)}%`
      })

    } catch (error) {
      logger.error('[MLAccountsUpdater] Fatal error during update:', { error })
    } finally {
      this.isUpdating = false
    }
  }

  /**
   * Atualiza dados de uma única conta
   */
  private async updateSingleAccount(account: any) {
    try {
      // Verificar se tem dados de criptografia
      if (!account.accessToken || !account.accessTokenIV || !account.accessTokenTag) {
        logger.warn(`[MLAccountsUpdater] Missing encryption data for ${account.nickname}`)
        return
      }

      // Descriptografar token
      const accessToken = decryptToken({
        encrypted: account.accessToken,
        iv: account.accessTokenIV,
        authTag: account.accessTokenTag
      })

      // Buscar dados atualizados do usuário
      const response = await fetchWithRateLimit(
        `https://api.mercadolibre.com/users/${account.mlUserId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'ML-Agent/1.0'
          }
        },
        'users'
      )

      if (!response.ok) {
        if (response.status === 401) {
          logger.warn(`[MLAccountsUpdater] Token expired for ${account.nickname}`)
          // Token expirado - será renovado pelo TokenRefreshManager
        } else {
          logger.warn(`[MLAccountsUpdater] Failed to fetch user data for ${account.nickname}: ${response.status}`)
        }
        return
      }

      const userData = await response.json()

      // Atualizar cache (3 horas)
      await MLCache.set('USER', account.mlUserId, userData)

      // Atualizar dados no banco se mudaram
      const updateData: any = {}

      if (userData.nickname && userData.nickname !== account.nickname) {
        updateData.nickname = userData.nickname
      }

      // Extract thumbnail with same priority as OAuth: thumbnail > logo > picture
      let newThumbnail = null

      // Priority 1: thumbnail field
      if (userData.thumbnail) {
        if (typeof userData.thumbnail === 'string') {
          newThumbnail = userData.thumbnail
        } else if (userData.thumbnail.picture_url) {
          newThumbnail = userData.thumbnail.picture_url
        }
      }

      // Priority 2: logo field (business accounts)
      if (!newThumbnail && userData.logo) {
        newThumbnail = userData.logo
      }

      // Priority 3: picture field (older API format)
      if (!newThumbnail && userData.picture) {
        if (typeof userData.picture === 'string') {
          newThumbnail = userData.picture
        } else if (userData.picture.url) {
          newThumbnail = userData.picture.url
        }
      }

      // Ensure full URL format and update if different
      if (newThumbnail) {
        if (!newThumbnail.startsWith('http')) {
          newThumbnail = `https:${newThumbnail}`
        }
        // Only update if actually changed
        if (newThumbnail !== account.thumbnail) {
          updateData.thumbnail = newThumbnail
        }
      }

      if (userData.email) {
        updateData.email = userData.email
      }

      if (userData.site_id) {
        updateData.siteId = userData.site_id
      }

      // Atualizar banco se houver mudanças
      if (Object.keys(updateData).length > 0) {
        await prisma.mLAccount.update({
          where: { id: account.id },
          data: updateData
        })

        logger.info(`[MLAccountsUpdater] Updated account ${account.nickname}:`, {
          changes: Object.keys(updateData)
        })
      }

      logger.debug(`[MLAccountsUpdater] Successfully updated ${account.nickname}`)

    } catch (error) {
      logger.error(`[MLAccountsUpdater] Error updating account ${account.nickname}:`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Força atualização de uma conta específica
   */
  async updateAccount(mlAccountId: string): Promise<boolean> {
    try {
      const account = await prisma.mLAccount.findUnique({
        where: { id: mlAccountId },
        select: {
          id: true,
          mlUserId: true,
          nickname: true,
          accessToken: true,
          accessTokenIV: true,
          accessTokenTag: true,
          organizationId: true
        }
      })

      if (!account) {
        logger.warn(`[MLAccountsUpdater] Account not found: ${mlAccountId}`)
        return false
      }

      await this.updateSingleAccount(account)
      return true

    } catch (error) {
      logger.error(`[MLAccountsUpdater] Error updating account ${mlAccountId}:`, { error })
      return false
    }
  }
}

// Exportar singleton
export const mlAccountsUpdater = MLAccountsUpdater.getInstance()