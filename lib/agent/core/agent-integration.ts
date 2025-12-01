/**
 * Agent Integration - Integração do agente com o sistema existente
 * Substitui N8N com Gemini 3.0 Pro + LangGraph
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { getMLAgentServiceForOrganization } from './ml-agent-service-manager'
import { formatProductInfo, fetchBuyerQuestionsHistory } from '@/lib/webhooks/n8n-payload-builder'
import { decryptToken } from '@/lib/security/encryption'
import type { QuestionInput, QuestionContext } from '../types/agent-types'

/**
 * Processa pergunta com agente IA (substitui N8N)
 */
export async function processQuestionWithAgent(
  question: any,
  enrichedData: {
    itemDetails: any
    itemDescription: any
    sellerData: any
    buyerData: any
  }
): Promise<void> {
  try {
    console.log('🚀🚀🚀 [AgentIntegration] ===== STARTING AI AGENT PROCESSING =====')
    console.log('[AgentIntegration] Question:', {
      mlQuestionId: question.mlQuestionId,
      id: question.id,
      text: question.text?.substring(0, 100),
      itemId: question.itemId,
      mlAccountId: question.mlAccountId
    })

    logger.info('[AgentIntegration] Processing question with AI agent', {
      questionId: question.mlQuestionId,
      itemId: question.itemId,
    })

    // Buscar conta ML completa
    const fullMlAccount = await prisma.mLAccount.findUnique({
      where: { id: question.mlAccountId },
      include: {
        organization: true,
      },
    })

    if (!fullMlAccount) {
      logger.error('[AgentIntegration] ML Account not found')
      await prisma.question.update({
        where: { id: question.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: 'ML Account not found',
        },
      })
      return
    }

    // Buscar histórico de perguntas do comprador
    const buyerQuestions = await fetchBuyerQuestionsHistory(
      question.customerId || '',
      fullMlAccount.organizationId,
      question.mlQuestionId,
      prisma,
      decryptToken
    )

    // Formatar informações do produto (mesma lógica do N8N)
    const productInfoFormatted = formatProductInfo(
      {
        ...enrichedData.itemDetails,
        description: enrichedData.itemDescription,
      }
    )

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
      product: null, // Raw data disponível se necessário
      productImages: [], // TODO: Buscar imagens se necessário
      productDescription: productInfoFormatted,
      buyerHistory: buyerQuestions,
      buyerProfile: null,
      sellerNickname: fullMlAccount.nickname,
      sellerReputation: fullMlAccount.sellerReputation as any,
      similarQuestions: [],
      organizationPreferences: null,
    }

    // Atualizar status para PROCESSING
    await prisma.question.update({
      where: { id: question.id },
      data: {
        status: 'PROCESSING',
        sentToAIAt: new Date(),
        processedAt: new Date(),
      },
    })

    // ✅ MULTI-TENANT: Obter instância isolada para esta organização
    const mlAgentService = getMLAgentServiceForOrganization(fullMlAccount.organizationId)

    logger.info('[AgentIntegration] Using org-specific agent instance', {
      organizationId: fullMlAccount.organizationId,
      questionId: question.mlQuestionId,
    })

    // ✅ PROCESSAR COM TOOLS (Gemini 3 Pro function calling)
    // Tools disponíveis: get_product_info, get_buyer_history, search_similar_questions, etc
    const response = await mlAgentService.processQuestionWithTools({
      questionId: question.id,
      questionInput,
      context: questionContext,
      organizationId: fullMlAccount.organizationId,
      mlAccountId: fullMlAccount.id,
    })

    // Atualizar pergunta com resposta do agente
    await prisma.question.update({
      where: { id: question.id },
      data: {
        aiSuggestion: response.content,
        aiConfidence: response.confidence,
        status: 'AWAITING_APPROVAL',
        aiProcessedAt: new Date(),
        processedAt: new Date(),
      },
    })

    logger.info('[AgentIntegration] Question processed successfully', {
      questionId: question.mlQuestionId,
      confidence: response.confidence,
      responseLength: response.content.length,
      tokensUsed: response.tokensUsed.totalTokens,
      processingTime: response.processingTime,
    })

    // 🔴 FIX CRÍTICO: Emitir evento question:updated IMEDIATAMENTE após salvar no banco
    const { emitQuestionUpdate } = require('@/lib/websocket/emit-events.js')

    await emitQuestionUpdate(
      question.mlQuestionId,
      'AWAITING_APPROVAL',
      {
        organizationId: fullMlAccount.organizationId,
        mlQuestionId: question.mlQuestionId,
        questionId: question.id,
        aiSuggestion: response.content,
        aiConfidence: response.confidence,
        data: {
          aiSuggestion: response.content,
          aiConfidence: response.confidence,
          aiProcessedAt: new Date().toISOString(),
          status: 'AWAITING_APPROVAL'
        }
      }
    )

    logger.info('[AgentIntegration] ✅ WebSocket event emitted successfully', {
      questionId: question.mlQuestionId,
      organizationId: fullMlAccount.organizationId,
      status: 'AWAITING_APPROVAL'
    })

    // Enviar notificações (WhatsApp, Push, etc)
    await sendNotifications(question, response, fullMlAccount)
  } catch (error: any) {
    logger.error('[AgentIntegration] Error processing with agent', {
      questionId: question.mlQuestionId,
      error: error.message,
    })

    // Marcar como FAILED
    await prisma.question.update({
      where: { id: question.id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: `Erro no processamento do agente: ${error.message}`,
      },
    })

    // Emitir erro
    const { emitQuestionFailed } = require('@/lib/websocket/emit-events.js')
    const mlAccount = await prisma.mLAccount.findUnique({
      where: { id: question.mlAccountId },
      select: { organizationId: true },
    })

    if (mlAccount) {
      await emitQuestionFailed(
        question.mlQuestionId,
        `Erro no agente: ${error.message}`,
        true, // retryable
        mlAccount.organizationId,
        {
          type: 'AGENT_ERROR',
          code: error.code || 'UNKNOWN',
          hasResponse: false,
        }
      )
    }
  }
}

/**
 * Envia notificações após resposta gerada
 */
async function sendNotifications(
  question: any,
  response: any,
  mlAccount: any
): Promise<void> {
  try {
    // Enviar WhatsApp notification
    const { evolutionWhatsAppService } = await import('@/lib/services/evolution-whatsapp')

    const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'https://gugaleo.axnexlabs.com.br'
    const approvalUrl = `${baseUrl}/agente?source=whatsapp&utm_medium=notification`

    const notificationData = {
      sequentialId: question.sequentialId || '00/0000',
      questionText: question.text || '',
      productTitle: question.itemTitle || 'Produto',
      productPrice: question.itemPrice || 0,
      suggestedAnswer: response.content,
      approvalUrl,
      sellerName: mlAccount.nickname,
      questionId: question.id,
      mlAccountId: mlAccount.id,
      organizationId: mlAccount.organizationId,
    }

    const sent = await evolutionWhatsAppService.sendQuestionNotification(notificationData)

    if (sent) {
      logger.info('[AgentIntegration] WhatsApp notification sent', {
        questionId: question.mlQuestionId,
      })
    }
  } catch (notifError) {
    logger.error('[AgentIntegration] Notification error (non-fatal)', {
      error: notifError,
    })
  }
}
