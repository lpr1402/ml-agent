/**
 * API Route: Reprocessar Pergunta com Gemini 3.0 Pro
 * Reprocessa perguntas que falharam ou ficaram travadas
 *
 * MIGRADO: N8N -> Gemini 3.0 Pro (2025-12)
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchCompleteProductData } from "@/lib/ml-api/enhanced-product-fetcher"
import { processQuestionWithAgent } from "@/lib/agent/core/agent-integration"

export async function POST(request: NextRequest) {
  try {
    logger.info('[Reprocess] Endpoint called', {
      method: request.method,
      url: request.url
    })

    // Parse do body
    let questionId: string
    try {
      const body = await request.json()
      questionId = body.questionId
      logger.info('[Reprocess] Body parsed successfully', { questionId })
    } catch (parseError) {
      logger.error('[Reprocess] Failed to parse request body', {
        error: parseError instanceof Error ? parseError.message : String(parseError)
      })
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    if (!questionId) {
      return NextResponse.json({ error: "Missing question ID" }, { status: 400 })
    }

    logger.info(`[Reprocess] Starting reprocess for question ${questionId}`)

    // Buscar a pergunta com informações completas
    const question = await prisma.question.findUnique({
      where: { id: questionId },
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

    if (!question.mlAccount) {
      return NextResponse.json({ error: "ML Account not found for this question" }, { status: 404 })
    }

    // Validar status para reprocessamento
    const allowedStatuses = ["FAILED", "TOKEN_ERROR", "ERROR", "RECEIVED", "PROCESSING"]

    if (question.aiSuggestion) {
      return NextResponse.json({
        error: "Question already has AI response. Use revision instead.",
        currentStatus: question.status,
        hasAISuggestion: true
      }, { status: 400 })
    }

    if (!allowedStatuses.includes(question.status)) {
      return NextResponse.json({
        error: "Only failed or stuck questions can be reprocessed",
        currentStatus: question.status
      }, { status: 400 })
    }

    // Verificar se realmente está travada (>5min)
    if (question.status === 'RECEIVED' || question.status === 'PROCESSING') {
      const receivedDate = question.receivedAt || question.dateCreated || question.createdAt
      if (receivedDate) {
        const timeSinceReceived = Date.now() - new Date(receivedDate).getTime()
        const fiveMinutesInMs = 5 * 60 * 1000

        const hasGenericText = question.text?.includes('Processando') ||
                               question.text?.includes('dados pendentes') ||
                               question.text?.includes('Clique em "Reprocessar"')

        if (timeSinceReceived < fiveMinutesInMs && !hasGenericText) {
          return NextResponse.json({
            error: "Question is still being processed. Please wait at least 5 minutes before reprocessing.",
            currentStatus: question.status,
            timeSinceReceived: Math.floor(timeSinceReceived / 1000 / 60) + ' minutes'
          }, { status: 400 })
        }
      }
    }

    // Verificar conta ativa e token
    if (!question.mlAccount.isActive) {
      return NextResponse.json({ error: "ML Account is not active" }, { status: 400 })
    }

    if (!question.mlAccount.accessToken) {
      return NextResponse.json({ error: "No access token available for this ML account" }, { status: 400 })
    }

    // Descriptografar token
    const { decryptToken } = await import('@/lib/security/encryption')

    let mlToken: string
    try {
      mlToken = decryptToken({
        encrypted: question.mlAccount.accessToken,
        iv: question.mlAccount.accessTokenIV!,
        authTag: question.mlAccount.accessTokenTag!
      })
    } catch (error) {
      logger.error("[Reprocess] Failed to decrypt token", { error })
      return NextResponse.json({ error: "Failed to decrypt ML token" }, { status: 500 })
    }

    logger.info(`[Reprocess] Processing question ${question.mlQuestionId} for seller ${question.mlAccount.nickname}`)

    // Atualizar status para PROCESSING
    await prisma.question.update({
      where: { id: questionId },
      data: {
        status: "PROCESSING",
        failureReason: null,
        failedAt: null,
        retryCount: { increment: 1 }
      }
    })

    // Emitir evento WebSocket de processamento iniciado
    try {
      const { emitQuestionUpdate } = require('@/lib/websocket/emit-events.js')
      emitQuestionUpdate(question.mlQuestionId, 'PROCESSING', {
        organizationId: question.mlAccount.organizationId,
        message: 'Reprocessando com Gemini 3.0 Pro...'
      })
    } catch (wsError) {
      logger.warn('[Reprocess] Failed to emit WebSocket event', { error: wsError })
    }

    // Buscar dados completos do produto
    logger.info(`[Reprocess] Fetching complete product data for item ${question.itemId}`)
    let completeProductData = await fetchCompleteProductData(question.itemId, mlToken)

    if (!completeProductData) {
      logger.warn(`[Reprocess] Could not fetch complete product data, using fallback`)
      completeProductData = {
        id: question.itemId,
        title: question.itemTitle || 'Produto',
        price: question.itemPrice || 0,
        permalink: question.itemPermalink || '',
        available_quantity: 1,
        sold_quantity: 0,
        condition: 'not_specified',
        status: '',
        category_id: '',
        listing_type_id: ''
      }
    }

    // ✅ NOVO: Processar com Gemini 3.0 Pro (em vez de N8N)
    try {
      // Preparar dados no formato esperado pelo agent
      const savedQuestion = {
        id: question.id,
        mlQuestionId: question.mlQuestionId,
        mlAccountId: question.mlAccountId,
        text: question.text,
        itemId: question.itemId,
        itemTitle: question.itemTitle,
        itemPrice: question.itemPrice,
        itemPermalink: question.itemPermalink,
        customerId: question.customerId,
        sellerId: question.sellerId,
        dateCreated: question.dateCreated,
        receivedAt: question.receivedAt,
        status: 'PROCESSING'
      }

      const enrichedData = {
        itemDetails: completeProductData,
        itemDescription: completeProductData?.description || null,
        sellerData: null,
        buyerData: null
      }

      // Chamar agente Gemini (processamento assíncrono com streaming via WebSocket)
      processQuestionWithAgent(savedQuestion, enrichedData)
        .then(() => {
          logger.info(`[Reprocess] ✅ Gemini processing completed for ${question.mlQuestionId}`)
        })
        .catch(async (error) => {
          logger.error(`[Reprocess] ❌ Gemini processing failed for ${question.mlQuestionId}`, {
            error: error.message
          })

          // Atualizar status para FAILED
          await prisma.question.update({
            where: { id: questionId },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              failureReason: `Erro no Gemini: ${error.message}`
            }
          })

          // Emitir evento de erro
          try {
            const { emitQuestionFailed } = require('@/lib/websocket/emit-events.js')
            emitQuestionFailed(
              question.mlQuestionId,
              `Erro no processamento: ${error.message}`,
              true,
              question.mlAccount.organizationId
            )
          } catch (wsError) {
            logger.warn('[Reprocess] Failed to emit error event', { error: wsError })
          }
        })

      logger.info(`[Reprocess] ✅ Question ${question.mlQuestionId} sent to Gemini for processing`)

      return NextResponse.json({
        success: true,
        message: "Question sent for reprocessing with Gemini AI",
        questionId: question.id,
        engine: 'gemini-3.0-pro'
      })

    } catch (processingError: any) {
      logger.error("[Reprocess] Failed to start Gemini processing:", { error: processingError.message })

      await prisma.question.update({
        where: { id: questionId },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          failureReason: `Erro ao iniciar processamento: ${processingError.message}`
        }
      })

      return NextResponse.json({
        error: "Failed to start AI processing",
        details: processingError.message
      }, { status: 500 })
    }

  } catch (error) {
    logger.error("[Reprocess] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json({
      error: process.env.NODE_ENV === 'development'
        ? `Internal server error: ${error instanceof Error ? error.message : String(error)}`
        : "Internal server error"
    }, { status: 500 })
  }
}

// OPTIONS handler for CORS preflight
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

// GET endpoint to check if question can be reprocessed
export async function GET(_request: NextRequest) {
  try {
    const { searchParams } = new URL(_request.url)
    const questionId = searchParams.get("questionId")

    if (!questionId) {
      return NextResponse.json({ error: "Missing question ID" }, { status: 400 })
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, status: true, aiSuggestion: true }
    })

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    const allowedStatuses = ["FAILED", "TOKEN_ERROR", "ERROR", "RECEIVED", "PROCESSING"]
    const canReprocess = allowedStatuses.includes(question.status) && !question.aiSuggestion

    return NextResponse.json({
      canReprocess,
      status: question.status,
      hasAISuggestion: !!question.aiSuggestion
    })

  } catch (error) {
    logger.error("[Reprocess] Check error:", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
