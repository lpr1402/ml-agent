import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { simpleQueue } from "@/lib/queue/simple-queue"
import { batchProcessor } from "@/lib/webhooks/batch-processor"

/**
 * WEBHOOK HANDLER 100% FUNCIONAL
 *
 * FLUXO OTIMIZADO:
 * 1. Recebe notificação do ML
 * 2. Valida dados básicos
 * 3. Salva no banco
 * 4. Adiciona à fila para processamento
 * 5. Responde < 200ms
 *
 * PROCESSAMENTO COMPLETO EM BACKGROUND
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const notification = await request.json()

    // Log detalhado para debug
    logger.info('[Webhook] 📨 Received notification', {
      topic: notification.topic,
      resource: notification.resource,
      user_id: notification.user_id,
      application_id: notification.application_id,
      sent: notification.sent,
      timestamp: new Date().toISOString()
    })

    console.log('[Webhook] 🎯 Processing webhook:', {
      topic: notification.topic,
      questionId: notification.resource?.split('/').pop(),
      userId: notification.user_id
    })

    // Validação básica
    if (!notification.topic || !notification.resource || !notification.user_id) {
      return NextResponse.json({
        received: true,
        error: "Missing required fields"
      })
    }

    // Por enquanto, processar apenas questions
    if (notification.topic !== 'questions') {
      logger.info(`[Webhook] Ignoring topic: ${notification.topic}`)
      return NextResponse.json({
        received: true,
        ignored: true,
        topic: notification.topic
      })
    }

    const questionId = notification.resource?.split("/").pop()
    const sellerId = String(notification.user_id)

    if (!questionId || !sellerId || sellerId === 'undefined') {
      return NextResponse.json({
        received: true,
        error: "Invalid question data"
      })
    }

    // Verificar se já existe
    const exists = await prisma.question.findUnique({
      where: { mlQuestionId: questionId },
      select: { id: true }
    })

    if (exists) {
      logger.info(`[Webhook] Question ${questionId} already exists`)
      return NextResponse.json({
        received: true,
        status: "duplicate"
      })
    }

    // Buscar conta ML
    const mlAccount = await prisma.mLAccount.findFirst({
      where: {
        mlUserId: sellerId,
        isActive: true
      },
      select: {
        id: true,
        organizationId: true
      }
    })

    if (!mlAccount) {
      logger.warn(`[Webhook] No ML account found for seller ${sellerId}`)
      return NextResponse.json({
        received: true,
        error: "Account not found"
      })
    }

    // Criar evento de webhook
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        idempotencyKey: `${questionId}-${Date.now()}`,
        eventType: 'questions',
        eventId: questionId,
        topic: notification.topic,
        resourceId: notification.resource,
        resourceUrl: notification.resource,
        userId: sellerId,
        applicationId: String(notification.application_id || ''),
        attemptId: `${questionId}-${Date.now()}`,
        sentAt: new Date(notification.sent || Date.now()),
        payload: notification,
        organizationId: mlAccount.organizationId,
        mlAccountId: mlAccount.id,
        status: 'PENDING',
        processed: false,
        receivedAt: new Date()
      }
    })

    // OTIMIZAÇÃO: Usar batch processor para reduzir carga
    // Adicionar ao batch em vez de processar imediatamente
    batchProcessor.addToBatch(mlAccount.id, {
      data: notification,
      mlAccount: {
        id: mlAccount.id,
        mlUserId: sellerId,
        organizationId: mlAccount.organizationId
      }
    })

    // Também adicionar à fila como backup
    await simpleQueue.addJob(webhookEvent.id, {
      topic: notification.topic,
      resource_id: questionId,
      resource: notification.resource,
      user_id: sellerId,
      notification: notification
    })

    // Resposta imediata
    const responseTime = Date.now() - startTime

    logger.info(`[Webhook] Queued in ${responseTime}ms`, {
      questionId,
      responseTime
    })

    return NextResponse.json({
      received: true,
      queued: true,
      time: responseTime
    })

  } catch (error: any) {
    const responseTime = Date.now() - startTime
    logger.error("[Webhook] Error", {
      error: error.message,
      time: responseTime
    })

    // SEMPRE responder OK ao ML
    return NextResponse.json({
      received: true,
      error: "Internal error",
      time: responseTime
    })
  }
}

/**
 * GET endpoint para health check
 */
export async function GET() {
  try {
    // Buscar estatísticas da queue e batch processor
    const [queueStats, batchStatus] = await Promise.all([
      simpleQueue.getStatistics(),
      Promise.resolve(batchProcessor.getStatus())
    ])

    return NextResponse.json({
      status: 'healthy',
      queue: queueStats,
      batch: batchStatus,
      timestamp: new Date().toISOString()
    })
  } catch (_error) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to get queue statistics'
    }, { status: 500 })
  }
}