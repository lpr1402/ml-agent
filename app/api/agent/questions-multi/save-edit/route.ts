import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { emitQuestionUpdate } from '@/lib/websocket/emit-events'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const auth = await getAuthenticatedAccount()

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { questionId, editedResponse } = await request.json()

    if (!questionId || !editedResponse) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Buscar a pergunta
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        mlAccount: {
          select: {
            id: true,
            organizationId: true,
            nickname: true
          }
        }
      }
    })

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      )
    }

    // Verificar se a pergunta pertence à organização do usuário
    if (question.mlAccount.organizationId !== auth.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    // Atualizar a pergunta com a resposta editada
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        aiSuggestion: editedResponse,
        status: question.status === 'PROCESSING' ? 'AWAITING_APPROVAL' : question.status,
        updatedAt: new Date()
      }
    })

    logger.info(`[SaveEdit] Question ${questionId} edited manually`, {
      questionId,
      organizationId: auth.organizationId,
      previousResponse: question.aiSuggestion?.substring(0, 50),
      newResponse: editedResponse.substring(0, 50)
    })

    // Emitir evento WebSocket para atualização em tempo real
    try {
      await emitQuestionUpdate(
        updatedQuestion.id,
        updatedQuestion.status,
        {
          aiSuggestion: updatedQuestion.aiSuggestion,
          editType: 'manual',
          editedBy: auth.mlAccount.id,
          timestamp: new Date().toISOString()
        }
      )

      logger.info('[SaveEdit] WebSocket event emitted for manual edit', {
        questionId,
        type: 'question:updated'
      })
    } catch (error) {
      logger.warn('[SaveEdit] Failed to emit WebSocket event', { error })
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'question.edited_manually',
        entityType: 'question',
        entityId: questionId,
        organizationId: auth.organizationId,
        mlAccountId: question.mlAccount.id,
        metadata: {
          editedBy: auth.mlAccount.id,
          previousLength: question.aiSuggestion?.length || 0,
          newLength: editedResponse.length
        }
      }
    })

    return NextResponse.json({
      success: true,
      question: updatedQuestion
    })

  } catch (error) {
    logger.error('[SaveEdit] Error saving manual edit:', { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}