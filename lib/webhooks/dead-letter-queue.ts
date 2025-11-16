/**
 * DEAD LETTER QUEUE (DLQ) - Enterprise Grade
 * Gerencia webhooks que falharam após múltiplas tentativas
 * Permite retry manual ou automático
 * Outubro 2025 - Production Ready
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

const DLQ_PREFIX = 'dlq:webhook'
const MAX_RETRIES = 3
const RETRY_DELAYS = [5000, 30000, 300000] // 5s, 30s, 5min

/**
 * Adicionar webhook à Dead Letter Queue
 */
export async function addToDLQ(
  webhookId: string,
  error: string,
  retryCount: number
) {
  try {
    // Atualizar webhook no banco
    await prisma.webhookEvent.update({
      where: { id: webhookId },
      data: {
        status: retryCount >= MAX_RETRIES ? 'FAILED' : 'PENDING',
        processingError: error,
        processed: false
      }
    })

    // Se atingiu máximo de retries, adicionar ao DLQ permanente
    if (retryCount >= MAX_RETRIES) {
      const dlqKey = `${DLQ_PREFIX}:${webhookId}`
      const dlqData = {
        webhookId,
        error,
        retryCount,
        failedAt: Date.now(),
        addedToDLQAt: Date.now()
      }

      await redis.setex(dlqKey, 604800, JSON.stringify(dlqData)) // 7 dias

      logger.error('[DLQ] Webhook moved to DLQ after max retries', {
        webhookId,
        retryCount,
        error
      })

      // TODO: Enviar alerta para equipe (email, slack, etc)
    } else {
      // Agendar retry automático
      const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1] || 300000

      const retryKey = `${DLQ_PREFIX}:retry:${webhookId}`
      const retryData = {
        webhookId,
        retryCount: retryCount + 1,
        scheduledFor: Date.now() + delay
      }

      await redis.setex(retryKey, Math.ceil(delay / 1000) + 60, JSON.stringify(retryData))

      logger.warn('[DLQ] Webhook scheduled for retry', {
        webhookId,
        retryCount: retryCount + 1,
        delayMs: delay
      })
    }
  } catch (err: any) {
    logger.error('[DLQ] Failed to add webhook to DLQ', {
      webhookId,
      error: err.message
    })
  }
}

/**
 * Obter webhooks pendentes de retry
 */
export async function getPendingRetries(): Promise<Array<{
  webhookId: string
  retryCount: number
  scheduledFor: number
}>> {
  try {
    // Verificar se Redis está conectado
    if (redis.status !== 'ready' && redis.status !== 'connect') {
      logger.warn('[DLQ] Redis not ready, skipping pending retries check')
      return []
    }

    const pattern = `${DLQ_PREFIX}:retry:*`
    const keys = await redis.keys(pattern)

    const retries: any[] = []
    const now = Date.now()

    for (const key of keys) {
      const data = await redis.get(key)
      if (!data || data.trim() === '') continue

      try {
        const retry = JSON.parse(data)

        // Verificar se está pronto para retry
        if (retry.scheduledFor <= now) {
          retries.push(retry)
        }
      } catch (parseError: any) {
        logger.error('[DLQ] Failed to parse retry data', {
          key,
          error: parseError.message,
          data: data?.substring(0, 100) // Log first 100 chars
        })
        // Remover chave corrompida
        await redis.del(key)
      }
    }

    return retries
  } catch (error: any) {
    logger.error('[DLQ] Failed to get pending retries', {
      error: error.message
    })
    return []
  }
}

/**
 * Processar retries pendentes
 */
export async function processRetries() {
  try {
    const retries = await getPendingRetries()

    if (retries.length === 0) {
      return
    }

    logger.info('[DLQ] Processing pending retries', {
      count: retries.length
    })

    for (const retry of retries) {
      try {
        // Buscar webhook do banco
        const webhook = await prisma.webhookEvent.findUnique({
          where: { id: retry.webhookId },
          include: {
            mlAccount: {
              include: {
                organization: true
              }
            }
          }
        })

        if (!webhook) {
          logger.warn('[DLQ] Webhook not found for retry', {
            webhookId: retry.webhookId
          })

          // Remover do DLQ
          await redis.del(`${DLQ_PREFIX}:retry:${retry.webhookId}`)
          continue
        }

        // Verificar se já foi processado
        if (webhook.processed) {
          logger.info('[DLQ] Webhook already processed, skipping retry', {
            webhookId: retry.webhookId
          })

          // Remover do DLQ
          await redis.del(`${DLQ_PREFIX}:retry:${retry.webhookId}`)
          continue
        }

        logger.info('[DLQ] Retrying webhook', {
          webhookId: retry.webhookId,
          retryCount: retry.retryCount,
          topic: webhook.topic
        })

        // Processar baseado no topic
        if (webhook.topic === 'questions' && webhook.mlAccount) {
          const { processQuestionWebhook } = await import('@/lib/webhooks/question-processor')

          await processQuestionWebhook(webhook.payload as any, webhook.mlAccount)

          // Marcar como processado
          await prisma.webhookEvent.update({
            where: { id: webhook.id },
            data: {
              processed: true,
              processedAt: new Date(),
              status: 'COMPLETED'
            }
          })

          logger.info('[DLQ] Webhook retry successful', {
            webhookId: retry.webhookId
          })

          // Remover do DLQ
          await redis.del(`${DLQ_PREFIX}:retry:${retry.webhookId}`)
        }
      } catch (error: any) {
        logger.error('[DLQ] Retry failed', {
          webhookId: retry.webhookId,
          retryCount: retry.retryCount,
          error: error.message
        })

        // Adicionar novamente ao DLQ com contador incrementado
        await addToDLQ(retry.webhookId, error.message, retry.retryCount)

        // Remover retry atual
        await redis.del(`${DLQ_PREFIX}:retry:${retry.webhookId}`)
      }
    }
  } catch (error: any) {
    logger.error('[DLQ] Failed to process retries', {
      error: error.message
    })
  }
}

/**
 * Obter webhooks no DLQ permanente
 */
export async function getDLQWebhooks(): Promise<Array<{
  webhookId: string
  error: string
  retryCount: number
  failedAt: number
  addedToDLQAt: number
}>> {
  try {
    const pattern = `${DLQ_PREFIX}:*`
    const keys = await redis.keys(pattern)

    const dlqWebhooks: any[] = []

    for (const key of keys) {
      // Skip retry keys
      if (key.includes(':retry:')) continue

      const data = await redis.get(key)
      if (!data || data.trim() === '') continue

      try {
        dlqWebhooks.push(JSON.parse(data))
      } catch (parseError: any) {
        logger.error('[DLQ] Failed to parse DLQ webhook data', {
          key,
          error: parseError.message,
          data: data?.substring(0, 100) // Log first 100 chars
        })
        // Remover chave corrompida
        await redis.del(key)
      }
    }

    return dlqWebhooks
  } catch (error: any) {
    logger.error('[DLQ] Failed to get DLQ webhooks', {
      error: error.message
    })
    return []
  }
}

/**
 * Retry manual de webhook no DLQ
 */
export async function retryDLQWebhook(webhookId: string): Promise<boolean> {
  try {
    const webhook = await prisma.webhookEvent.findUnique({
      where: { id: webhookId },
      include: {
        mlAccount: {
          include: {
            organization: true
          }
        }
      }
    })

    if (!webhook) {
      return false
    }

    // Processar webhook
    if (webhook.topic === 'questions' && webhook.mlAccount) {
      const { processQuestionWebhook } = await import('@/lib/webhooks/question-processor')

      await processQuestionWebhook(webhook.payload as any, webhook.mlAccount)

      // Marcar como processado
      await prisma.webhookEvent.update({
        where: { id: webhook.id },
        data: {
          processed: true,
          processedAt: new Date(),
          status: 'COMPLETED',
          processingError: null
        }
      })

      // Remover do DLQ
      await redis.del(`${DLQ_PREFIX}:${webhookId}`)
      await redis.del(`${DLQ_PREFIX}:retry:${webhookId}`)

      logger.info('[DLQ] Manual retry successful', { webhookId })
      return true
    }

    return false
  } catch (error: any) {
    logger.error('[DLQ] Manual retry failed', {
      webhookId,
      error: error.message
    })
    return false
  }
}

/**
 * Limpar DLQ de webhooks antigos (> 7 dias)
 */
export async function cleanupDLQ() {
  try {
    const webhooks = await getDLQWebhooks()
    const now = Date.now()
    const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 dias

    let cleaned = 0

    for (const webhook of webhooks) {
      if (now - webhook.addedToDLQAt > maxAge) {
        await redis.del(`${DLQ_PREFIX}:${webhook.webhookId}`)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.info('[DLQ] Cleanup completed', {
        cleaned
      })
    }
  } catch (error: any) {
    logger.error('[DLQ] Cleanup failed', {
      error: error.message
    })
  }
}
