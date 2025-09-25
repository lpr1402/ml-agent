/**
 * Processador em lote para webhooks - reduz carga no sistema
 * Agrupa múltiplos webhooks e processa com delays inteligentes
 */

import { logger } from '@/lib/logger'
import { MLCache } from '@/lib/cache/ml-cache'

interface WebhookBatch {
  accountId: string
  webhooks: any[]
  timestamp: Date
}

class BatchProcessor {
  private batches: Map<string, WebhookBatch> = new Map()
  private processing: boolean = false
  private readonly BATCH_SIZE = 1 // APENAS 1 WEBHOOK POR VEZ - SEQUENCIAL!
  private readonly BATCH_DELAY = 10000 // 10 segundos entre batches

  /**
   * Adiciona webhook ao batch da conta
   */
  addToBatch(accountId: string, webhook: any) {
    const existing = this.batches.get(accountId)

    if (existing) {
      existing.webhooks.push(webhook)
    } else {
      this.batches.set(accountId, {
        accountId,
        webhooks: [webhook],
        timestamp: new Date()
      })
    }

    logger.info(`[BatchProcessor] Added webhook to batch`, {
      accountId,
      batchSize: this.batches.get(accountId)?.webhooks.length,
      totalBatches: this.batches.size
    })

    // Iniciar processamento se não estiver rodando
    if (!this.processing) {
      this.startProcessing()
    }
  }

  /**
   * Processa batches com rate limiting inteligente
   */
  private async startProcessing() {
    if (this.processing) return
    this.processing = true

    logger.info('[BatchProcessor] Starting batch processing')

    while (this.batches.size > 0) {
      // Pegar próximo batch para processar
      const entry = this.batches.entries().next()
      if (!entry.value) break

      const [accountId, batch] = entry.value

      if (batch.webhooks.length === 0) {
        this.batches.delete(accountId)
        continue
      }

      // Processar até BATCH_SIZE webhooks
      const toProcess = batch.webhooks.splice(0, this.BATCH_SIZE)

      logger.info(`[BatchProcessor] Processing batch`, {
        accountId,
        count: toProcess.length,
        remaining: batch.webhooks.length
      })

      // Processar webhooks SEQUENCIALMENTE - UM POR VEZ!
      try {
        for (const webhook of toProcess) {
          await this.processWithDelay(webhook, 0) // SEM delay adicional (já tem na função)
          // Aguardar 5 segundos entre cada webhook
          if (toProcess.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 5000))
          }
        }
      } catch (error) {
        logger.error('[BatchProcessor] Error processing batch', { error, accountId })
      }

      // Limpar batch se vazio
      if (batch.webhooks.length === 0) {
        this.batches.delete(accountId)
      }

      // Delay entre batches para evitar rate limit
      await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY))

      // Verificar cache stats periodicamente
      if (Math.random() < 0.1) { // 10% de chance
        const stats = await MLCache.getStats()
        logger.info('[BatchProcessor] Cache stats', stats)
      }
    }

    this.processing = false
    logger.info('[BatchProcessor] Batch processing completed')
  }

  /**
   * Processa webhook individual com delay
   */
  private async processWithDelay(webhook: any, delay: number) {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    // Processar webhook (importa a função principal)
    const { processQuestionWebhook } = require('./question-processor')
    return processQuestionWebhook(webhook.data, webhook.mlAccount)
  }

  /**
   * Obtém status dos batches
   */
  getStatus() {
    const status: Record<string, any> = {}

    for (const [accountId, batch] of this.batches.entries()) {
      status[accountId] = {
        pending: batch.webhooks.length,
        age: Date.now() - batch.timestamp.getTime()
      }
    }

    return {
      processing: this.processing,
      accounts: this.batches.size,
      batches: status
    }
  }

  /**
   * Força processamento imediato
   */
  async flush() {
    if (!this.processing) {
      await this.startProcessing()
    }
  }
}

// Singleton global
export const batchProcessor = new BatchProcessor()