import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { decryptToken } from '@/lib/security/encryption'
import { buildN8NPayload, fetchBuyerQuestionsHistory } from '@/lib/webhooks/n8n-payload-builder'
import { fetchCompleteProductData } from '@/lib/ml-api/enhanced-product-fetcher'

const N8N_EDIT_WEBHOOK_URL = process.env['N8N_WEBHOOK_EDIT_URL'] || 'https://dashboard.axnexlabs.com.br/webhook/editar'

export async function POST(request: NextRequest) {
  try {
    const { questionId, feedback, token } = await request.json()

    if (!questionId) {
      return NextResponse.json({ error: 'Missing question ID' }, { status: 400 })
    }

    // Buscar a pergunta com todos os dados necessários
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        mlAccount: {
          select: {
            id: true,
            nickname: true,
            organizationId: true,
            mlUserId: true,
            accessToken: true,
            accessTokenIV: true,
            accessTokenTag: true
          }
        }
      }
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Validar token se fornecido
    if (token) {
      const approvalToken = await prisma.approvalToken.findUnique({
        where: { token },
        select: {
          questionId: true,
          mlAccountId: true,
          used: true,
          expiresAt: true
        }
      })

      if (!approvalToken ||
          approvalToken.questionId !== questionId ||
          approvalToken.mlAccountId !== question.mlAccount.id ||
          new Date() > approvalToken.expiresAt) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
      }
    }

    // Atualizar status para EDITING_WITH_AI
    await prisma.question.update({
      where: { id: questionId },
      data: {
        status: 'EDITING_WITH_AI',
        updatedAt: new Date()
      }
    })

    // Emitir evento WebSocket de início de revisão
    try {
      const { emitQuestionEvent } = require('@/lib/websocket/emit-events.js')
      emitQuestionEvent(
        question.mlQuestionId,
        'revising',
        {
          status: 'EDITING_WITH_AI',
          message: 'ML Agent está revisando sua resposta...'
        },
        question.mlAccount.organizationId
      )
    } catch (wsError) {
      logger.warn('[ReviseAnswer] Failed to emit WebSocket event', { error: wsError })
    }

    // Descriptografar token para buscar dados do produto
    const mlToken = decryptToken({
      encrypted: question.mlAccount.accessToken,
      iv: question.mlAccount.accessTokenIV!,
      authTag: question.mlAccount.accessTokenTag!
    })

    // Buscar informações completas do produto
    let completeProductData = null
    if (question.itemId) {
      logger.info(`[ReviseAnswer] Fetching complete product data for item ${question.itemId}`)
      completeProductData = await fetchCompleteProductData(question.itemId, mlToken)

      if (!completeProductData) {
        completeProductData = {
          id: question.itemId,
          title: question.itemTitle || 'Produto',
          price: question.itemPrice || 0,
          permalink: question.itemPermalink || '',
          condition: 'not_specified',
          available_quantity: 0,
          sold_quantity: 0,
          status: '',
          category_id: '',
          listing_type_id: ''
        }
      }
    }

    // Buscar histórico de perguntas do comprador
    const previousQuestions = await fetchBuyerQuestionsHistory(
      question.customerId || '',
      question.mlAccount.organizationId,
      question.mlQuestionId,
      prisma,
      decryptToken
    )

    // Construir payload para N8N
    const n8nPayload = await buildN8NPayload(
      {
        mlQuestionId: question.mlQuestionId,
        text: question.text,
        item_id: question.itemId,
        customerId: question.customerId
      },
      completeProductData,
      completeProductData?.description || null,
      previousQuestions,
      {
        originalResponse: question.aiSuggestion || question.answer || '',
        revisionFeedback: feedback || 'Melhore a resposta com tom mais amigável e completo',
        sellerNickname: question.mlAccount.nickname || 'Vendedor'
      }
    )

    logger.info('[ReviseAnswer] Sending revision request to N8N', {
      questionId,
      mlQuestionId: question.mlQuestionId,
      feedback
    })

    // Enviar para N8N webhook de edição
    try {
      const n8nResponse = await fetch(N8N_EDIT_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ML-Agent/1.0'
        },
        body: JSON.stringify(n8nPayload)
      })

      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text()
        logger.error('[ReviseAnswer] N8N edit webhook error', {
          status: n8nResponse.status,
          error: errorText
        })

        // Reverter status se falhar
        await prisma.question.update({
          where: { id: questionId },
          data: {
            status: 'AWAITING_APPROVAL',
            updatedAt: new Date()
          }
        })

        return NextResponse.json(
          { error: 'Failed to process revision with AI' },
          { status: 500 }
        )
      }

      const n8nResult = await n8nResponse.json()
      logger.info('[ReviseAnswer] Revision request sent to N8N successfully', { result: n8nResult })

      return NextResponse.json({
        success: true,
        message: 'ML Agent está revisando sua resposta. Você receberá a atualização em breve.',
        trackingId: n8nResult.executionId || question.id
      })

    } catch (error) {
      logger.error('[ReviseAnswer] Failed to send revision to N8N', { error })

      // Reverter status se falhar
      await prisma.question.update({
        where: { id: questionId },
        data: {
          status: 'AWAITING_APPROVAL',
          updatedAt: new Date()
        }
      })

      return NextResponse.json(
        { error: 'Failed to connect to AI service' },
        { status: 500 }
      )
    }

  } catch (error) {
    logger.error('[ReviseAnswer] Unexpected error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}