/**
 * API Route: Retry Failed Answer
 * Reenviar resposta que falhou ou reprocessar com Gemini
 *
 * MIGRADO: N8N -> Gemini 3.0 Pro (2025-12)
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { processQuestionWithAgent } from "@/lib/agent/core/agent-integration"
import { fetchCompleteProductData } from "@/lib/ml-api/enhanced-product-fetcher"

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

      // Reusar endpoint de aprovação sem reprocessar
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
        logger.info("[Retry] Successfully sent to ML without reprocessing", {
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
          reprocessed: false,
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
          reprocessed: false
        }, { status: 500 })
      }
    }

    // Se não tem resposta da IA, precisa reprocessar com Gemini
    logger.info("[Retry] No AI response found, reprocessing with Gemini", {
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

    // Descriptografar token para buscar dados
    const { decryptToken } = await import('@/lib/security/encryption')
    let mlToken: string | null = null

    try {
      mlToken = decryptToken({
        encrypted: question.mlAccount.accessToken,
        iv: question.mlAccount.accessTokenIV!,
        authTag: question.mlAccount.accessTokenTag!
      })
    } catch (error) {
      logger.warn("[Retry] Could not decrypt token, using fallback data")
    }

    // Buscar dados completos do produto
    let completeProductData = null
    if (mlToken && question.itemId) {
      completeProductData = await fetchCompleteProductData(question.itemId, mlToken)
    }

    if (!completeProductData) {
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

    // ✅ Processar com Gemini 3.0 Pro
    try {
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

      // Chamar agente Gemini (processamento assíncrono)
      processQuestionWithAgent(savedQuestion, enrichedData)
        .then(() => {
          logger.info(`[Retry] ✅ Gemini processing completed for ${question.mlQuestionId}`)
        })
        .catch(async (error) => {
          logger.error(`[Retry] ❌ Gemini processing failed for ${question.mlQuestionId}`, {
            error: error.message
          })

          await prisma.question.update({
            where: { id: questionId },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              failureReason: `Erro no Gemini: ${error.message}`
            }
          })

          try {
            const { emitQuestionFailed } = require('@/lib/websocket/emit-events.js')
            emitQuestionFailed(
              question.mlQuestionId,
              `Erro no processamento: ${error.message}`,
              true,
              question.mlAccount.organizationId
            )
          } catch (wsError) {
            logger.warn('[Retry] Failed to emit error event', { error: wsError })
          }
        })

      logger.info("[Retry] Question sent to Gemini for reprocessing", {
        questionId,
        mlQuestionId: question.mlQuestionId
      })

      return NextResponse.json({
        success: true,
        message: "Question sent to Gemini for reprocessing",
        reprocessed: true,
        engine: 'gemini-3.0-pro'
      })

    } catch (error: any) {
      logger.error("[Retry] Error starting Gemini processing", {
        questionId,
        error: error.message
      })

      await prisma.question.update({
        where: { id: questionId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: error.message
        }
      })

      return NextResponse.json({
        success: false,
        error: "Failed to start AI processing",
        reprocessed: true
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
      needsReprocessing: !question.aiSuggestion
    })

  } catch (error) {
    logger.error("[Retry] Error checking status", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
