/**
 * Rate Limiter Dedicado para Market Intelligence
 *
 * Gerencia rate limiting ISOLADO das APIs do Mercado Livre
 * para análises de inteligência de mercado.
 *
 * NÃO interfere com o sistema de questions/answers existente.
 */

interface RequestQueue {
  pending: Array<{
    requestFn: () => Promise<any>
    resolve: (value: any) => void
    reject: (error: any) => void
  }>
  processing: boolean
  requestsThisHour: number
  hourReset: number
}

export class MLIntelligenceRateLimiter {
  private accountQueues: Map<string, RequestQueue> = new Map()

  // Configuração (NÃO interfere com questions)
  private readonly BATCH_SIZE = 2        // 2 req simultâneas
  private readonly BATCH_DELAY_MS = 1000 // 1s delay
  private readonly MAX_PER_HOUR = 450    // 10% margem segurança (500 - 50)

  /**
   * Executa requisição com rate limiting
   */
  async executeRequest<T>(
    mlAccountId: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const queue = this.getOrCreateQueue(mlAccountId)

    // Verificar quota
    if (queue.requestsThisHour >= this.MAX_PER_HOUR) {
      const resetIn = Math.ceil((queue.hourReset - Date.now()) / 1000 / 60)
      throw new Error(`Quota horária excedida. Aguarde ${resetIn} minutos para reset.`)
    }

    return new Promise((resolve, reject) => {
      queue.pending.push({ requestFn, resolve, reject })
      this.processQueue(mlAccountId)
    })
  }

  /**
   * Processa fila de requisições
   */
  private async processQueue(mlAccountId: string) {
    const queue = this.getOrCreateQueue(mlAccountId)
    if (!queue || queue.processing) return

    queue.processing = true

    while (queue.pending.length > 0) {
      // Verificar quota novamente
      if (queue.requestsThisHour >= this.MAX_PER_HOUR) {
        // Rejeitar todas pendentes
        const error = new Error('Quota horária excedida')
        queue.pending.forEach(req => req.reject(error))
        queue.pending = []
        break
      }

      // Batch de 2
      const batch = queue.pending.splice(0, this.BATCH_SIZE)

      // Executar em paralelo
      const results = await Promise.allSettled(
        batch.map(req => req.requestFn())
      )

      // Resolver promises
      results.forEach((result, idx) => {
        const req = batch[idx]
        if (!req) return

        if (result.status === 'fulfilled') {
          req.resolve(result.value)
          queue.requestsThisHour++
        } else {
          req.reject(result.reason)
        }
      })

      // Delay 1s entre batches (best practice ML)
      if (queue.pending.length > 0) {
        await new Promise(r => setTimeout(r, this.BATCH_DELAY_MS))
      }
    }

    queue.processing = false
  }

  /**
   * Get ou criar fila da conta
   */
  private getOrCreateQueue(mlAccountId: string): RequestQueue {
    if (!this.accountQueues.has(mlAccountId)) {
      this.accountQueues.set(mlAccountId, {
        pending: [],
        processing: false,
        requestsThisHour: 0,
        hourReset: Date.now() + 3600000 // 1 hora
      })
    }

    const queue = this.accountQueues.get(mlAccountId)
    if (!queue) {
      throw new Error('Queue not found')
    }

    // Reset contador a cada hora
    if (Date.now() >= queue.hourReset) {
      queue.requestsThisHour = 0
      queue.hourReset = Date.now() + 3600000
    }

    return queue
  }

  /**
   * Get estatísticas da fila
   */
  getQueueStats(mlAccountId: string) {
    const queue = this.accountQueues.get(mlAccountId)

    if (!queue) {
      return {
        pending: 0,
        requestsThisHour: 0,
        quotaRemaining: this.MAX_PER_HOUR,
        resetIn: 0
      }
    }

    return {
      pending: queue.pending.length,
      requestsThisHour: queue.requestsThisHour,
      quotaRemaining: this.MAX_PER_HOUR - queue.requestsThisHour,
      resetIn: Math.ceil((queue.hourReset - Date.now()) / 1000 / 60) // minutos
    }
  }

  /**
   * Limpar fila (emergency)
   */
  clearQueue(mlAccountId: string) {
    const queue = this.accountQueues.get(mlAccountId)
    if (queue) {
      queue.pending.forEach(req =>
        req.reject(new Error('Queue cleared by admin'))
      )
      queue.pending = []
      queue.processing = false
    }
  }
}

// Singleton global
export const mlIntelligenceRateLimiter = new MLIntelligenceRateLimiter()
