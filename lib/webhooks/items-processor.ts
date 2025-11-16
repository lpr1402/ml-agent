/**
 * Items Webhook Processor - Enterprise Grade
 * Processa notificações de mudanças em items (produtos)
 * Atualiza cache local e dispara refresh de perfil se necessário
 */

import { logger } from '@/lib/logger'
import { profileRefreshManager } from '@/lib/ml-api/profile-refresh-manager'

interface WebhookData {
  resource: string
  user_id: string | number
  topic: string
  application_id?: string | number
  sent?: string
  received?: string
}

interface MLAccountInfo {
  id: string
  mlUserId: string
  organizationId: string
  siteId: string
}

export async function processItemWebhook(
  data: WebhookData,
  mlAccount: MLAccountInfo
): Promise<void> {
  try {
    const itemId = data.resource.split('/').pop()

    if (!itemId) {
      logger.warn('[ItemWebhook] No item ID in resource', { resource: data.resource })
      return
    }

    logger.info('[ItemWebhook] Processing item change', {
      itemId,
      accountId: mlAccount.id,
      nickname: (mlAccount as any).nickname || 'N/A'
    })

    // 🎯 ESTRATÉGIA: Não fazemos cache de items aqui
    // Items são buscados on-demand quando usuário acessa a página
    // MAS: aproveitamos para atualizar perfil do vendedor

    // Trigger: Profile refresh SE estiver stale (> 6h)
    // Item mudou → vendedor pode ter mudado nickname/avatar também
    await profileRefreshManager.refreshIfStale(mlAccount.id, 'webhook')

    // 📡 Emit WebSocket event para UI
    try {
      const { emitToOrganization } = require('@/lib/websocket/emit-events')

      emitToOrganization(
        mlAccount.organizationId,
        'item:updated',
        {
          itemId,
          accountId: mlAccount.id,
          updatedAt: new Date(),
          trigger: 'webhook'
        }
      )

      logger.info('[ItemWebhook] WebSocket event emitted', {
        itemId,
        organizationId: mlAccount.organizationId
      })
    } catch (wsError) {
      logger.warn('[ItemWebhook] Failed to emit WebSocket', { error: wsError })
    }

    logger.info('[ItemWebhook] ✅ Item webhook processed', { itemId })

  } catch (error) {
    logger.error('[ItemWebhook] Processing error', {
      error,
      resource: data.resource
    })
    throw error
  }
}
