/**
 * Worker Simples - Processamento de tarefas em background
 * Production-ready com retry e error handling
 */

import { logger } from './lib/logger'
import { prisma } from './lib/prisma'
import { getValidMLToken } from './lib/ml-api/token-manager'
import { getTokenRefreshManager } from './lib/ml-api/token-refresh-manager'

// Configuração
const POLL_INTERVAL = 30000 // 30 segundos - reduzido para economia de CPU
const MAX_RETRIES = 3
const BATCH_SIZE = 10

/**
 * Processar perguntas pendentes
 */
async function processQuestions(): Promise<boolean> {
  try {
    // Buscar APENAS perguntas APROVADAS para enviar ao ML
    // NUNCA enviar perguntas PROCESSING ou AWAITING_APPROVAL
    const questions = await prisma.question.findMany({
      where: {
        status: 'APPROVED', // APENAS perguntas aprovadas pelo usuário!
        retryCount: { lt: MAX_RETRIES }
      },
      take: BATCH_SIZE,
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
          logger.info(`[Worker] Question ${question.id} sent to ML successfully`)
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
        
        // Delay entre processamentos
        await new Promise(resolve => setTimeout(resolve, 1000))
        
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
 * Loop principal do worker
 */
async function main() {
  logger.info('[Worker] Starting simple worker...')

  // Inicializar TokenRefreshManager para manter tokens atualizados 24/7
  getTokenRefreshManager() // Inicializa o singleton
  logger.info('[Worker] TokenRefreshManager initialized - tokens will be refreshed automatically')

  // Cleanup inicial
  await cleanupOldData()
  
  // Processar perguntas com backoff dinâmico
  let consecutiveEmptyRuns = 0

  const runWorker = async () => {
    const hadQuestions = await processQuestions()

    // Backoff dinâmico: aumenta intervalo se não há trabalho
    if (!hadQuestions) {
      consecutiveEmptyRuns++
      const backoffInterval = Math.min(POLL_INTERVAL * Math.pow(1.5, consecutiveEmptyRuns), 120000) // Max 2 min
      setTimeout(runWorker, backoffInterval)
    } else {
      consecutiveEmptyRuns = 0
      setTimeout(runWorker, POLL_INTERVAL)
    }
  }

  // Iniciar worker
  runWorker()
  
  // Cleanup diário
  setInterval(cleanupOldData, 24 * 60 * 60 * 1000)
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('[Worker] Received SIGTERM, shutting down...')
    process.exit(0)
  })
  
  process.on('SIGINT', () => {
    logger.info('[Worker] Received SIGINT, shutting down...')
    process.exit(0)
  })
}

// Iniciar worker
main().catch(error => {
  logger.error('[Worker] Fatal error:', { error })
  process.exit(1)
})