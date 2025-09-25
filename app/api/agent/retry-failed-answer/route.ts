import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  try {
    // Verificar sessão
    const { getCurrentSession } = await import('@/lib/auth/ml-auth')
    const session = await getCurrentSession()

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { questionId } = await request.json()

    if (!questionId) {
      return NextResponse.json({ error: "Missing questionId" }, { status: 400 })
    }

    // Buscar pergunta com informações completas
    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        mlAccount: {
          organizationId: session.organizationId
        }
      },
      include: {
        mlAccount: {
          select: {
            id: true,
            mlUserId: true,
            nickname: true,
            organizationId: true,
            accessToken: true,
            accessTokenIV: true,
            accessTokenTag: true,
            isActive: true
          }
        }
      }
    })

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    logger.info("[Retry] Starting retry process", {
      questionId,
      mlQuestionId: question.mlQuestionId,
      hasAiSuggestion: !!question.aiSuggestion,
      hasAnswer: !!question.answer,
      status: question.status
    })

    // Se já tem resposta da IA (aiSuggestion), tenta enviar ao ML diretamente
    if (question.aiSuggestion) {
      logger.info("[Retry] Question already has AI response, sending to ML directly", {
        questionId,
        mlQuestionId: question.mlQuestionId
      })

      // Reusar endpoint de aprovação sem reprocessar pelo N8N
      const approveResponse = await fetch(
        new URL('/api/agent/approve-question', request.url).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({
            questionId: question.id,
            action: 'approve',
            response: question.aiSuggestion
          })
        }
      )

      const result = await approveResponse.json()

      if (approveResponse.ok) {
        logger.info("[Retry] Successfully sent to ML without N8N reprocessing", {
          questionId,
          mlQuestionId: question.mlQuestionId
        })

        // Emitir evento de sucesso
        try {
          const { emitQuestionSentToML } = require('@/lib/websocket/emit-events.js')
          emitQuestionSentToML(
            question.mlQuestionId,
            200,
            question.mlAccount.organizationId
          )
        } catch (wsError) {
          logger.warn('[Retry] Failed to emit success event', { error: wsError })
        }

        return NextResponse.json({
          success: true,
          message: "Answer sent to ML without reprocessing",
          reprocessedN8N: false,
          result
        })
      } else {
        logger.error("[Retry] Failed to send to ML", {
          questionId,
          error: result.error
        })

        return NextResponse.json({
          success: false,
          error: result.error || "Failed to send to ML",
          reprocessedN8N: false
        }, { status: 500 })
      }
    }

    // Se não tem resposta da IA, precisa reprocessar pelo N8N
    logger.info("[Retry] No AI response found, reprocessing through N8N", {
      questionId,
      mlQuestionId: question.mlQuestionId
    })

    // Atualizar status para PROCESSING
    await prisma.question.update({
      where: { id: questionId },
      data: {
        status: 'PROCESSING',
        retryCount: { increment: 1 }
      }
    })

    // Emitir evento WebSocket de reprocessamento
    try {
      const { emitQuestionProcessing } = require('@/lib/websocket/emit-events.js')
      emitQuestionProcessing(
        question.mlQuestionId,
        question.mlAccount.organizationId
      )
    } catch (wsError) {
      logger.warn('[Retry] Failed to emit processing event', { error: wsError })
    }

    // Preparar payload para N8N
    const n8nPayload = {
      mlQuestionId: question.mlQuestionId,
      text: question.text,
      itemId: question.itemId,
      itemTitle: question.itemTitle || "Produto",
      itemPrice: question.itemPrice || 0,
      itemPermalink: question.itemPermalink || "",
      sellerId: question.sellerId,
      customerId: question.customerId,
      dateCreated: question.dateCreated,
      accountId: question.mlAccount.id,
      accountNickname: question.mlAccount.nickname || 'Unknown',
      organizationId: question.mlAccount.organizationId
    }

    // Enviar ao N8N
    try {
      const n8nResponse = await fetch(
        "https://n8n.mercadopreciso.com/webhook/9e3797d2-9de8-4be2-b8e7-69ba983c60f8",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(n8nPayload)
        }
      )

      if (n8nResponse.ok) {
        logger.info("[Retry] Question sent to N8N for reprocessing", {
          questionId,
          mlQuestionId: question.mlQuestionId
        })

        return NextResponse.json({
          success: true,
          message: "Question sent to N8N for reprocessing",
          reprocessedN8N: true
        })
      } else {
        const errorText = await n8nResponse.text()
        logger.error("[Retry] N8N processing failed", {
          questionId,
          status: n8nResponse.status,
          error: errorText
        })

        // Marcar como falha
        await prisma.question.update({
          where: { id: questionId },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: `N8N processing failed: ${errorText}`
          }
        })

        return NextResponse.json({
          success: false,
          error: "N8N processing failed",
          reprocessedN8N: true
        }, { status: 500 })
      }
    } catch (error) {
      logger.error("[Retry] Error sending to N8N", {
        questionId,
        error
      })

      await prisma.question.update({
        where: { id: questionId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: String(error)
        }
      })

      return NextResponse.json({
        success: false,
        error: "Failed to send to N8N",
        reprocessedN8N: true
      }, { status: 500 })
    }

  } catch (error) {
    logger.error("[Retry] Unexpected error in retry endpoint", {
      error: error instanceof Error ? error.message : error
    })

    return NextResponse.json({
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}

// GET para verificar status de uma pergunta
export async function GET(request: NextRequest) {
  try {
    const { getCurrentSession } = await import('@/lib/auth/ml-auth')
    const session = await getCurrentSession()

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get("questionId")

    if (!questionId) {
      return NextResponse.json({ error: "Missing questionId" }, { status: 400 })
    }

    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        mlAccount: {
          organizationId: session.organizationId
        }
      },
      select: {
        id: true,
        mlQuestionId: true,
        status: true,
        text: true,
        aiSuggestion: true,
        answer: true,
        failureReason: true,
        retryCount: true,
        aiProcessedAt: true,
        approvedAt: true,
        sentToMLAt: true,
        failedAt: true
      }
    })

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...question,
      hasAiResponse: !!question.aiSuggestion,
      canRetry: question.status === 'FAILED',
      needsN8N: !question.aiSuggestion
    })

  } catch (error) {
    logger.error("[Retry] Error checking status", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}