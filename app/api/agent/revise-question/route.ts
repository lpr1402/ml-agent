/**
 * API Route: Revisão de Resposta com Gemini 3.0 Pro Agent
 * Suporta: Edição manual + Revisão com IA (streaming)
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMLAgentServiceForOrganization } from "@/lib/agent/core/ml-agent-service-manager"
import { formatProductInfo, fetchBuyerQuestionsHistory } from "@/lib/webhooks/n8n-payload-builder"
import { decryptToken } from "@/lib/security/encryption"
import type { QuestionInput, QuestionContext } from "@/lib/agent/types/agent-types"

/**
 * POST - Revisa resposta (manual ou com IA)
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar sessão
    const { getCurrentSession } = await import('@/lib/auth/ml-auth')
    const session = await getCurrentSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { questionId, feedback, editedResponse } = await request.json()

    if (!questionId || (!feedback && !editedResponse)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Buscar pergunta
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

    if (!question || !question.mlAccount) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    // ============================================================
    // CASO 1: Edição Manual (usuário editou texto diretamente)
    // ============================================================
    if (editedResponse && editedResponse !== question.aiSuggestion) {
      logger.info("📝 [Revision] Manual edit", {
        questionId: question.id,
        changes: editedResponse.length - (question.aiSuggestion?.length || 0),
      })

      // Salvar aprendizado (o que foi mudado)
      if (question.aiSuggestion) {
        // ✅ MULTI-TENANT: Usar instância da organização
        const mlAgentService = getMLAgentServiceForOrganization(question.mlAccount.organizationId)

        await mlAgentService.saveFeedback({
          questionId: question.id,
          originalResponse: question.aiSuggestion,
          finalResponse: editedResponse,
          organizationId: question.mlAccount.organizationId,
          mlAccountId: question.mlAccount.id,
          userId: session.organizationId,
        })
      }

      // Atualizar banco
      await prisma.question.update({
        where: { id: questionId },
        data: {
          editedResponse,
          aiSuggestion: editedResponse,
          status: "AWAITING_APPROVAL",
        }
      })

      // Emitir WebSocket update
      const { emitQuestionUpdate } = require('@/lib/websocket/emit-events.js')
      emitQuestionUpdate(
        question.mlQuestionId,
        "AWAITING_APPROVAL",
        {
          organizationId: question.mlAccount.organizationId,
          aiSuggestion: editedResponse,
        }
      )

      return NextResponse.json({
        success: true,
        type: 'manual_edit',
        response: editedResponse,
      })
    }

    // ============================================================
    // CASO 2: Revisão com Gemini 3.0 Pro IA (streaming)
    // ============================================================
    if (feedback) {
      logger.info("🤖 [Revision] Starting AI revision with Gemini", {
        questionId: question.id,
        feedbackLength: feedback.length,
      })

      // Atualizar status
      await prisma.question.update({
        where: { id: questionId },
        data: { status: "REVISING" }
      })

      // Emitir eventos WebSocket
      const {
        emitQuestionRevising,
        emitAgentStep,
        emitQuestionEvent,
        emitQuestionUpdate
      } = require('@/lib/websocket/emit-events.js')

      emitQuestionRevising(
        question.mlQuestionId,
        feedback,
        question.mlAccount.organizationId
      )

      emitAgentStep(
        question.id,
        question.mlAccount.organizationId,
        'revising',
        { status: 'Gemini 3.0 Pro revisando resposta...' }
      )

      try {
        // Buscar dados do produto
        const { getValidMLToken } = await import('@/lib/ml-api/token-manager')
        const accessToken = await getValidMLToken(question.mlAccount.id)

        let itemData: any = {
          id: question.itemId,
          title: question.itemTitle || 'Produto',
          price: question.itemPrice || 0,
          permalink: question.itemPermalink || ''
        }

        let descriptionData = null

        if (accessToken) {
          try {
            const [itemResponse, descResponse] = await Promise.all([
              fetch(`https://api.mercadolibre.com/items/${question.itemId}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              }),
              fetch(`https://api.mercadolibre.com/items/${question.itemId}/description`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              })
            ])

            if (itemResponse.ok) itemData = await itemResponse.json()
            if (descResponse.ok) descriptionData = await descResponse.json()
          } catch (_err) {
            logger.warn('[Revision] Using fallback product data')
          }
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

        // Preparar input
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

        // ✅ MULTI-TENANT: Usar instância da organização
        const mlAgentService = getMLAgentServiceForOrganization(question.mlAccount.organizationId)

        logger.info('[Revision] Using org-specific agent instance', {
          organizationId: question.mlAccount.organizationId,
          questionId: question.id,
        })

        // 🤖 REVISAR com Gemini (streaming via WebSocket) - MODO ASYNC
        // Não aguardar conclusão - streaming via WebSocket notifica frontend
        mlAgentService.reviseResponseWithStreaming({
          questionId: question.id,
          questionInput,
          context: questionContext,
          organizationId: question.mlAccount.organizationId,
          originalResponse: question.aiSuggestion || '',
          revisionFeedback: feedback,
        }).then(async (revisedResponse) => {
          // ✅ Sucesso: Atualizar banco após streaming completar
          await prisma.question.update({
            where: { id: questionId },
            data: {
              aiSuggestion: revisedResponse.content,
              aiConfidence: revisedResponse.confidence,
              status: "AWAITING_APPROVAL",
              processedAt: new Date(),
            }
          })

          // Emitir evento question:updated para UI
          emitQuestionUpdate(
            question.mlQuestionId,
            "AWAITING_APPROVAL",
            {
              organizationId: question.mlAccount.organizationId,
              aiSuggestion: revisedResponse.content,
              aiConfidence: revisedResponse.confidence,
            }
          )

          logger.info("✅ [Revision] AI revision completed", {
            questionId: question.id,
            confidence: revisedResponse.confidence,
            tokensUsed: revisedResponse.tokensUsed.totalTokens,
          })
        }).catch(async (error) => {
          // ❌ Erro: Reverter status e notificar
          logger.error("[Revision] AI revision failed in background", {
            error: error.message
          })

          await prisma.question.update({
            where: { id: questionId },
            data: {
              status: 'AWAITING_APPROVAL',
              aiSuggestion: question.aiSuggestion
            }
          })

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
        logger.info("✅ [Revision] Streaming started successfully", {
          questionId: question.id,
        })

        return NextResponse.json({
          success: true,
          type: 'ai_revision',
          message: 'Revision started - streaming via WebSocket',
          questionId: question.id,
        })

      } catch (revisionError: any) {
        // Erro ao INICIAR revisão (não ao processar)
        logger.error("[Revision] Failed to start revision", {
          error: revisionError.message
        })

        // Reverter status
        await prisma.question.update({
          where: { id: questionId },
          data: {
            status: 'AWAITING_APPROVAL',
          }
        })

        return NextResponse.json({
          error: `Erro ao iniciar revisão: ${revisionError.message}`,
        }, { status: 500 })
      }
    }

    // Se chegou aqui, erro
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  } catch (error: any) {
    logger.error("[Revision API] Error:", { error: error.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
