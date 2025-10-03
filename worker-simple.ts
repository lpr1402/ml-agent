/**
 * Worker Principal - Envia respostas APROVADAS ao Mercado Livre
 * Production-ready com processamento INSTANTÂNEO
 * Recebe notificações em tempo real via Redis pub/sub
 */

import { logger } from './lib/logger'
import { prisma } from './lib/prisma'
import { getValidMLToken } from './lib/ml-api/token-manager'
import { getTokenRefreshManager } from './lib/ml-api/token-refresh-manager'
import { mlAccountsUpdater } from './lib/jobs/update-ml-accounts'
import Redis from 'ioredis'

// Configuração seguindo ML Best Practices
const MAX_RETRIES = 3
const BATCH_SIZE = 10
const INSTANT_PROCESS_DELAY = 100 // 100ms para evitar race conditions
const DELAY_BETWEEN_REQUESTS_MS = 500 // 500ms entre requisições (evita burst e 429)

// Redis para receber notificações em tempo real
const redisConfig: any = {
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['REDIS_PORT'] || '6379')
}

if (process.env['REDIS_PASSWORD']) {
  redisConfig.password = process.env['REDIS_PASSWORD']
}

const redis = new Redis(redisConfig)
const pubsub = new Redis(redisConfig)

/**
 * Processar perguntas APROVADAS instantaneamente
 * Agora com isolamento por conta ML
 */
async function processQuestions(filterQuestionId?: string): Promise<boolean> {
  try {
    // Buscar APENAS perguntas APROVADAS para enviar ao ML
    // Se filterQuestionId fornecido, processar apenas essa pergunta (processamento instantâneo)
    const questions = await prisma.question.findMany({
      where: {
        status: 'APPROVED',
        retryCount: { lt: MAX_RETRIES },
        ...(filterQuestionId ? { id: filterQuestionId } : {})
      },
      take: filterQuestionId ? 1 : BATCH_SIZE,
      orderBy: { receivedAt: 'asc' },
      include: {
        mlAccount: true
      }
    })
    
    if (questions.length === 0) {
      return false // Retorna false se não há perguntas
    }
    
    logger.info(`[Worker] Processing ${questions.length} questions`)
    
    for (const question of questions) {
      const startTime = Date.now()
      try {
        // Verificar se tem resposta AI
        if (!question.aiSuggestion) {
          logger.warn(`[Worker] Question ${question.id} has no AI suggestion, skipping`)
          continue
        }
        
        // Obter token válido com refresh automático
        const accessToken = await getValidMLToken(question.mlAccount.id)

        if (!accessToken) {
          logger.error(`[Worker] Failed to get valid token for account ${question.mlAccount.id}`)
          await prisma.question.update({
            where: { id: question.id },
            data: {
              status: 'TOKEN_ERROR',
              failedAt: new Date(),
              failureReason: 'Token inválido ou conta inativa'
            }
          })
          continue
        }
        
        // Enviar resposta para ML
        const response = await fetch('https://api.mercadolibre.com/answers', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            question_id: question.mlQuestionId,
            text: question.aiSuggestion || question.answer || ''
          })
        })
        
        if (response.ok) {
          // Sucesso - marcar como SENT_TO_ML, NÃO como COMPLETED
          await prisma.question.update({
            where: { id: question.id },
            data: {
              status: 'SENT_TO_ML', // Enviada ao ML, aguardando confirmação manual
              sentToMLAt: new Date(),
              mlResponseCode: response.status,
              mlResponseData: await response.text()
            }
          })
          logger.info(`[Worker] Question ${question.id} sent to ML successfully in ${Date.now() - startTime}ms`, {
          mlAccountId: question.mlAccount.id,
          organizationId: question.mlAccount.organizationId
        })

        // Emitir evento de sucesso via Redis
        await redis.publish('question:sent_to_ml', JSON.stringify({
          questionId: question.id,
          mlQuestionId: question.mlQuestionId,
          mlAccountId: question.mlAccount.id,
          organizationId: question.mlAccount.organizationId,
          status: 'SENT_TO_ML',
          timestamp: new Date()
        }))
        } else {
          // Erro
          const errorText = await response.text()
          await prisma.question.update({
            where: { id: question.id },
            data: {
              status: 'FAILED', // Sempre FAILED, nunca RATE_LIMITED
              retryCount: { increment: 1 },
              mlResponseCode: response.status,
              mlResponseData: errorText,
              failedAt: new Date()
            }
          })
          logger.error(`[Worker] Question ${question.id} failed: ${response.status}`)
        }
        
        // Delay entre requisições para evitar burst (ML best practice)
        // SEMPRE aplicar delay para distribuir requisições ao longo do tempo
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS))
        
      } catch (error) {
        logger.error(`[Worker] Error processing question ${question.id}:`, { error })
        await prisma.question.update({
          where: { id: question.id },
          data: {
            retryCount: { increment: 1 },
            status: 'FAILED',
            failedAt: new Date()
          }
        })
      }
    }
    return true // Retorna true se processou perguntas
  } catch (error) {
    logger.error('[Worker] Error in processQuestions:', { error })
    return false
  }
}

/**
 * Limpar dados antigos
 */
async function cleanupOldData() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    // Limpar perguntas antigas
    const deletedQuestions = await prisma.question.deleteMany({
      where: {
        receivedAt: { lt: thirtyDaysAgo },
        status: { in: ['COMPLETED', 'FAILED'] }
      }
    })
    
    if (deletedQuestions.count > 0) {
      logger.info(`[Worker] Cleaned up ${deletedQuestions.count} old questions`)
    }
    
    // Limpar sessões expiradas
    const deletedSessions = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    })
    
    if (deletedSessions.count > 0) {
      logger.info(`[Worker] Cleaned up ${deletedSessions.count} expired sessions`)
    }
    
    // Limpar OAuth states antigos
    const deletedStates = await prisma.oAuthState.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    })
    
    if (deletedStates.count > 0) {
      logger.info(`[Worker] Cleaned up ${deletedStates.count} expired OAuth states`)
    }
    
  } catch (error) {
    logger.error('[Worker] Error in cleanupOldData:', { error })
  }
}

/**
 * Processar pergunta específica instantaneamente
 */
async function processInstantQuestion(questionId: string) {
  const startTime = Date.now()
  try {
    logger.info(`[Worker] 🚀 INSTANT processing question ${questionId}`)
    await processQuestions(questionId)
    logger.info(`[Worker] ✅ INSTANT processed in ${Date.now() - startTime}ms`)
  } catch (error) {
    logger.error(`[Worker] ❌ INSTANT processing failed for ${questionId}:`, { error })
  }
}

/**
 * Loop principal do worker
 */
async function main() {
  logger.info('[Worker] Starting optimized worker with INSTANT processing...')

  // Inicializar TokenRefreshManager para manter tokens atualizados 24/7
  getTokenRefreshManager()
  logger.info('[Worker] TokenRefreshManager initialized - tokens will be refreshed automatically')

  // Inicializar MLAccountsUpdater para atualizar dados das contas a cada 3 horas
  mlAccountsUpdater.start()
  logger.info('[Worker] MLAccountsUpdater initialized - account data will be updated every 3 hours')

  // NOVO: Subscribe para processar APPROVED instantaneamente
  pubsub.subscribe('question:approved')
  pubsub.on('message', async (channel, message) => {
    if (channel === 'question:approved') {
      try {
        const data = JSON.parse(message)
        logger.info(`[Worker] 📨 Received APPROVED notification for question ${data.questionId}`)

        // Pequeno delay para garantir que o banco foi atualizado
        await new Promise(resolve => setTimeout(resolve, INSTANT_PROCESS_DELAY))

        // Processar instantaneamente
        await processInstantQuestion(data.questionId)
      } catch (error) {
        logger.error('[Worker] Error processing instant approval:', { error })
      }
    }
  })

  logger.info('[Worker] 📡 Listening for APPROVED questions via Redis pub/sub')

  // Cleanup inicial
  await cleanupOldData()

  // Ainda fazer polling para pegar perguntas perdidas (fallback)
  const runFallbackWorker = async () => {
    const hadQuestions = await processQuestions()

    // Polling mais espaçado já que temos notificações instantâneas
    const nextInterval = hadQuestions ? 30000 : 60000 // 30s se tinha perguntas, 60s se não
    setTimeout(runFallbackWorker, nextInterval)
  }

  // Iniciar fallback worker após 10 segundos
  setTimeout(runFallbackWorker, 10000)
  
  // Cleanup diário
  setInterval(cleanupOldData, 24 * 60 * 60 * 1000)
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('[Worker] Received SIGTERM, shutting down...')
    mlAccountsUpdater.stop() // Para o job de atualização
    process.exit(0)
  })

  process.on('SIGINT', () => {
    logger.info('[Worker] Received SIGINT, shutting down...')
    mlAccountsUpdater.stop() // Para o job de atualização
    process.exit(0)
  })
}

// Iniciar worker
main().catch(error => {
  logger.error('[Worker] Fatal error:', { error })
  process.exit(1)
})