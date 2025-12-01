/**
 * Helper para emitir eventos WebSocket de qualquer lugar do sistema
 * Usado por webhooks, workers e API routes
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

// Import the CommonJS emit-events module
const websocketEvents = require('./emit-events.js')

// ========== AI AGENT STREAMING EVENTS ==========

/**
 * Emite token do agente durante geração
 */
export async function emitAgentToken(
  questionId: string,
  organizationId: string,
  token: string,
  sequenceNumber: number
): Promise<void> {
  return websocketEvents.emitAgentToken(questionId, organizationId, token, sequenceNumber)
}

/**
 * Emite step do workflow
 */
export async function emitAgentStep(
  questionId: string,
  organizationId: string,
  step: string,
  data?: any
): Promise<void> {
  return websocketEvents.emitAgentStep(questionId, organizationId, step, data)
}

/**
 * Emite conclusão do processamento
 */
export async function emitAgentDone(
  questionId: string,
  organizationId: string,
  response: string,
  confidence: number,
  processingTime: number,
  tokensUsed: number
): Promise<void> {
  return websocketEvents.emitAgentDone(
    questionId,
    organizationId,
    response,
    confidence,
    processingTime,
    tokensUsed
  )
}

/**
 * Emite erro do agente
 */
export async function emitAgentError(
  questionId: string,
  organizationId: string,
  error: string,
  code?: string
): Promise<void> {
  return websocketEvents.emitAgentError(questionId, organizationId, error, code)
}

/**
 * Emite atualização de confiança
 */
export async function emitAgentConfidence(
  questionId: string,
  organizationId: string,
  confidence: number
): Promise<void> {
  return websocketEvents.emitAgentConfidence(questionId, organizationId, confidence)
}

/**
 * Emitir evento de nova pergunta recebida
 */
export async function emitNewQuestion(question: any) {
  try {
    // Get organization ID if not present
    let organizationId = question.organizationId

    if (!organizationId && question.mlAccountId) {
      const mlAccount = await prisma.mLAccount.findUnique({
        where: { id: question.mlAccountId },
        select: { organizationId: true }
      })

      if (!mlAccount) {
        logger.error('[WebSocket Events] ML Account not found', {
          mlAccountId: question.mlAccountId
        })
        return
      }

      organizationId = mlAccount.organizationId
    }

    // Add organizationId to question data
    const questionWithOrg = {
      ...question,
      organizationId
    }

    // Use the CommonJS module to emit
    websocketEvents.emitNewQuestion(questionWithOrg)

    logger.info('[WebSocket Events] New question broadcasted', {
      organizationId,
      questionId: question.mlQuestionId,
      status: question.status
    })
  } catch (error) {
    logger.error('[WebSocket Events] Failed to emit new question', { error })
  }
}

/**
 * Emitir atualização de status de pergunta
 */
export async function emitQuestionUpdate(
  questionId: string,
  status: string,
  additionalData?: any
) {
  try {
    // Buscar pergunta para obter organizationId
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        mlAccount: {
          select: {
            organizationId: true,
            nickname: true
          }
        }
      }
    })

    if (!question) {
      logger.error('[WebSocket Events] Question not found', { questionId })
      return
    }

    const updateData = {
      questionId: question.mlQuestionId,
      status,
      ...additionalData,
      accountNickname: question.mlAccount.nickname
    }

    // Use the CommonJS module to emit
    websocketEvents.emitQuestionUpdate(
      question.mlQuestionId,
      status,
      {
        ...updateData,
        organizationId: question.mlAccount.organizationId
      }
    )

    logger.info('[WebSocket Events] Question update broadcasted', {
      organizationId: question.mlAccount.organizationId,
      questionId: question.mlQuestionId,
      status
    })
  } catch (error) {
    logger.error('[WebSocket Events] Failed to emit question update', { error })
  }
}

/**
 * Emitir quando pergunta é processada pela IA
 */
export async function emitQuestionProcessing(questionId: string, aiSuggestion?: string) {
  await emitQuestionUpdate(questionId, 'PROCESSING', {
    aiSuggestion,
    aiProcessedAt: new Date().toISOString()
  })
}

/**
 * Emitir quando pergunta está pendente (aguardando aprovação)
 */
export async function emitQuestionPending(
  questionId: string,
  aiSuggestion: string
) {
  await emitQuestionUpdate(questionId, 'PENDING', {
    aiSuggestion,
    readyForApproval: true
  })
}

/**
 * Emitir quando pergunta aguarda aprovação (legado)
 */
export async function emitQuestionAwaitingApproval(
  questionId: string,
  aiSuggestion: string
) {
  // Redirecionar para o novo status PENDING
  return emitQuestionPending(questionId, aiSuggestion)
}

/**
 * Emitir quando pergunta é aprovada (vai direto para RESPONDED)
 */
export async function emitQuestionApproved(
  questionId: string,
  answer: string,
  approvalType: string
) {
  await emitQuestionUpdate(questionId, 'RESPONDED', {
    answer,
    approvalType,
    approvedAt: new Date().toISOString(),
    respondedAt: new Date().toISOString()
  })
}

/**
 * Emitir quando pergunta é respondida (novo status unificado)
 */
export async function emitQuestionResponded(
  questionId: string,
  mlResponseCode: number,
  mlResponseData?: any
) {
  await emitQuestionUpdate(questionId, 'RESPONDED', {
    mlResponseCode,
    mlResponseData,
    respondedAt: new Date().toISOString(),
    success: true
  })
}

/**
 * Emitir quando pergunta é enviada ao ML (legado)
 */
export async function emitQuestionSentToML(
  questionId: string,
  mlResponseCode?: number
) {
  // Redirecionar para o novo status RESPONDED
  return emitQuestionResponded(questionId, mlResponseCode || 200, { sentToML: true })
}

/**
 * Emitir quando pergunta é completada (legado)
 */
export async function emitQuestionCompleted(
  questionId: string,
  mlResponseCode: number,
  mlResponseData?: any
) {
  // Redirecionar para o novo status RESPONDED
  return emitQuestionResponded(questionId, mlResponseCode, mlResponseData)
}

/**
 * Emitir quando pergunta falha
 */
export async function emitQuestionFailed(
  questionId: string,
  reason: string,
  retryable: boolean = false
) {
  await emitQuestionUpdate(questionId, 'FAILED', {
    failureReason: reason,
    failedAt: new Date().toISOString(),
    retryable
  })
}

/**
 * Emitir quando pergunta está em revisão
 */
export async function emitQuestionReviewing(
  questionId: string,
  feedback: string
) {
  await emitQuestionUpdate(questionId, 'REVIEWING', {
    userFeedback: feedback,
    reviewingStartedAt: new Date().toISOString()
  })
}

/**
 * Emitir quando pergunta está sendo revisada (legado)
 */
export async function emitQuestionRevising(
  questionId: string,
  feedback: string
) {
  // Redirecionar para o novo status REVIEWING
  return emitQuestionReviewing(questionId, feedback)
}

/**
 * Emitir evento customizado para conta ML
 */
export async function emitToMLAccount(
  mlAccountId: string,
  event: string,
  _data: any
) {
  try {
    logger.info('[WebSocket Events] Custom event would be sent to account', {
      mlAccountId,
      event
    })
    // TODO: Implement custom account events if needed
  } catch (error) {
    logger.error('[WebSocket Events] Failed to emit to account', { error })
  }
}

/**
 * Emitir métricas atualizadas
 */
export async function emitMetricsUpdate(organizationId: string, _metrics: any) {
  try {
    logger.info('[WebSocket Events] Metrics update would be broadcasted', {
      organizationId
    })
    // TODO: Implement metrics events if needed
  } catch (error) {
    logger.error('[WebSocket Events] Failed to emit metrics', { error })
  }
}

/**
 * ⚡ Emitir atualização de estoque Full
 * Real-time updates para UI
 */
export async function emitStockUpdate(organizationId: string, stockData: any) {
  try {
    // Use the CommonJS module to emit
    websocketEvents.emitStockUpdate(organizationId, stockData)

    logger.info('[WebSocket Events] Stock update broadcasted', {
      organizationId,
      inventoryId: stockData.inventory_id,
      operationType: stockData.operation_type,
      availableChange: stockData.available_change
    })
  } catch (error) {
    logger.error('[WebSocket Events] Failed to emit stock update', { error })
  }
}

/**
 * ⚡ Emitir alerta crítico de estoque
 */
export async function emitStockAlert(
  organizationId: string,
  alert: {
    inventoryId: string
    itemId: string
    itemTitle: string
    alertLevel: 'critical' | 'warning' | 'ok'
    message: string
    daysOfCover: number
    currentStock: number
    recommendedQty: number
  }
) {
  try {
    websocketEvents.emitStockAlert(organizationId, alert)

    logger.info('[WebSocket Events] Stock alert broadcasted', {
      organizationId,
      inventoryId: alert.inventoryId,
      alertLevel: alert.alertLevel
    })
  } catch (error) {
    logger.error('[WebSocket Events] Failed to emit stock alert', { error })
  }
}

/**
 * 🎮 Emitir evento de XP ganho (gamificação)
 */
export function emitXPEarned(
  organizationId: string,
  data: {
    mlAccountId: string
    questionId: string
    xpAwarded: number
    newTotalXP: number
    newLevel: number
    leveledUp: boolean
    achievementsUnlocked: Array<{ id: string; title: string; xpReward: number }>
    actionDescription: string
  }
) {
  try {
    websocketEvents.emitXPEarned(organizationId, data)

    logger.info('[WebSocket Events] XP earned broadcasted', {
      organizationId,
      mlAccountId: data.mlAccountId,
      xpAwarded: data.xpAwarded,
      leveledUp: data.leveledUp,
      achievementsCount: data.achievementsUnlocked.length
    })
  } catch (error) {
    logger.error('[WebSocket Events] Failed to emit XP earned', { error })
  }
}