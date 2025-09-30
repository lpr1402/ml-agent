import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { fetchWithRateLimit } from '@/lib/api/smart-rate-limiter'
import { MLCache } from '@/lib/cache/ml-cache'

/**
 * Serviço para gerenciar avatares do Mercado Livre
 * Busca SEMPRE via API oficial do ML - sem tentativas de adivinhar URLs
 */
export class MLAvatarService {
  /**
   * Busca avatar direto da API oficial do ML
   * @param userId ID do usuário no ML
   * @param accessToken Token de acesso válido
   * @returns URL do avatar ou null
   */
  public static async fetchAvatarFromAPI(userId: string, accessToken: string): Promise<string | null> {
    try {
      // Verificar cache primeiro (evita chamadas duplicadas)
      const cacheKey = `avatar_${userId}`
      const cached = await MLCache.get<string>('USER', cacheKey)
      if (cached) {
        logger.info(`[MLAvatarService] Using cached avatar for user ${userId}`)
        return cached
      }

      // Buscar dados do usuário via API oficial
      logger.info(`[MLAvatarService] Fetching user data from ML API for ${userId}`)

      const response = await fetchWithRateLimit(
        `https://api.mercadolibre.com/users/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'User-Agent': 'ML-Agent/1.0'
          }
        },
        'users'
      )

      if (!response.ok) {
        logger.warn(`[MLAvatarService] Failed to fetch user data: ${response.status}`)
        return null
      }

      const userData = await response.json()

      // Extrair URL do avatar seguindo ordem de prioridade da API do ML
      let avatarUrl = null

      // 1. Thumbnail object (formato correto da API): { picture_id: "...", picture_url: "..." }
      if (userData.thumbnail && typeof userData.thumbnail === 'object' && userData.thumbnail.picture_url) {
        avatarUrl = userData.thumbnail.picture_url
      }
      // 2. Thumbnail string (formato legacy)
      else if (userData.thumbnail && typeof userData.thumbnail === 'string') {
        avatarUrl = userData.thumbnail
      }
      // 3. Logo (usuários empresariais)
      else if (userData.logo && typeof userData.logo === 'string') {
        avatarUrl = userData.logo
      }
      // 4. Picture object (outros formatos)
      else if (userData.picture) {
        if (typeof userData.picture === 'string') {
          avatarUrl = userData.picture
        } else if (userData.picture.url) {
          avatarUrl = userData.picture.url
        } else if (userData.picture.picture_url) {
          avatarUrl = userData.picture.picture_url
        }
      }

      if (avatarUrl) {
        // Garantir URL completa (protocol-relative URLs)
        if (avatarUrl.startsWith('//')) {
          avatarUrl = `https:${avatarUrl}`
        }
        // Se não começa com http, adicionar domínio do ML
        else if (!avatarUrl.startsWith('http')) {
          avatarUrl = `https://http2.mlstatic.com${avatarUrl}`
        }

        // Cachear por 24 horas
        await MLCache.set('USER', cacheKey, avatarUrl)

        logger.info(`[MLAvatarService] Avatar found and cached for user ${userId}`, { avatarUrl })
        return avatarUrl
      }

      logger.warn(`[MLAvatarService] No avatar found in API response for user ${userId}`)
      return null

    } catch (error) {
      logger.error(`[MLAvatarService] Error fetching avatar from API`, { userId, error })
      return null
    }
  }

  /**
   * Atualiza o avatar de uma conta ML usando a API oficial
   */
  public static async updateAccountAvatar(accountId: string): Promise<boolean> {
    try {
      const account = await prisma.mLAccount.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          mlUserId: true,
          nickname: true,
          thumbnail: true,
          accessToken: true,
          accessTokenIV: true,
          accessTokenTag: true,
          tokenExpiresAt: true
        }
      })

      if (!account || account.tokenExpiresAt <= new Date()) {
        logger.error('[MLAvatarService] Account not found or token expired', { accountId })
        return false
      }

      // Descriptografar token
      const { decryptToken } = require('@/lib/security/encryption')
      const accessToken = decryptToken({
        encrypted: account.accessToken,
        iv: account.accessTokenIV,
        authTag: account.accessTokenTag
      })

      // Buscar avatar via API oficial
      const avatarUrl = await this.fetchAvatarFromAPI(account.mlUserId, accessToken)

      if (avatarUrl) {
        // Só atualizar se mudou
        if (account.thumbnail !== avatarUrl) {
          await prisma.mLAccount.update({
            where: { id: accountId },
            data: {
              thumbnail: avatarUrl,
              updatedAt: new Date()
            }
          })

          logger.info(`[MLAvatarService] Avatar updated for ${account.nickname}`, { avatarUrl })
        } else {
          logger.info(`[MLAvatarService] Avatar unchanged for ${account.nickname}`)
        }
        return true
      } else {
        logger.warn(`[MLAvatarService] No avatar found for ${account.nickname}`)
        return false
      }
    } catch (error) {
      logger.error('[MLAvatarService] Error updating account avatar', { accountId, error })
      return false
    }
  }

  /**
   * Atualiza avatares de todas as contas de uma organização
   * Usa batching para evitar múltiplas chamadas à API
   */
  public static async updateOrganizationAvatars(organizationId: string): Promise<void> {
    try {
      const accounts = await prisma.mLAccount.findMany({
        where: {
          organizationId,
          isActive: true
        },
        select: {
          id: true,
          nickname: true,
          mlUserId: true
        }
      })

      logger.info(`[MLAvatarService] Updating avatars for ${accounts.length} accounts`)

      // Processar sequencialmente para evitar rate limiting
      // Mas usar cache para evitar chamadas duplicadas
      let successful = 0
      let failed = 0

      for (const account of accounts) {
        try {
          const result = await this.updateAccountAvatar(account.id)
          if (result) successful++
          else failed++

          // Pequeno delay para respeitar rate limits
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          logger.error(`[MLAvatarService] Failed to update avatar for ${account.nickname}`, { error })
          failed++
        }
      }

      logger.info(`[MLAvatarService] Avatar update complete`, {
        successful,
        failed,
        total: accounts.length
      })
    } catch (error) {
      logger.error('[MLAvatarService] Error updating organization avatars', { organizationId, error })
    }
  }

  /**
   * Obtém a URL do avatar com fallback
   */
  public static getAvatarUrl(thumbnail: string | null | undefined): string | null {
    if (!thumbnail) return null

    // Se é uma URL completa válida, usar direto
    if (thumbnail.startsWith('http://') || thumbnail.startsWith('https://')) {
      return thumbnail
    }

    // Se for um caminho relativo do ML, adicionar o domínio
    if (thumbnail.startsWith('/')) {
      return `https://http2.mlstatic.com${thumbnail}`
    }

    // Se não parece ser uma URL válida, retornar null
    if (thumbnail.length < 10 || !thumbnail.includes('.')) {
      return null
    }

    return thumbnail
  }
}