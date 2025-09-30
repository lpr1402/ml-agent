/**
 * Endpoint para salvar edição via token de aprovação única
 * Similar ao save-answer-edit mas funciona com token temporário
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { approvalTokenService } from '@/lib/services/approval-token-service'

export async function POST(request: NextRequest) {
  try {
    // Parse do body
    const { token, pin, editedAnswer } = await request.json()

    // Validação de entrada
    if (!token || !pin) {
      return NextResponse.json(
        { error: 'Missing token or PIN' },
        { status: 400 }
      )
    }

    // Validar PIN
    if (!approvalTokenService.validatePin(pin)) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      )
    }

    // Validar token
    const validation = await approvalTokenService.validateToken(token)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 401 }
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

    const question = validation.question

    logger.info('[SaveEdit via Token] Saving edited answer', {
      questionId: question.id,
      answerLength: editedAnswer.length,
      token: token.substring(0, 8)
    })

    // Verificar se a pergunta está em um estado que permite edição
    const editableStatuses = ['AWAITING_APPROVAL', 'FAILED', 'ERROR', 'REVISING', 'PROCESSING']

    // Se tem aiSuggestion mas status está PROCESSING (erro), corrigir
    if (question.status === 'PROCESSING' && question.aiSuggestion) {
      logger.info('[SaveEdit via Token] Fixing incorrect PROCESSING status')
    }

    if (!editableStatuses.includes(question.status)) {
      logger.warn('[SaveEdit via Token] Question not in editable status', {
        questionId: question.id,
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

    // Salvar resposta editada no banco
    const updatedQuestion = await prisma.question.update({
      where: { id: question.id },
      data: {
        aiSuggestion: editedAnswer,
        // Sempre manter AWAITING_APPROVAL após edição
        status: 'AWAITING_APPROVAL'
      },
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

    logger.info('[SaveEdit via Token] Answer saved successfully', {
      questionId: question.id,
      mlQuestionId: updatedQuestion.mlQuestionId
    })

    // Emitir evento WebSocket para atualização em tempo real
    try {
      const { emitQuestionEvent } = require('@/lib/websocket/emit-events.js')

      // Evento específico para edição salva
      await emitQuestionEvent(
        updatedQuestion.mlQuestionId,
        'answer-edited',
        {
          questionId: updatedQuestion.id,
          mlQuestionId: updatedQuestion.mlQuestionId,
          editedAnswer,
          status: 'AWAITING_APPROVAL',
          editedAt: new Date().toISOString()
        },
        updatedQuestion.mlAccount.organizationId
      )

      // Também emitir evento de atualização geral
      await emitQuestionEvent(
        updatedQuestion.mlQuestionId,
        'updated',
        {
          questionId: updatedQuestion.id,
          status: 'AWAITING_APPROVAL',
          aiSuggestion: editedAnswer,
          data: {
            aiSuggestion: editedAnswer,
            editedManually: true
          }
        },
        updatedQuestion.mlAccount.organizationId
      )

      logger.info('[SaveEdit via Token] WebSocket events emitted')
    } catch (wsError) {
      // Não falhar a operação se WebSocket falhar
      logger.warn('[SaveEdit via Token] Failed to emit WebSocket events', {
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
    logger.error('[SaveEdit via Token] Unexpected error:', {
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