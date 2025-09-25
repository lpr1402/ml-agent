import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * Serviço para gerenciar avatares do Mercado Livre
 */
export class MLAvatarService {
  /**
   * Padrões de URL de avatar do ML por site
   */
  private static getAvatarPatterns(userId: string, siteId: string): string[] {
    const patterns = [
      // Padrão universal que funciona para a maioria dos usuários
      `https://mla-s2-p.mlstatic.com/${userId}-R-original.jpg`,
      `https://http2.mlstatic.com/storage/users-avatar-shrine/v1/user_${userId}.jpg`,
      `https://http2.mlstatic.com/D_${userId}_100X100.jpg`,
    ]

    // Adicionar padrões específicos por país
    if (siteId === 'MLB') {
      patterns.push(
        `https://mlb-s2-p.mlstatic.com/${userId}-R-original.jpg`,
        `https://perfil.mercadolivre.com.br/api/user_picture/${userId}`
      )
    } else if (siteId === 'MLA') {
      patterns.push(
        `https://mla-s2-p.mlstatic.com/${userId}-R-original.jpg`,
        `https://perfil.mercadolibre.com.ar/api/user_picture/${userId}`
      )
    } else if (siteId === 'MLM') {
      patterns.push(
        `https://mlm-s2-p.mlstatic.com/${userId}-R-original.jpg`,
        `https://perfil.mercadolibre.com.mx/api/user_picture/${userId}`
      )
    }

    return patterns
  }

  /**
   * Verifica se uma URL de avatar existe e é válida
   */
  private static async checkAvatarUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0'
        },
        signal: AbortSignal.timeout(3000) // Timeout de 3 segundos
      })

      return response.ok || response.status === 200
    } catch {
      return false
    }
  }

  /**
   * Encontra uma URL de avatar válida para um usuário
   */
  public static async findAvatarUrl(userId: string, siteId: string): Promise<string | null> {
    const patterns = this.getAvatarPatterns(userId, siteId)

    for (const url of patterns) {
      const isValid = await this.checkAvatarUrl(url)
      if (isValid) {
        logger.info(`[MLAvatarService] Found valid avatar URL for user ${userId}`, { url })
        return url
      }
    }

    logger.warn(`[MLAvatarService] No avatar found for user ${userId}`)
    return null
  }

  /**
   * Atualiza o avatar de uma conta ML
   */
  public static async updateAccountAvatar(accountId: string): Promise<boolean> {
    try {
      const account = await prisma.mLAccount.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          mlUserId: true,
          siteId: true,
          nickname: true,
          thumbnail: true
        }
      })

      if (!account) {
        logger.error('[MLAvatarService] Account not found', { accountId })
        return false
      }

      // Se já tem thumbnail válido, verificar se ainda funciona
      if (account.thumbnail) {
        const isValid = await this.checkAvatarUrl(account.thumbnail)
        if (isValid) {
          logger.info(`[MLAvatarService] Existing avatar is valid for ${account.nickname}`)
          return true
        }
      }

      // Buscar novo avatar
      const avatarUrl = await this.findAvatarUrl(account.mlUserId, account.siteId || 'MLB')

      if (avatarUrl) {
        await prisma.mLAccount.update({
          where: { id: accountId },
          data: { thumbnail: avatarUrl }
        })

        logger.info(`[MLAvatarService] Updated avatar for ${account.nickname}`, { avatarUrl })
        return true
      } else {
        // Limpar thumbnail inválido
        await prisma.mLAccount.update({
          where: { id: accountId },
          data: { thumbnail: null }
        })

        logger.warn(`[MLAvatarService] No avatar found for ${account.nickname}, cleared thumbnail`)
        return false
      }
    } catch (error) {
      logger.error('[MLAvatarService] Error updating account avatar', { accountId, error })
      return false
    }
  }

  /**
   * Atualiza avatares de todas as contas de uma organização
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
          nickname: true
        }
      })

      logger.info(`[MLAvatarService] Updating avatars for ${accounts.length} accounts`)

      // Atualizar avatares em paralelo mas com limite para evitar rate limiting
      const results = await Promise.allSettled(
        accounts.map(account => this.updateAccountAvatar(account.id))
      )

      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length
      const failed = results.filter(r => r.status === 'rejected' || !r.value).length

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