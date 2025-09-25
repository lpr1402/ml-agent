import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { emitQuestionCompleted } from "@/lib/websocket/emit-events"

export async function POST(request: NextRequest) {
  try {
    // Autenticar usuário
    const auth = await getAuthenticatedAccount()
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { questionId } = await request.json()

    if (!questionId) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 })
    }

    // Buscar pergunta
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        mlAccount: {
          select: {
            id: true,
            nickname: true,
            thumbnail: true,
            organizationId: true
          }
        }
      }
    })

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    // Verificar se a pergunta pertence à organização do usuário
    if (question.mlAccount.organizationId !== auth.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Verificar se a pergunta está em um status que pode ser marcado como respondido
    const allowedStatuses = ["SENT_TO_ML", "APPROVED", "AWAITING_APPROVAL", "PENDING"]
    if (!allowedStatuses.includes(question.status)) {
      return NextResponse.json({
        error: `Cannot mark as responded. Current status: ${question.status}`
      }, { status: 400 })
    }

    // Atualizar status para RESPONDED
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        status: "RESPONDED",
        updatedAt: new Date()
      }
    })

    logger.info("[Complete Question] Question marked as completed", {
      questionId: updatedQuestion.id,
      mlQuestionId: updatedQuestion.mlQuestionId,
      previousStatus: question.status,
      userId: auth.mlAccount.id
    })

    // Emitir evento WebSocket
    try {
      await emitQuestionCompleted(
        updatedQuestion.id,
        200,
        {
          previousStatus: question.status,
          markedByUser: true
        }
      )
      logger.info("[Complete Question] WebSocket event emitted", {
        questionId: updatedQuestion.id,
        type: 'question:completed'
      })
    } catch (wsError) {
      logger.error("[Complete Question] Failed to emit WebSocket event", { error: wsError })
    }

    return NextResponse.json({
      success: true,
      question: {
        id: updatedQuestion.id,
        mlQuestionId: updatedQuestion.mlQuestionId,
        status: updatedQuestion.status,
        updatedAt: updatedQuestion.updatedAt
      }
    })

  } catch (error) {
    logger.error("[Complete Question] Error marking question as completed:", { error })
    return NextResponse.json(
      { error: "Failed to mark question as completed" },
      { status: 500 }
    )
  }
}