import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

/**
 * API para salvar edição manual de resposta SEM enviar ao Mercado Livre
 * Apenas armazena a resposta editada no campo editedResponse
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar sessão
    const { getCurrentSession } = await import('@/lib/auth/ml-auth')
    const session = await getCurrentSession()

    if (!session?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { questionId, response } = await request.json()

    if (!questionId || !response) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validar tamanho da resposta (ML limita a 2000 caracteres)
    if (response.length > 2000) {
      return NextResponse.json({
        error: `Response too long: ${response.length}/2000 characters`
      }, { status: 400 })
    }

    // Buscar pergunta com validação de organização
    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        mlAccount: {
          organizationId: session.organizationId // Isolamento multi-tenant
        }
      },
      select: {
        id: true,
        mlQuestionId: true,
        status: true,
        mlAccountId: true
      }
    })

    if (!question) {
      logger.warn(`[SaveResponse] Question ${questionId} not found for org ${session.organizationId}`)
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    // Salvar resposta editada SUBSTITUINDO a resposta original
    // O status permanece o mesmo (AWAITING_APPROVAL, etc)
    await prisma.question.update({
      where: { id: questionId },
      data: {
        aiSuggestion: response, // SUBSTITUI a resposta original para evitar duplicação
        updatedAt: new Date()
        // NÃO mudamos o status nem enviamos ao ML
      }
    })

    logger.info(`[SaveResponse] Response saved for question ${question.mlQuestionId}`, {
      questionId,
      mlQuestionId: question.mlQuestionId,
      responseLength: response.length,
      status: question.status // Status permanece o mesmo
    })

    // Emitir evento WebSocket de resposta editada (opcional)
    try {
      const { emitQuestionEdited } = require('@/lib/websocket/emit-events.js')
      const mlAccount = await prisma.mLAccount.findUnique({
        where: { id: question.mlAccountId },
        select: { organizationId: true }
      })

      if (mlAccount) {
        emitQuestionEdited(
          question.mlQuestionId,
          response,
          mlAccount.organizationId
        )
      }
    } catch (wsError) {
      logger.warn('[SaveResponse] Failed to emit edit event', { error: wsError })
    }

    return NextResponse.json({
      success: true,
      message: "Response saved successfully",
      status: question.status // Retornar status atual (não mudou)
    })

  } catch (error) {
    logger.error("[SaveResponse] Error saving response", { error })
    return NextResponse.json({
      error: "Failed to save response"
    }, { status: 500 })
  }
}