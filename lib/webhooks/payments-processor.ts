/**
 * Payments Webhook Processor - Enterprise Grade
 * Processa notificações de pagamentos
 * Atualiza status de pagamento em real-time
 */

import { logger } from '@/lib/logger'
import { decryptToken } from '@/lib/security/encryption'

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
  accessToken?: string
  accessTokenIV?: string
  accessTokenTag?: string
}

export async function processPaymentWebhook(
  data: WebhookData,
  mlAccount: MLAccountInfo
): Promise<void> {
  try {
    const paymentId = data.resource.split('/').pop()

    if (!paymentId) {
      logger.warn('[PaymentWebhook] No payment ID in resource', { resource: data.resource })
      return
    }

    logger.info('[PaymentWebhook] Processing payment change', {
      paymentId,
      accountId: mlAccount.id
    })

    // 🎯 Buscar dados do pagamento do ML (opcional mas útil)
    let paymentData: any = null

    try {
      if (mlAccount.accessToken && mlAccount.accessTokenIV && mlAccount.accessTokenTag) {
        const token = decryptToken({
          encrypted: mlAccount.accessToken,
          iv: mlAccount.accessTokenIV,
          authTag: mlAccount.accessTokenTag
        })

        const response = await fetch(`https://api.mercadolibre.com${data.resource}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        })

        if (response.ok) {
          paymentData = await response.json()

          logger.info('[PaymentWebhook] Payment data fetched', {
            paymentId,
            status: paymentData.status,
            amount: paymentData.transaction_amount
          })
        }
      }
    } catch (fetchError) {
      logger.warn('[PaymentWebhook] Failed to fetch payment details', {
        error: fetchError,
        paymentId
      })
    }

    // 📡 Emit WebSocket event para UI
    try {
      const { emitToOrganization } = require('@/lib/websocket/emit-events')

      emitToOrganization(
        mlAccount.organizationId,
        'payment:updated',
        {
          paymentId,
          accountId: mlAccount.id,
          paymentData: paymentData ? {
            id: paymentData.id,
            status: paymentData.status,
            amount: paymentData.transaction_amount,
            dateApproved: paymentData.date_approved
          } : null,
          updatedAt: new Date(),
          trigger: 'webhook'
        }
      )

      logger.info('[PaymentWebhook] WebSocket event emitted', {
        paymentId,
        organizationId: mlAccount.organizationId
      })
    } catch (wsError) {
      logger.warn('[PaymentWebhook] Failed to emit WebSocket', { error: wsError })
    }

    logger.info('[PaymentWebhook] ✅ Payment webhook processed', { paymentId })

  } catch (error) {
    logger.error('[PaymentWebhook] Processing error', {
      error,
      resource: data.resource
    })
    throw error
  }
}
