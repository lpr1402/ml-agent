/**
 * API Route: Stream de resposta do agente em tempo real
 * Server-Sent Events (SSE) para streaming token-by-token
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { mlAgentService } from '@/lib/agent/core/ml-agent-service'
import { prisma } from '@/lib/prisma'
import type { QuestionInput, QuestionContext } from '@/lib/agent/types/agent-types'

/**
 * POST - Processa pergunta com streaming token-by-token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { questionId } = body

    logger.info('[StreamAPI] Stream request received', {
      questionId,
    })

    // Buscar pergunta no banco
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        mlAccount: {
          select: {
            id: true,
            nickname: true,
            organizationId: true,
            mlUserId: true,
          },
        },
      },
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Buscar dados do produto (mesma lógica do N8N)
    const productInfo = `PRODUTO: ${question.itemTitle || 'Produto'}
PREÇO: R$ ${question.itemPrice?.toFixed(2) || '0.00'}
ITEM ID: ${question.itemId}
LINK: ${question.itemPermalink || 'N/A'}

DESCRIÇÃO:
(Descrição completa seria buscada aqui via ML API)
`

    // Preparar input para o agente
    const questionInput: QuestionInput = {
      mlQuestionId: question.mlQuestionId,
      text: question.text,
      itemId: question.itemId,
      customerId: question.customerId,
      sellerId: question.sellerId,
      dateCreated: question.dateCreated,
      receivedAt: question.receivedAt,
    }

    const questionContext: QuestionContext = {
      product: null,
      productImages: [],
      productDescription: productInfo,
      buyerHistory: [],
      buyerProfile: null,
      sellerNickname: question.mlAccount.nickname,
      sellerReputation: null,
      similarQuestions: [],
      organizationPreferences: null,
    }

    // Criar ReadableStream para SSE
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Evento inicial
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'start',
                questionId: question.id,
                timestamp: Date.now(),
              })}\n\n`
            )
          )

          // Processar com streaming via WebSocket
          const response = await mlAgentService.processQuestionWithStreaming({
            questionId: question.id,
            questionInput,
            context: questionContext,
            organizationId: question.mlAccount.organizationId,
          })

          // Enviar resultado final
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'complete',
                response,
                timestamp: Date.now(),
              })}\n\n`
            )
          )

          // Evento de conclusão
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                timestamp: Date.now(),
              })}\n\n`
            )
          )

          controller.close()
        } catch (error: any) {
          logger.error('[StreamAPI] Streaming error', {
            questionId,
            error: error.message,
          })

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error.message,
                timestamp: Date.now(),
              })}\n\n`
            )
          )

          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Nginx
      },
    })
  } catch (error: any) {
    logger.error('[StreamAPI] Error', {
      error: error.message,
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
