/**
 * API Route: Editar Resposta com Gemini 3.0 Pro
 * Permite editar resposta da IA com instruções específicas
 *
 * MIGRADO: N8N -> Gemini 3.0 Pro (2025-12)
 *
 * Nota: Esta rota redireciona para /api/agent/revise-question
 * que já implementa a lógica de revisão com Gemini.
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { fetchBuyerQuestionsHistory, formatProductInfo } from "@/lib/webhooks/n8n-payload-builder"
import { decryptToken } from "@/lib/security/encryption"
import { fetchCompleteProductData } from "@/lib/ml-api/enhanced-product-fetcher"
import { getMLAgentServiceForOrganization } from "@/lib/agent/core/ml-agent-service-manager"
import type { QuestionInput, QuestionContext } from "@/lib/agent/types/agent-types"

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const auth = await getAuthenticatedAccount()

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const {
      questionId,
      editInstruction,
      previousAnswer
    } = await request.json()

    if (!questionId || !editInstruction) {
      return NextResponse.json(
        { error: "Missing required fields: questionId, editInstruction" },
        { status: 400 }
      )
    }

    // Buscar a pergunta completa
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
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    // Verificar se a pergunta pertence à organização do usuário
    if (question.mlAccount.organizationId !== auth.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    logger.info("🤖 [Edit AI] Starting Gemini edit request:", {
      questionId: question.id,
      mlQuestionId: question.mlQuestionId,
      instruction: editInstruction.substring(0, 100)
    })

    // Atualizar status da pergunta
    await prisma.question.update({
      where: { id: questionId },
      data: {
        status: "REVISING",
        updatedAt: new Date()
      }
    })

    // Emitir eventos WebSocket
    try {
      const {
        emitQuestionRevising,
        emitAgentStep
      } = require('@/lib/websocket/emit-events.js')

      emitQuestionRevising(
        question.mlQuestionId,
        editInstruction,
        question.mlAccount.organizationId
      )

      emitAgentStep(
        question.id,
        question.mlAccount.organizationId,
        'revising',
        { status: 'Gemini 3.0 Pro editando resposta...' }
      )
    } catch (wsError) {
      logger.warn('[Edit AI] Failed to emit WebSocket event', { error: wsError })
    }

    // Descriptografar token para buscar dados
    const mlToken = decryptToken({
      encrypted: question.mlAccount.accessToken,
      iv: question.mlAccount.accessTokenIV!,
      authTag: question.mlAccount.accessTokenTag!
    })

    // Buscar dados do produto
    let itemData: any = {
      id: question.itemId,
      title: question.itemTitle || 'Produto',
      price: question.itemPrice || 0,
      permalink: question.itemPermalink || ''
    }

    let descriptionData = null

    try {
      const completeProductData = await fetchCompleteProductData(question.itemId, mlToken)
      if (completeProductData) {
        itemData = completeProductData
        descriptionData = completeProductData.description
      }
    } catch (_err) {
      logger.warn('[Edit AI] Using fallback product data')
    }

    // Buscar histórico do comprador
    const buyerQuestions = await fetchBuyerQuestionsHistory(
      question.customerId || '',
      question.mlAccount.organizationId,
      question.mlQuestionId,
      prisma,
      decryptToken
    )

    // Formatar dados
    const productInfoFormatted = formatProductInfo({
      ...itemData,
      description: descriptionData
    })

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
      productDescription: productInfoFormatted,
      buyerHistory: buyerQuestions,
      buyerProfile: null,
      sellerNickname: question.mlAccount.nickname,
      sellerReputation: null,
      similarQuestions: [],
      organizationPreferences: null,
    }

    // ✅ Usar instância Gemini da organização
    const mlAgentService = getMLAgentServiceForOrganization(question.mlAccount.organizationId)

    // 🤖 Revisar com Gemini (streaming via WebSocket) - MODO ASYNC
    mlAgentService.reviseResponseWithStreaming({
      questionId: question.id,
      questionInput,
      context: questionContext,
      organizationId: question.mlAccount.organizationId,
      originalResponse: previousAnswer || question.aiSuggestion || '',
      revisionFeedback: editInstruction,
    }).then(async (revisedResponse) => {
      // ✅ Sucesso: Atualizar banco
      await prisma.question.update({
        where: { id: questionId },
        data: {
          aiSuggestion: revisedResponse.content,
          aiConfidence: revisedResponse.confidence,
          status: "AWAITING_APPROVAL",
          processedAt: new Date(),
        }
      })

      // Emitir evento de conclusão
      const { emitQuestionUpdate } = require('@/lib/websocket/emit-events.js')
      emitQuestionUpdate(
        question.mlQuestionId,
        "AWAITING_APPROVAL",
        {
          organizationId: question.mlAccount.organizationId,
          aiSuggestion: revisedResponse.content,
          aiConfidence: revisedResponse.confidence,
        }
      )

      logger.info("✅ [Edit AI] Gemini revision completed", {
        questionId: question.id,
        confidence: revisedResponse.confidence,
        tokensUsed: revisedResponse.tokensUsed.totalTokens,
      })
    }).catch(async (error) => {
      // ❌ Erro: Reverter status
      logger.error("[Edit AI] Gemini revision failed", {
        error: error.message
      })

      await prisma.question.update({
        where: { id: questionId },
        data: {
          status: 'AWAITING_APPROVAL',
          aiSuggestion: question.aiSuggestion
        }
      })

      const { emitQuestionEvent } = require('@/lib/websocket/emit-events.js')
      emitQuestionEvent(
        question.mlQuestionId,
        'revision-error',
        {
          failureReason: `Erro no agente: ${error.message}`,
          errorType: 'AGENT_ERROR',
          status: 'AWAITING_APPROVAL',
          retryable: true,
          aiSuggestion: question.aiSuggestion
        },
        question.mlAccount.organizationId
      )
    })

    // ✅ Retornar IMEDIATAMENTE - streaming acontece via WebSocket
    return NextResponse.json({
      success: true,
      message: "Edit request sent to Gemini AI. Response will stream via WebSocket.",
      questionId: question.id,
      engine: 'gemini-3.0-pro'
    })

  } catch (error) {
    logger.error("Edit with AI error:", { error })
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
