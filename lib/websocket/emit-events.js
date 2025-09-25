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
 * Emit when question fails
 */
function emitQuestionFailed(questionId, reason, retryable, organizationId) {
  emitQuestionUpdate(questionId, QuestionStatus.FAILED, {
    organizationId,
    failureReason: reason,
    failedAt: new Date().toISOString(),
    retryable: retryable || false
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
  publishEvent // Export for custom events
}