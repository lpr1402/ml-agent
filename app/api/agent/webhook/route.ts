import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'

// Webhook endpoint for N8N AI agent responses
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.info('[Webhook N8N] Received AI response:', {
      mlQuestionId: body.mlQuestionId,
      hasAnswer: !!body.answer,
      timestamp: new Date().toISOString()
    })

    // Validate required fields
    if (!body.mlQuestionId || !body.answer) {
      return NextResponse.json(
        { error: "Missing required fields: mlQuestionId, answer" },
        { status: 400 }
      )
    }

    // Find the question in database
    const question = await prisma.question.findFirst({
      where: {
        mlQuestionId: String(body.mlQuestionId)
      },
      include: {
        mlAccount: true
      }
    })

    if (!question) {
      logger.warn(`[Webhook N8N] Question not found: ${body.mlQuestionId}`)
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      )
    }

    // Update question with AI response
    await prisma.question.update({
      where: { id: question.id },
      data: {
        aiSuggestion: body.answer,
        status: 'AWAITING_APPROVAL',
        processedAt: new Date(),
        aiProcessedAt: new Date()
      }
    })

    // Emit WebSocket event for real-time update
    const {
      emitQuestionProcessed,
      emitAnswerReceived
    } = require('@/lib/websocket/emit-events.js')

    // Emit that AI processed the question
    await emitQuestionProcessed(
      question.mlQuestionId,
      body.answer,
      question.mlAccount.organizationId
    )

    // Emit answer received event for UI update
    await emitAnswerReceived(
      question.mlQuestionId,
      {
        answer: body.answer,
        status: 'AWAITING_APPROVAL',
        confidence: body.confidence || 0.95
      },
      question.mlAccount.organizationId
    )

    // Send WhatsApp notification with unique link
    try {
      const { evolutionWhatsAppService } = await import('@/lib/services/evolution-whatsapp')

      // 🎯 Construir URL de aprovação
      const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'https://gugaleo.axnexlabs.com.br'
      const approvalUrl = `${baseUrl}/agente?source=whatsapp&utm_medium=notification`

      const notificationData = {
        sequentialId: question.sequentialId || '00/0000', // ✅ Usar ID salvo no banco
        questionText: question.text || '',
        productTitle: question.itemTitle || 'Produto',
        productPrice: question.itemPrice || 0,
        suggestedAnswer: body.answer,
        approvalUrl: approvalUrl,
        sellerName: question.mlAccount.nickname,
        questionId: question.id,
        mlAccountId: question.mlAccount.id,
        organizationId: question.mlAccount.organizationId
      }

      const sent = await evolutionWhatsAppService.sendQuestionNotification(notificationData)

      if (sent) {
        logger.info('[Webhook N8N] ✅ WhatsApp notification sent with unique link')
      } else {
        logger.warn('[Webhook N8N] Failed to send WhatsApp notification')
      }
    } catch (notifError) {
      logger.error('[Webhook N8N] Failed to send WhatsApp notification:', { notifError })
    }

    // Send browser notification (will be handled by frontend via WebSocket)
    // The frontend will receive the WebSocket event and show the notification

    // Update metrics (will be created/updated by scheduled jobs)
    logger.info('[Webhook N8N] Metrics will be updated by scheduled job')

    logger.info(`[Webhook N8N] Successfully processed AI response for question ${question.mlQuestionId}`)

    return NextResponse.json({
      success: true,
      mlQuestionId: body.mlQuestionId,
      questionId: question.id,
      processed: true,
      status: 'AWAITING_APPROVAL',
      requiresApproval: true,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error("[Webhook N8N] Error processing webhook:", { error })
    return NextResponse.json(
      { error: "Failed to process webhook", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}