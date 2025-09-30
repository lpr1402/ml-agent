import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
// Removido: import de whatsapp-professional - usando apenas Zapster
import { zapsterService } from "@/lib/services/zapster-whatsapp"

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    logger.info("🤖 N8N Response received:", { payload })
    
    // N8N envia output e question-id (com hífen)
    const output = payload.output
    const questionId = payload['question-id'] || payload.questionid // Aceitar ambos formatos
    
    if (!output || !questionId) {
      return NextResponse.json({ 
        error: "Missing output or question-id",
        received: { output: !!output, questionId: !!questionId }
      }, { status: 400 })
    }
    
    // Update question with AI response
    const question = await prisma.question.update({
      where: { mlQuestionId: questionId },
      data: {
        aiSuggestion: output,
        aiProcessedAt: new Date(),
        status: "AWAITING_APPROVAL"
      },
      include: {
        mlAccount: {
          select: {
            id: true,
            mlUserId: true,
            nickname: true,
            organizationId: true
          }
        }
      }
    }) as any // Type assertion to include all fields

    // Buscar dados completos da conta ML e organização
    const mlAccount = await prisma.mLAccount.findUnique({
      where: { id: question.mlAccountId },
      include: {
        organization: true
      }
    })
    
    if (!mlAccount) {
      throw new Error("ML Account not found")
    }

    // Emitir evento WebSocket para atualização em tempo real (status mudou de PROCESSING para AWAITING_APPROVAL)
    try {
      const { emitQuestionAwaitingApproval } = require('@/lib/websocket/emit-events.js')

      console.log('[N8N Response] About to emit WebSocket event for AI response:', {
        questionId: question.mlQuestionId,
        status: question.status,
        organizationId: question.mlAccount?.organizationId || mlAccount?.organizationId
      })

      // Emitir evento de pergunta aguardando aprovação com organizationId
      emitQuestionAwaitingApproval(
        question.mlQuestionId,
        output,
        question.mlAccount?.organizationId || mlAccount?.organizationId
      )

      console.log('[N8N Response] ✅ WebSocket event emitted for AI response')
      logger.info('[N8N Response] WebSocket event emitted', {
        questionId: question.mlQuestionId,
        status: question.status,
        type: 'question:awaiting_approval'
      })
    } catch (wsError) {
      console.error('[N8N Response] WebSocket error:', wsError)
      logger.warn('[N8N Response] Failed to emit WebSocket event', { error: wsError })
    }
    
    // Update user metrics if exists (campo mlUserId não existe diretamente em question)
    // Skipar por agora pois UserMetrics usa userId, não mlUserId
    
    // Get product image
    let productImage: string | undefined
    try {
      const itemResponse = await fetch(`https://api.mercadolibre.com/items/${question.itemId}`)
      if (itemResponse.ok) {
        const itemData = await itemResponse.json()
        productImage = itemData.pictures?.[0]?.url || itemData.thumbnail
      }
    } catch (error) {
      logger.info("Could not fetch product image:", { error })
    }
    
    // Send WhatsApp notification with SECURE token-based approval
    try {
      // Gerar token único para aprovação segura
      const { approvalTokenService } = await import('@/lib/services/approval-token-service')
      const approvalToken = await approvalTokenService.createToken({
        questionId: question.id,
        mlAccountId: mlAccount.id,
        organizationId: mlAccount.organizationId,
        expiresInHours: 24, // Link válido por 24 horas
        userAgent: 'N8N-Webhook'
      })

      // URL de aprovação com token único
      const approvalUrl = approvalTokenService.generateApprovalUrl(approvalToken)
      
      logger.info("📱 Sending WhatsApp notification with secure token", {
        seller: mlAccount.nickname,
        questionId: question.id,
        mlQuestionId: question.mlQuestionId,
        tokenPrefix: approvalToken.substring(0, 8)
      })
      
      // Removido: notificação WhatsApp antiga - usando apenas Zapster abaixo

      // NOTIFICAÇÃO via Zapster WhatsApp
      try {
        logger.info('[📢 Zapster] Preparando envio de notificação WhatsApp', {
          questionId,
          seller: mlAccount.nickname,
          hasImage: !!productImage,
          approvalUrl
        })

        const zapsterPayload: any = {
          sequentialId: question.sequentialId || '00/0000', // Usar ID salvo no banco
          questionText: question.text,
          productTitle: question.itemTitle || "Produto",
          productPrice: question.itemPrice || 0,
          productImage,
          suggestedAnswer: output,
          approvalUrl,
          customerName: 'Cliente',
          sellerName: mlAccount.nickname || 'Vendedor',
          questionId: question.id, // Passar o ID da pergunta para usar o sequentialId salvo
          mlAccountId: mlAccount.id,
          organizationId: mlAccount.organizationId
        }

        if (mlAccount.organization?.primaryNickname) {
          zapsterPayload.organizationName = mlAccount.organization.primaryNickname
        }

        const zapsterResult = await zapsterService.sendQuestionNotification(zapsterPayload)

        if (zapsterResult) {
          logger.info('[📢 Zapster] ✅ WhatsApp notification ENVIADA COM SUCESSO!', {
            questionId,
            seller: mlAccount.nickname,
            mlQuestionId: question.mlQuestionId
          })
        } else {
          logger.error('[📢 Zapster] ❌ FALHA ao enviar WhatsApp notification', {
            questionId,
            seller: mlAccount.nickname
          })
        }
      } catch (error) {
        logger.error('[Zapster] ERRO CRÍTICO ao enviar WhatsApp notification', {
          error,
          questionId,
          stack: error instanceof Error ? error.stack : undefined
        })
      }

      // NOTIFICAÇÃO ADICIONAL 2: Browser Notification via WebSocket
      // Enviar evento especial para trigger notificação no browser de quem está logado
      try {
        const browserNotificationEvent = {
          title: `🔔 ${mlAccount.nickname}`,
          body: `Pergunta Recebida: ${question.text.substring(0, 100)}...\n\n🤖 IA já preparou uma resposta!`,
          icon: '/mlagent-logo-3d.svg',
          badge: '/mlagent-logo-3d.svg',
          tag: `question-${question.mlQuestionId}`,
          requireInteraction: true,
          approvalUrl: approvalUrl,
          questionId: question.id,
          mlQuestionId: question.mlQuestionId,
          data: {
            questionId: question.id,
            mlQuestionId: question.mlQuestionId,
            approvalUrl,
            productTitle: question.itemTitle || 'Produto',
            productImage,
            aiResponse: output.substring(0, 200)
          }
        }

        const { emitToMLAccount } = require('@/lib/websocket/emit-events.js')
        await emitToMLAccount(mlAccount.id, 'browser:notification', browserNotificationEvent)

        logger.info('[🔔 Browser] Notification event sent via WebSocket', {
          questionId,
          organizationId: mlAccount.organizationId
        })
      } catch (error) {
        logger.warn('[Browser] Failed to send browser notification event', { error })
      }
      
      // Armazenar dados para notificação via SSE/WebSocket
      const notificationPayload = {
        type: 'new_question',
        questionId: question.id,
        mlQuestionId: question.mlQuestionId,
        sequentialId: parseInt(question.id.slice(-6), 16) || 0,
        questionText: question.text,
        aiResponse: output,
        productTitle: question.itemTitle || "Produto",
        productImage: productImage,
        sellerName: mlAccount.nickname,
        approvalUrl: approvalUrl,
        timestamp: new Date().toISOString()
      }

      // Salvar no Redis para SSE/WebSocket (se disponível)
      try {
        const { redis } = await import('@/lib/redis')
        await redis.publish(
          `org:${mlAccount.organizationId}:notifications`,
          JSON.stringify(notificationPayload)
        )
        logger.info("📱 Notification published to Redis channel")
      } catch (redisError) {
        logger.warn("Redis publish failed (non-critical)", { error: redisError })
      }
      
      await prisma.question.update({
        where: { id: question.id },
        data: { updatedAt: new Date() }
      })
      
      logger.info("✅ WhatsApp notification sent")
    } catch (whatsappError) {
      logger.error("WhatsApp error (non-critical):", { error: whatsappError })
    }
    
    return NextResponse.json({
      status: "success",
      message: "AI response received and stored",
      questionId: question.id
    })
    
  } catch (error) {
    logger.error("N8N response error:", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET endpoint to check status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get("questionId")
    
    if (!questionId) {
      return NextResponse.json({ error: "Missing questionId" }, { status: 400 })
    }
    
    const question = await prisma.question.findUnique({
      where: { mlQuestionId: questionId },
      select: {
        id: true,
        mlQuestionId: true,
        status: true,
        text: true,
        aiSuggestion: true,
        answer: true,
        aiProcessedAt: true,
        approvedAt: true,
        sentToMLAt: true
      }
    })
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }
    
    return NextResponse.json(question)
    
  } catch (error) {
    logger.error("Status check error:", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}