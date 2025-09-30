/**
 * Endpoint para salvar edição de resposta no banco de dados
 * NÃO envia para o Mercado Livre - apenas salva a edição localmente
 * Emite evento WebSocket para atualização em tempo real
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/auth/ml-auth'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse do body
    const { questionId, editedAnswer } = await request.json()

    // Validação de entrada
    if (!questionId || typeof questionId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid question ID' },
        { status: 400 }
      )
    }

    if (!editedAnswer || typeof editedAnswer !== 'string') {
      return NextResponse.json(
        { error: 'Invalid answer text' },
        { status: 400 }
      )
    }

    // Validar tamanho da resposta (ML tem limite de 2000 caracteres)
    if (editedAnswer.length > 2000) {
      return NextResponse.json(
        { error: 'Answer exceeds 2000 characters limit' },
        { status: 400 }
      )
    }

    logger.info('[SaveAnswerEdit] Saving edited answer', {
      questionId,
      answerLength: editedAnswer.length,
      organizationId: session.organizationId
    })

    // Buscar pergunta com validação de organização (multi-tenant)
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
            organizationId: true
          }
        }
      }
    })

    if (!question) {
      logger.warn('[SaveAnswerEdit] Question not found', {
        questionId,
        organizationId: session.organizationId
      })
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    // Verificar se a pergunta está em um estado que permite edição
    const editableStatuses = ['AWAITING_APPROVAL', 'FAILED', 'ERROR', 'REVISING', 'PROCESSING']
    if (!editableStatuses.includes(question.status)) {
      logger.warn('[SaveAnswerEdit] Question not in editable status', {
        questionId,
        currentStatus: question.status
      })
      return NextResponse.json(
        {
          error: 'Question cannot be edited in current status',
          currentStatus: question.status
        },
        { status: 400 }
      )
    }

    // Se está PROCESSING mas tem aiSuggestion, corrigir o status
    if (question.status === 'PROCESSING' && question.aiSuggestion) {
      logger.info('[SaveAnswerEdit] Fixing incorrect PROCESSING status for question with AI suggestion', {
        questionId,
        mlQuestionId: question.mlQuestionId
      })
    }

    // Salvar resposta editada no banco
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        aiSuggestion: editedAnswer,
        // Manter o status AWAITING_APPROVAL para permitir aprovação
        status: 'AWAITING_APPROVAL'
      },
      include: {
        mlAccount: {
          select: {
            id: true,
            nickname: true,
            thumbnail: true
          }
        }
      }
    })

    logger.info('[SaveAnswerEdit] Answer saved successfully', {
      questionId,
      mlQuestionId: question.mlQuestionId,
      organizationId: session.organizationId
    })

    // Emitir evento WebSocket para atualização em tempo real
    try {
      const { emitQuestionEvent } = require('@/lib/websocket/emit-events.js')

      // Evento específico para edição salva
      await emitQuestionEvent(
        question.mlQuestionId,
        'answer-edited',
        {
          questionId: question.id,
          mlQuestionId: question.mlQuestionId,
          editedAnswer,
          status: 'AWAITING_APPROVAL',
          editedBy: session.organizationId,
          editedAt: new Date().toISOString()
        },
        question.mlAccount.organizationId
      )

      // Também emitir evento de atualização geral
      await emitQuestionEvent(
        question.mlQuestionId,
        'updated',
        {
          questionId: question.id,
          status: 'AWAITING_APPROVAL',
          aiSuggestion: editedAnswer,
          data: {
            aiSuggestion: editedAnswer,
            editedManually: true
          }
        },
        question.mlAccount.organizationId
      )

      logger.info('[SaveAnswerEdit] WebSocket events emitted', {
        questionId,
        mlQuestionId: question.mlQuestionId
      })
    } catch (wsError) {
      // Não falhar a operação se WebSocket falhar
      logger.warn('[SaveAnswerEdit] Failed to emit WebSocket events', {
        error: wsError
      })
    }

    // Retornar sucesso com dados atualizados
    return NextResponse.json({
      success: true,
      message: 'Answer edited and saved successfully',
      question: {
        id: updatedQuestion.id,
        mlQuestionId: updatedQuestion.mlQuestionId,
        aiSuggestion: updatedQuestion.aiSuggestion,
        status: updatedQuestion.status
      }
    })

  } catch (error) {
    logger.error('[SaveAnswerEdit] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      {
        error: 'Failed to save edited answer',
        details: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    )
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  })
}