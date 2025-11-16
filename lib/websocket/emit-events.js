/**
 * WebSocket Event Emitter for Production
 * Uses Redis Pub/Sub for inter-process communication
 */

const Redis = require('ioredis')
const { QuestionStatus } = require('../constants/question-status.js')

// Create Redis client for publishing
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 50, 2000)
})

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err)
})

redis.on('connect', () => {
  console.log('[Redis] Connected for WebSocket events')
})

/**
 * Publish event to Redis channel
 * @param {string} channel - Redis channel name
 * @param {object} data - Event data
 */
async function publishEvent(channel, data) {
  try {
    const message = JSON.stringify({
      ...data,
      timestamp: Date.now()
    })

    await redis.publish(channel, message)

    console.log('[WebSocket Events] Published to channel:', channel, {
      organizationId: data.organizationId,
      type: data.type || channel
    })

    return true
  } catch (error) {
    console.error('[WebSocket Events] Failed to publish:', error)
    return false
  }
}

/**
 * Emit new question event to all clients in organization
 */
function emitNewQuestion(question) {
  const organizationId = question.organizationId || 'org-default'

  const eventData = {
    organizationId,
    type: 'new',
    question: {
      id: question.id,
      mlQuestionId: question.mlQuestionId,
      text: question.text,
      itemTitle: question.itemTitle,
      itemPrice: question.itemPrice,
      itemId: question.itemId,
      itemPermalink: question.itemPermalink,
      status: question.status || QuestionStatus.PENDING,
      receivedAt: question.receivedAt || new Date(),
      mlAccount: question.mlAccount
    }
  }

  publishEvent('question:new', eventData)

  console.log('[WebSocket Events] Emitted new question:', {
    questionId: question.mlQuestionId,
    accountNickname: question.mlAccount?.nickname,
    organizationId
  })
}

/**
 * Emit question update event
 */
function emitQuestionUpdate(questionId, status, data) {
  const organizationId = data.organizationId || 'org-default'

  const eventData = {
    organizationId,
    questionId,
    status,
    data: data || {},
    type: 'update'
  }

  publishEvent('question:updated', eventData)

  console.log('[WebSocket Events] Emitted question update:', {
    questionId,
    status,
    organizationId
  })
}

/**
 * Emit when question is being processed by AI
 */
function emitQuestionProcessing(questionId, organizationId) {
  emitQuestionUpdate(questionId, QuestionStatus.PROCESSING, {
    organizationId,
    processingStartedAt: new Date().toISOString()
  })
}

/**
 * Emit when question is awaiting approval
 */
function emitQuestionAwaitingApproval(questionId, aiSuggestion, organizationId) {
  emitQuestionUpdate(questionId, QuestionStatus.AWAITING_APPROVAL, {
    organizationId,
    aiSuggestion,
    readyForApproval: true,
    aiProcessedAt: new Date().toISOString()
  })
}

/**
 * Emit when question is approved
 */
function emitQuestionApproved(questionId, answer, approvalType, organizationId) {
  emitQuestionUpdate(questionId, QuestionStatus.APPROVED, {
    organizationId,
    answer,
    approvalType,
    approvedAt: new Date().toISOString()
  })
}

/**
 * Emit when question is sent to ML
 */
function emitQuestionSentToML(questionId, mlResponseCode, organizationId) {
  emitQuestionUpdate(questionId, QuestionStatus.SENT_TO_ML, {
    organizationId,
    mlResponseCode,
    sentToMLAt: new Date().toISOString()
  })
}

/**
 * Emit when question is completed
 */
function emitQuestionCompleted(questionId, mlResponseCode, mlResponseData, organizationId) {
  emitQuestionUpdate(questionId, QuestionStatus.COMPLETED, {
    organizationId,
    mlResponseCode,
    mlResponseData,
    completedAt: new Date().toISOString(),
    success: true
  })
}

/**
 * Emit when question fails - Enhanced with error details
 */
function emitQuestionFailed(questionId, reason, retryable, organizationId, errorDetails = {}) {
  const errorData = {
    organizationId,
    failureReason: reason,
    failedAt: new Date().toISOString(),
    retryable: retryable !== false, // Default true
    errorType: errorDetails.type || 'PROCESSING_ERROR',
    errorCode: errorDetails.code || 'ERROR',
    hasResponse: errorDetails.hasResponse || false
  }

  emitQuestionUpdate(questionId, QuestionStatus.FAILED, errorData)

  // Also emit specific error event for real-time feedback
  publishEvent('question:error', {
    organizationId,
    questionId,
    ...errorData,
    type: 'error'
  })

  console.log('[WebSocket Events] Emitted question error:', {
    questionId,
    errorType: errorData.errorType,
    organizationId
  })
}

/**
 * Emit when question is being revised
 */
function emitQuestionRevising(questionId, feedback, organizationId) {
  emitQuestionUpdate(questionId, QuestionStatus.REVISING, {
    organizationId,
    userFeedback: feedback,
    revisingStartedAt: new Date().toISOString()
  })
}

/**
 * Emit custom event to specific ML account
 */
async function emitToMLAccount(mlAccountId, event, data) {
  try {
    const eventData = {
      mlAccountId,
      event,
      data,
      timestamp: Date.now()
    }

    // Publish to account-specific channel
    await publishEvent(`account:${mlAccountId}:${event}`, eventData)

    console.log('[WebSocket Events] Emitted to ML account:', {
      mlAccountId,
      event
    })
  } catch (error) {
    console.error('[WebSocket Events] Failed to emit to account:', error)
  }
}

/**
 * Emit metrics update
 */
async function emitMetricsUpdate(organizationId, metrics) {
  try {
    const eventData = {
      organizationId,
      metrics,
      type: 'metrics'
    }

    await publishEvent('metrics:updated', eventData)

    console.log('[WebSocket Events] Emitted metrics update:', {
      organizationId
    })
  } catch (error) {
    console.error('[WebSocket Events] Failed to emit metrics:', error)
  }
}

/**
 * Emit when AI processes a question and returns response
 */
async function emitQuestionProcessed(questionId, answer, organizationId) {
  try {
    const eventData = {
      organizationId,
      questionId,
      answer,
      status: 'AI_PROCESSED',
      type: 'processed'
    }

    await publishEvent('question:events', eventData)
    await publishEvent('question:updated', {
      ...eventData,
      status: 'AWAITING_APPROVAL'
    })

    console.log('[WebSocket Events] Emitted question processed:', {
      organizationId,
      questionId
    })
  } catch (error) {
    console.error('[WebSocket Events] Failed to emit question processed:', error)
  }
}

/**
 * Emit when answer is received from AI (N8N)
 */
async function emitAnswerReceived(questionId, answerData, organizationId) {
  try {
    const eventData = {
      organizationId,
      questionId,
      data: answerData,
      type: 'answer_received'
    }

    await publishEvent('question:events', eventData)
    await publishEvent('question:updated', {
      organizationId,
      questionId,
      status: answerData.status || 'AWAITING_APPROVAL',
      data: answerData
    })

    console.log('[WebSocket Events] Emitted answer received:', {
      organizationId,
      questionId,
      status: answerData.status
    })
  } catch (error) {
    console.error('[WebSocket Events] Failed to emit answer received:', error)
  }
}

/**
 * Generic question event emitter for specific events like revising, awaiting_approval
 */
async function emitQuestionEvent(questionId, eventType, data, organizationId) {
  try {
    const eventData = {
      organizationId,
      questionId,
      type: eventType,
      ...data
    }

    // Emit to question-specific channel
    await publishEvent(`question:${eventType}`, eventData)

    console.log('[WebSocket Events] Emitted question event:', {
      questionId,
      eventType,
      organizationId
    })
  } catch (error) {
    console.error('[WebSocket Events] Failed to emit question event:', error)
  }
}

/**
 * ⚡ Emit stock update event - Real-time inventory updates
 */
async function emitStockUpdate(organizationId, stockData) {
  try {
    const eventData = {
      organizationId,
      type: 'stock_update',
      inventory_id: stockData.inventory_id,
      item_id: stockData.item_id,
      operation_type: stockData.operation_type,
      available_change: stockData.available_change,
      total_change: stockData.total_change,
      new_available: stockData.new_available,
      new_total: stockData.new_total,
      timestamp: stockData.timestamp,
      item_title: stockData.item_title,
      item_thumbnail: stockData.item_thumbnail
    }

    await publishEvent('stock:updated', eventData)

    console.log('[WebSocket Events] Emitted stock update:', {
      organizationId,
      inventoryId: stockData.inventory_id,
      operationType: stockData.operation_type,
      availableChange: stockData.available_change
    })
  } catch (error) {
    console.error('[WebSocket Events] Failed to emit stock update:', error)
  }
}

/**
 * ⚡ Emit stock alert - Critical inventory alerts
 */
async function emitStockAlert(organizationId, alert) {
  try {
    const eventData = {
      organizationId,
      type: 'stock_alert',
      inventory_id: alert.inventoryId,
      item_id: alert.itemId,
      item_title: alert.itemTitle,
      alert_level: alert.alertLevel,
      message: alert.message,
      days_of_cover: alert.daysOfCover,
      current_stock: alert.currentStock,
      recommended_qty: alert.recommendedQty,
      timestamp: Date.now()
    }

    await publishEvent('stock:alert', eventData)

    console.log('[WebSocket Events] Emitted stock alert:', {
      organizationId,
      inventoryId: alert.inventoryId,
      alertLevel: alert.alertLevel
    })
  } catch (error) {
    console.error('[WebSocket Events] Failed to emit stock alert:', error)
  }
}

/**
 * ⚡ Emit stock analysis complete - Análise finalizada
 */
async function emitStockAnalysisComplete(organizationId, data) {
  try {
    const eventData = {
      organizationId,
      type: 'stock_analysis_complete',
      items_analyzed: data.itemsAnalyzed || 0,
      critical_items: data.criticalItems || 0,
      warning_items: data.warningItems || 0,
      timestamp: Date.now()
    }

    await publishEvent('stock:analysis_complete', eventData)

    console.log('[WebSocket Events] Emitted stock analysis complete:', {
      organizationId,
      itemsAnalyzed: data.itemsAnalyzed
    })
  } catch (error) {
    console.error('[WebSocket Events] Failed to emit stock analysis complete:', error)
  }
}

/**
 * ⚡ Emit global stock stats - Estatísticas globais
 */
async function emitGlobalStockStats(stats) {
  try {
    const eventData = {
      type: 'global_stock_stats',
      ...stats
    }

    await publishEvent('stock:global_stats', eventData)

    console.log('[WebSocket Events] Emitted global stock stats')
  } catch (error) {
    console.error('[WebSocket Events] Failed to emit global stock stats:', error)
  }
}

/**
 * 🎮 Emit XP earned event (gamification)
 * @param {string} organizationId
 * @param {object} data - XP data
 */
function emitXPEarned(organizationId, data) {
  const eventData = {
    organizationId,
    type: 'xp:earned',
    data
  }

  return publishEvent(`organization:${organizationId}`, eventData)
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[WebSocket Events] Shutting down Redis connection')
  await redis.quit()
})

module.exports = {
  emitNewQuestion,
  emitQuestionUpdate,
  emitQuestionProcessing,
  emitQuestionAwaitingApproval,
  emitQuestionApproved,
  emitQuestionSentToML,
  emitQuestionCompleted,
  emitQuestionFailed,
  emitQuestionRevising,
  emitQuestionProcessed,
  emitAnswerReceived,
  emitToMLAccount,
  emitMetricsUpdate,
  emitQuestionEvent,
  emitStockUpdate, // ⚡ Stock events
  emitStockAlert, // ⚡ Stock alerts
  emitStockAnalysisComplete, // ⚡ Analysis complete
  emitGlobalStockStats, // ⚡ Global stats
  emitXPEarned, // 🎮 Gamification events
  publishEvent // Export for custom events
}