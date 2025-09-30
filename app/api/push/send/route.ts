/**
 * API para enviar Push Notifications
 * Envia notificações para dispositivos registrados 24/7
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Configurar VAPID keys (gerar uma vez e salvar no .env)
// Para gerar: npx web-push generate-vapid-keys
const vapidKeys = {
  publicKey: process.env['NEXT_PUBLIC_VAPID_PUBLIC_KEY'] || 'BFDQNvQB1cWQbPHStt5S6mRtVCGldecWfKMDWfyBx2HTPhvitpZdVE7kMIAQPpGawd5GN7XrzMnvfMq3n7NOM0g',
  privateKey: process.env['VAPID_PRIVATE_KEY'] || 'XqWkLgd7DvUVAd3jxglkrrqEubb2DxQm0cz5o_PnE10'
}

interface PushPayload {
  type: 'new_question' | 'batch_questions' | 'urgent_question' | 'answer_approved' | 'error'
  organizationId?: string
  mlAccountId?: string
  questionId?: string
  questionText?: string
  productTitle?: string
  productImage?: string
  sellerName?: string
  count?: number
  hours?: number
  message?: string
  url?: string
}

export async function POST(request: NextRequest) {
  try {
    // Lazy load web-push to avoid module-level side effects
    const webpush = await import('web-push')

    // Configure web-push with VAPID keys
    webpush.default.setVapidDetails(
      'mailto:support@axnexlabs.com.br',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    )

    const body = await request.json()
    const {
      payload,
      organizationId,
      subscriptionId,
      broadcast = false
    }: {
      payload: PushPayload
      organizationId?: string
      subscriptionId?: string
      broadcast?: boolean
    } = body

    // Validar payload
    if (!payload || !payload.type) {
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      )
    }

    let subscriptions

    // Buscar subscriptions
    if (subscriptionId) {
      // Enviar para subscription específica
      const subscription = await prisma.pushSubscription.findUnique({
        where: { id: subscriptionId, isActive: true }
      })
      subscriptions = subscription ? [subscription] : []

    } else if (organizationId && broadcast) {
      // Broadcast para todas as subscriptions da organização
      subscriptions = await prisma.pushSubscription.findMany({
        where: {
          organizationId,
          isActive: true,
          failureCount: { lt: 5 } // Ignorar dispositivos com muitas falhas
        }
      })

    } else {
      return NextResponse.json(
        { error: 'Organization ID or Subscription ID required' },
        { status: 400 }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      logger.warn('[Push Send] No active subscriptions found', {
        organizationId,
        subscriptionId
      })
      return NextResponse.json({
        success: false,
        message: 'No active subscriptions found',
        sent: 0
      })
    }

    // Verificar quiet hours
    const now = new Date()
    const hour = now.getHours()

    subscriptions = subscriptions.filter(sub => {
      // Se não tem quiet hours configurado, enviar sempre
      if (!sub.quietHoursStart || !sub.quietHoursEnd) return true

      // Verificar se está dentro do horário permitido
      if (sub.quietHoursStart < sub.quietHoursEnd) {
        // Horário normal (ex: 8h às 22h)
        return hour >= sub.quietHoursStart && hour < sub.quietHoursEnd
      } else {
        // Horário que atravessa meia-noite (ex: 22h às 8h = quiet time)
        return hour >= sub.quietHoursEnd || hour < sub.quietHoursStart
      }
    })

    // Filtrar por tipo de notificação
    subscriptions = subscriptions.filter(sub => {
      switch (payload.type) {
        case 'new_question':
        case 'batch_questions':
          return sub.enableQuestions
        case 'urgent_question':
          return sub.enableUrgent
        default:
          return true
      }
    })

    // Enviar notificações
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          }

          // Adicionar informações específicas da conta
          const notificationPayload = {
            ...payload,
            sellerName: payload.sellerName || 'ML Agent',
            timestamp: Date.now()
          }

          await webpush.default.sendNotification(
            pushSubscription,
            JSON.stringify(notificationPayload)
          )

          // Atualizar lastUsedAt
          await prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: {
              lastUsedAt: new Date(),
              failureCount: 0 // Reset failure count on success
            }
          })

          logger.info('[Push Sent] Notification delivered', {
            subscriptionId: subscription.id,
            type: payload.type
          })

          return { success: true, subscriptionId: subscription.id }

        } catch (error: any) {
          logger.error('[Push Send] Failed to send notification', {
            subscriptionId: subscription.id,
            error: error.message
          })

          // Tratar erros específicos
          if (error.statusCode === 410) {
            // Subscription expirou, desativar
            await prisma.pushSubscription.update({
              where: { id: subscription.id },
              data: { isActive: false }
            })
          } else {
            // Incrementar contador de falhas
            await prisma.pushSubscription.update({
              where: { id: subscription.id },
              data: {
                failureCount: { increment: 1 }
              }
            })
          }

          return { success: false, subscriptionId: subscription.id, error: error.message }
        }
      })
    )

    // Contar sucessos e falhas
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length

    logger.info('[Push Send] Batch completed', {
      organizationId,
      type: payload.type,
      sent: successful,
      failed
    })

    return NextResponse.json({
      success: true,
      message: `Push notifications sent`,
      sent: successful,
      failed,
      total: subscriptions.length
    })

  } catch (error) {
    logger.error('[Push Send] Error:', { error })
    return NextResponse.json(
      { error: 'Failed to send push notifications' },
      { status: 500 }
    )
  }
}