/**
 * Endpoint para atualizar status de perguntas
 * Usado quando há timeout ou erro de processamento
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getAuthenticatedAccount } from '@/lib/api/session-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAccount()

    if (!auth?.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { questionId, status, failureReason } = await request.json()

    if (!questionId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verificar se a pergunta pertence à organização
    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        mlAccount: {
          organizationId: auth.organizationId
        }
      }
    })

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    // Atualizar status da pergunta
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        status,
        failedAt: status === 'FAILED' ? new Date() : null,
        failureReason: failureReason || null,
        // Se estiver marcando como falha após timeout, preservar o estado anterior
        ...(status === 'FAILED' && failureReason?.includes('Timeout') ? {
          mlResponseData: {
            ...(question.mlResponseData as any || {}),
            timeoutAt: new Date(),
            previousStatus: question.status
          }
        } : {})
      },
      include: {
        mlAccount: true
      }
    })

    logger.info('[UpdateQuestionStatus] Status updated', {
      questionId,
      oldStatus: question.status,
      newStatus: status,
      reason: failureReason
    })

    // Emitir evento WebSocket para atualização em tempo real
    if ((global as any).io) {
      (global as any).io.emit('question:status-updated', {
        questionId: updatedQuestion.id,
        mlQuestionId: updatedQuestion.mlQuestionId,
        status: updatedQuestion.status,
        failureReason: updatedQuestion.failureReason,
        mlAccountId: updatedQuestion.mlAccountId
      })
    }

    return NextResponse.json({
      success: true,
      question: updatedQuestion
    })

  } catch (error) {
    logger.error('[UpdateQuestionStatus] Error', { error })
    return NextResponse.json(
      { error: 'Failed to update question status' },
      { status: 500 }
    )
  }
}