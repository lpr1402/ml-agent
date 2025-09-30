#!/usr/bin/env node

/**
 * Queue Worker Otimizado - ML Agent Real-Time Processing
 * Dezembro 2025 - Processamento em tempo real sem prioridades
 * Todas as perguntas de uma organização processadas igualmente
 */

require('dotenv').config()

const Bull = require('bull')
const Redis = require('ioredis')
const { prisma } = require('./lib/prisma-client')
const { circuitBreaker } = require('./lib/ml-api/circuit-breaker-429')

// Redis configuration para Bull Queue
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  enableOfflineQueue: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  keepAlive: 1000,
  connectTimeout: 10000,
  lazyConnect: false
}

// Redis client direto para pub/sub e cache
const redis = new Redis({
  ...redisConfig,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
})

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err)
})

redis.on('connect', () => {
  console.log('✅ Redis connected successfully')
})

// Fila única para todas as perguntas - SEM PRIORIDADES
const questionQueue = new Bull('ml-questions-realtime', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100, // Manter apenas últimos 100 para economia de memória
    removeOnFail: 50,
    attempts: 3, // Reduzido para falhar rápido
    backoff: {
      type: 'fixed',
      delay: 1000 // 1 segundo entre tentativas
    },
    timeout: 10000 // 10 segundos timeout por job
  }
})

// Fila para webhooks em tempo real
const webhookQueue = new Bull('ml-webhooks-realtime', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 500
    },
    timeout: 5000 // 5 segundos timeout
  }
})

// Fila para refresh de tokens
const tokenQueue = new Bull('ml-tokens', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
})

console.log('🚀 Queue Worker REAL-TIME Started')
console.log(`📊 Configuration:
  - Redis: ${redisConfig.host}:${redisConfig.port}
  - Environment: ${process.env.NODE_ENV || 'development'}
  - Mode: REAL-TIME (todas as perguntas processadas igualmente)
  - Concurrency: Otimizada para tempo real
`)

// Tracking de processamento por conta ML para evitar rate limit
const activeProcessingByAccount = new Map()
const MAX_CONCURRENT_PER_ACCOUNT = 5 // Máximo 5 requisições simultâneas por conta ML
const GLOBAL_MAX_CONCURRENT = 30 // Máximo global de 30 para processar mais rápido

/**
 * PROCESSADOR ÚNICO DE PERGUNTAS - Tempo Real
 * Todas as perguntas processadas igualmente sem distinção
 * Otimizado para experiência em tempo real
 * COM LIMITE POR CONTA ML para evitar 429
 */
questionQueue.process(GLOBAL_MAX_CONCURRENT, async (job) => { // Aumentado para 30
  const startTime = Date.now()
  const { mlQuestionId, mlAccountId, organizationId, questionText, itemTitle } = job.data

  // Verificar circuit breaker primeiro (proteção 429)
  const canExecute = await circuitBreaker.canExecute(mlAccountId)
  if (!canExecute) {
    const waitTime = await circuitBreaker.getWaitTime(mlAccountId)
    console.log(`🔴 Circuit breaker OPEN for ${mlAccountId}, waiting ${Math.round(waitTime/1000)}s`)
    await job.moveToDelayed(Date.now() + waitTime, { skipAttempt: true })
    return { success: false, reason: 'circuit_breaker_open', waitTime }
  }

  // Verificar limite de concorrência por conta ML
  const currentProcessing = activeProcessingByAccount.get(mlAccountId) || 0
  if (currentProcessing >= MAX_CONCURRENT_PER_ACCOUNT) {
    // Requeue com delay para não ultrapassar limite da conta
    console.log(`⏳ Account ${mlAccountId} at limit (${currentProcessing}/${MAX_CONCURRENT_PER_ACCOUNT}), delaying...`)
    await job.moveToDelayed(Date.now() + 2000, { skipAttempt: true })
    return { success: false, reason: 'account_rate_limited', delayed: true }
  }

  // Incrementar contador da conta
  activeProcessingByAccount.set(mlAccountId, currentProcessing + 1)

  try {
    // Buscar pergunta no banco
    const question = await prisma.question.findFirst({
      where: {
        mlQuestionId,
        mlAccount: {
          organizationId // Isolamento multi-tenant
        }
      },
      include: {
        mlAccount: {
          select: {
            id: true,
            nickname: true,
            organizationId: true
          }
        }
      }
    })

    if (!question) {
      console.warn(`⚠️ Question ${mlQuestionId} not found for org ${organizationId}`)
      return { success: false, reason: 'not_found' }
    }

    // Atualizar status para PROCESSING imediatamente
    await prisma.question.update({
      where: { id: question.id },
      data: {
        status: 'PROCESSING',
        sentToAIAt: new Date()
      }
    })

    // Se já tem sugestão AI, enviar notificação WhatsApp imediatamente
    if (question.aiSuggestion) {
      await webhookQueue.add('send-whatsapp', {
        type: 'approval_request',
        questionId: question.id,
        organizationId,
        mlAccountId,
        sequentialId: question.sequentialId,
        questionText: question.text,
        itemTitle: question.itemTitle,
        suggestedAnswer: question.aiSuggestion,
        sellerName: question.mlAccount.nickname
      }, {
        delay: 0 // Enviar imediatamente
      })
    }

    // Emitir evento para WebSocket (real-time UI update)
    await redis.publish('question:processing', JSON.stringify({
      organizationId,
      mlAccountId,
      mlQuestionId,
      status: 'PROCESSING',
      timestamp: new Date()
    }))

    const processingTime = Date.now() - startTime
    console.log(`⚡ Question ${mlQuestionId} processed in ${processingTime}ms`)

    // Registrar sucesso no circuit breaker
    await circuitBreaker.onSuccess(mlAccountId)

    return {
      success: true,
      questionId: mlQuestionId,
      processingTime,
      organization: organizationId
    }

  } catch (error) {
    console.error(`❌ Error processing question ${mlQuestionId}:`, error.message)

    // Verificar se é erro 429 e registrar no circuit breaker
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
      const retryAfter = error.headers?.['retry-after'] ? parseInt(error.headers['retry-after']) : null
      await circuitBreaker.on429Error(mlAccountId, retryAfter)
      console.log(`⚠️ Rate limit 429 for account ${mlAccountId}`)
    } else {
      // Outros erros
      await circuitBreaker.onError(mlAccountId, error)
    }

    // Atualizar status de erro
    if (job.data.questionId) {
      await prisma.question.update({
        where: { id: job.data.questionId },
        data: {
          status: 'PROCESSING_ERROR',
          failureReason: error.message,
          failedAt: new Date(),
          retryCount: { increment: 1 }
        }
      }).catch(() => {})
    }

    throw error // Re-throw para Bull tentar novamente
  } finally {
    // SEMPRE decrementar contador, mesmo em erro
    const current = activeProcessingByAccount.get(mlAccountId) || 1
    if (current <= 1) {
      activeProcessingByAccount.delete(mlAccountId)
    } else {
      activeProcessingByAccount.set(mlAccountId, current - 1)
    }
  }
})

/**
 * PROCESSADOR DE WEBHOOKS EM TEMPO REAL
 * Envio rápido de notificações WhatsApp
 */
webhookQueue.process(10, async (job) => {
  const { type, ...data } = job.data

  try {
    switch(type) {
      case 'send-whatsapp':
        // Usar serviço Zapster real
        const { zapsterService } = require('./lib/services/zapster-whatsapp')

        const notificationSent = await zapsterService.sendQuestionNotification({
          sequentialId: data.sequentialId || 0,
          questionText: data.questionText || '',
          productTitle: data.itemTitle || 'Produto',
          productPrice: data.itemPrice || 0,
          suggestedAnswer: data.suggestedAnswer || '',
          approvalUrl: '', // Será gerado pelo tokenService
          sellerName: data.sellerName || '',
          questionId: data.questionId,
          mlAccountId: data.mlAccountId,
          organizationId: data.organizationId
        })

        if (notificationSent) {
          console.log(`📱 WhatsApp notification sent for question ${data.questionId}`)

          // Atualizar banco
          await prisma.question.update({
            where: { id: data.questionId },
            data: {
              whatsappSentAt: new Date(),
              status: 'AWAITING_APPROVAL'
            }
          }).catch(() => {})
        }
        break

      case 'process-ml-event':
        // Processar eventos do ML em tempo real
        console.log(`🔄 Processing ML event: ${data.eventType}`)
        // Implementar processamento específico conforme necessário
        break

      default:
        console.warn(`Unknown webhook type: ${type}`)
    }

    return { success: true, type }

  } catch (error) {
    console.error(`Webhook processing error:`, error)
    throw error
  }
})

/**
 * PROCESSADOR DE TOKENS - Mantido como está
 */
tokenQueue.process(2, async (job) => {
  const { mlAccountId } = job.data

  try {
    const account = await prisma.mLAccount.findUnique({
      where: { id: mlAccountId },
      select: {
        tokenExpiresAt: true,
        refreshToken: true,
        refreshTokenIV: true,
        refreshTokenTag: true
      }
    })

    if (!account) {
      throw new Error(`Account ${mlAccountId} not found`)
    }

    // Verificar se precisa renovar (5 minutos antes)
    const now = new Date()
    const expiresAt = new Date(account.tokenExpiresAt)
    const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / 60000

    if (minutesUntilExpiry > 5) {
      // Reagendar para 5 minutos antes de expirar
      const delay = (minutesUntilExpiry - 5) * 60 * 1000
      await tokenQueue.add('refresh-token', { mlAccountId }, {
        delay,
        attempts: 3
      })

      console.log(`🔐 Token still valid for ${Math.round(minutesUntilExpiry)} minutes`)
      return { success: true, renewed: false, nextRefresh: delay }
    }

    // Implementar refresh usando token manager existente
    const { getTokenRefreshManager } = require('./lib/ml-api/token-refresh-manager')
    const tokenManager = getTokenRefreshManager()

    const refreshed = await tokenManager.refreshTokenForAccount(mlAccountId)

    if (refreshed) {
      console.log(`✅ Token refreshed for ${mlAccountId}`)

      // Reagendar próximo refresh (5h50min)
      await tokenQueue.add('refresh-token', { mlAccountId }, {
        delay: (5 * 60 + 50) * 60 * 1000,
        attempts: 3
      })
    }

    return { success: true, renewed: refreshed }

  } catch (error) {
    console.error(`Token refresh error:`, error)
    throw error
  }
})

// Métricas em tempo real
let processedCount = 0
let failedCount = 0
let avgProcessingTime = 0

questionQueue.on('completed', (job, result) => {
  processedCount++
  if (result.processingTime) {
    avgProcessingTime = (avgProcessingTime * (processedCount - 1) + result.processingTime) / processedCount
  }
  console.log(`✅ Processed #${processedCount} - Avg time: ${Math.round(avgProcessingTime)}ms`)
})

questionQueue.on('failed', (job, err) => {
  failedCount++
  console.error(`❌ Failed: ${err.message} (Total: ${failedCount})`)
})

// Health check otimizado para tempo real
setInterval(async () => {
  try {
    const queueStatus = await questionQueue.getJobCounts()
    const webhookStatus = await webhookQueue.getJobCounts()

    // Alertar se fila está crescendo (indica problema de performance)
    if (queueStatus.waiting > 50) {
      console.warn(`⚠️ ALERT: ${queueStatus.waiting} questions waiting in queue!`)
    }

    console.log(`
📊 Real-Time Status:
  Questions: Active ${queueStatus.active}, Waiting ${queueStatus.waiting}
  Webhooks: Active ${webhookStatus.active}, Waiting ${webhookStatus.waiting}
  Processed: ${processedCount} | Failed: ${failedCount}
  Success Rate: ${processedCount > 0 ? ((processedCount / (processedCount + failedCount)) * 100).toFixed(1) : 0}%
  Avg Time: ${Math.round(avgProcessingTime)}ms
`)
  } catch (error) {
    console.error('Health check error:', error)
  }
}, 15000) // A cada 15 segundos para tempo real

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️ ${signal} received - Graceful shutdown...`)

  try {
    // Parar de aceitar novos jobs
    await questionQueue.pause(true)
    await webhookQueue.pause(true)
    await tokenQueue.pause(true)

    // Aguardar jobs ativos (máximo 10 segundos para tempo real)
    const timeout = setTimeout(() => {
      console.log('⏱️ Timeout - forcing shutdown')
      process.exit(1)
    }, 10000)

    // Fechar conexões
    await questionQueue.close()
    await webhookQueue.close()
    await tokenQueue.close()
    await redis.quit()
    await prisma.$disconnect()

    clearTimeout(timeout)
    console.log('✅ Graceful shutdown completed')
    process.exit(0)

  } catch (error) {
    console.error('❌ Shutdown error:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Inicializar processamento de tokens
async function initializeTokenRefresh() {
  try {
    const accounts = await prisma.mLAccount.findMany({
      where: { isActive: true },
      select: { id: true, tokenExpiresAt: true, nickname: true }
    })

    for (const account of accounts) {
      const now = new Date()
      const expiresAt = new Date(account.tokenExpiresAt)
      const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / 60000

      if (minutesUntilExpiry > 0) {
        const delay = Math.max(0, (minutesUntilExpiry - 5) * 60 * 1000)
        await tokenQueue.add('refresh-token', { mlAccountId: account.id }, {
          delay,
          attempts: 3
        })
        console.log(`📅 Token refresh scheduled for ${account.nickname} in ${Math.round(delay / 60000)} minutes`)
      } else {
        // Token já expirado, renovar imediatamente
        await tokenQueue.add('refresh-token', { mlAccountId: account.id }, {
          delay: 0,
          attempts: 3
        })
        console.log(`🔴 Token expired for ${account.nickname}, refreshing now...`)
      }
    }
  } catch (error) {
    console.error('Error initializing token refresh:', error)
  }
}

// Inicializar após 2 segundos para garantir que Redis está pronto
setTimeout(initializeTokenRefresh, 2000)

console.log('⚡ Real-time processing engine ready!')