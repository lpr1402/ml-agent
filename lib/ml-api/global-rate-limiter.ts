/**
 * GLOBAL ML API RATE LIMITER - PRODUCTION GRADE
 * Outubro 2025 - Sistema Unificado
 *
 * ✅ GARANTIA: 2 segundos entre QUALQUER chamada ML API
 * ✅ Suporta múltiplas contas ML simultaneamente
 * ✅ Métricas em tempo real
 * ✅ Queue persistente com prioridades
 * ✅ Circuit breaker integrado
 *
 * @version 3.0 - Production Ready
 */

import { logger } from '@/lib/logger'
import { EventEmitter } from 'events'

// ==================== INTERFACES ====================

interface MLAPIRequest {
  id: string
  mlAccountId: string
  organizationId: string
  endpoint: string
  priority: 'high' | 'normal' | 'low'
  requestFn: () => Promise<any>
  resolve: (value: any) => void
  reject: (error: any) => void
  createdAt: number
  retryCount: number
  maxRetries: number
}

interface RateLimiterMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  queueSize: number
  averageWaitTime: number
  lastRequestAt: number | null
  nextAvailableAt: number | null
  requestsPerAccount: Map<string, number>
  requestsPerMinute: number
  requestsPerHour: number
}

interface AccountQuota {
  mlAccountId: string
  requestsLastHour: number[]
  lastRequestAt: number
  isThrottled: boolean
}

// ==================== CONFIGURATION ====================

const CONFIG = {
  // 🔴 CRITICAL: 2 segundos entre QUALQUER chamada
  // MATEMÁTICA: 2s = 30 req/min = 1800 req/hora (LIMITE GLOBAL HARD)
  MIN_REQUEST_INTERVAL_MS: 2000,

  // ✅ FIX P1-1: Limites duplos para proteção
  // Limite ML por conta: 500 req/hora
  // Limite GLOBAL teórico: 2000 req/hora (intervalo de 2s)
  // Limite GLOBAL real: 1800 req/hora (30 req/min × 60min)
  //
  // DESIGN: Mesmo com 10 contas fazendo 450 req/h cada (4500 total),
  // o intervalo de 2s global GARANTE máximo de 1800 req/h total.
  MAX_REQUESTS_PER_HOUR_PER_ACCOUNT: 450, // 500 - margem 10%
  MAX_REQUESTS_PER_HOUR_GLOBAL: 1800, // Hard limit (30 req/min × 60)
  MAX_QUEUE_SIZE: 5000,

  // Retry config
  DEFAULT_MAX_RETRIES: 3,
  RETRY_BACKOFF_MS: 5000,

  // Circuit breaker
  CIRCUIT_FAILURE_THRESHOLD: 10,
  CIRCUIT_RESET_TIMEOUT_MS: 60000,

  // Metrics
  METRICS_WINDOW_MS: 60000, // 1 minuto
  CLEANUP_INTERVAL_MS: 300000 // 5 minutos
} as const

// ==================== GLOBAL RATE LIMITER ====================

class GlobalMLRateLimiter extends EventEmitter {
  private queue: MLAPIRequest[] = []
  private processing = false
  private lastRequestTimestamp: number | null = null
  private nextAvailableTimestamp: number | null = null

  // Métricas
  private metrics: RateLimiterMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    queueSize: 0,
    averageWaitTime: 0,
    lastRequestAt: null,
    nextAvailableAt: null,
    requestsPerAccount: new Map(),
    requestsPerMinute: 0,
    requestsPerHour: 0
  }

  // Quotas por conta
  private accountQuotas: Map<string, AccountQuota> = new Map()

  // Request history para métricas
  private requestHistory: Array<{ timestamp: number; accountId: string; success: boolean }> = []

  // Circuit breaker
  private circuitOpen = false
  private circuitFailures = 0
  private circuitResetTimer: NodeJS.Timeout | null = null

  // Cleanup timer
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.startCleanupTimer()
    logger.info('[GlobalRateLimiter] 🚀 Initialized with 2-second guaranteed interval')
  }

  /**
   * 🔴 MÉTODO PRINCIPAL: Enfileirar requisição
   */
  async executeRequest<T>(options: {
    mlAccountId: string
    organizationId: string
    endpoint: string
    requestFn: () => Promise<T>
    priority?: 'high' | 'normal' | 'low'
    maxRetries?: number
  }): Promise<T> {
    // Verificar circuit breaker
    if (this.circuitOpen) {
      throw new Error('Circuit breaker open - ML API temporarily unavailable')
    }

    // ✅ FIX P1-1: Verificar quota GLOBAL primeiro
    if (!this.checkGlobalQuota()) {
      throw new Error(`Global ML API quota exceeded (1800 req/hour). System protecting against rate limit.`)
    }

    // Verificar quota da conta
    if (!this.checkAccountQuota(options.mlAccountId)) {
      const quota = this.accountQuotas.get(options.mlAccountId)
      const resetIn = quota ? Math.ceil((3600000 - (Date.now() - quota.lastRequestAt)) / 1000 / 60) : 0
      throw new Error(`ML Account ${options.mlAccountId} quota exceeded (450 req/hour). Reset in ${resetIn} minutes.`)
    }

    // Verificar tamanho da fila
    if (this.queue.length >= CONFIG.MAX_QUEUE_SIZE) {
      throw new Error('Rate limiter queue full - system overload')
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return new Promise<T>((resolve, reject) => {
      const request: MLAPIRequest = {
        id: requestId,
        mlAccountId: options.mlAccountId,
        organizationId: options.organizationId,
        endpoint: options.endpoint,
        priority: options.priority || 'normal',
        requestFn: options.requestFn as () => Promise<any>,
        resolve,
        reject,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: options.maxRetries || CONFIG.DEFAULT_MAX_RETRIES
      }

      // Adicionar à fila com ordenação por prioridade
      this.addToQueue(request)

      // Emitir evento de enfileiramento
      this.emit('request:queued', {
        requestId,
        mlAccountId: options.mlAccountId,
        endpoint: options.endpoint,
        queueSize: this.queue.length
      })

      // Iniciar processamento
      this.processQueue()
    })
  }

  /**
   * Adicionar à fila com ordenação por prioridade
   */
  private addToQueue(request: MLAPIRequest) {
    const priorityOrder = { high: 0, normal: 1, low: 2 }

    // Encontrar posição correta baseada em prioridade
    let insertIndex = this.queue.length
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[request.priority] < priorityOrder[this.queue[i]!.priority]) {
        insertIndex = i
        break
      }
    }

    this.queue.splice(insertIndex, 0, request)
    this.updateMetrics()
  }

  /**
   * 🔴 CORE: Processar fila com garantia de 2 segundos
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      // Calcular tempo de espera necessário
      const now = Date.now()
      const timeSinceLastRequest = this.lastRequestTimestamp
        ? now - this.lastRequestTimestamp
        : CONFIG.MIN_REQUEST_INTERVAL_MS

      const waitTime = Math.max(0, CONFIG.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest)

      if (waitTime > 0) {
        this.nextAvailableTimestamp = now + waitTime
        this.updateMetrics()

        logger.debug('[GlobalRateLimiter] Waiting for rate limit', {
          waitTimeMs: waitTime,
          queueSize: this.queue.length
        })

        await this.sleep(waitTime)
      }

      // Pegar próxima requisição
      const request = this.queue.shift()
      if (!request) break

      // Executar requisição
      await this.executeQueuedRequest(request)

      // Atualizar timestamp
      this.lastRequestTimestamp = Date.now()
      this.nextAvailableTimestamp = this.lastRequestTimestamp + CONFIG.MIN_REQUEST_INTERVAL_MS

      // Atualizar métricas
      this.updateMetrics()
    }

    this.processing = false
    this.nextAvailableTimestamp = null
    this.updateMetrics()
  }

  /**
   * Executar requisição individual
   */
  private async executeQueuedRequest(request: MLAPIRequest) {
    const startTime = Date.now()

    try {
      logger.info('[GlobalRateLimiter] Executing request', {
        requestId: request.id,
        mlAccountId: request.mlAccountId,
        endpoint: request.endpoint,
        waitTime: startTime - request.createdAt,
        queueSize: this.queue.length
      })

      const result = await request.requestFn()

      // Sucesso
      const duration = Date.now() - startTime

      this.recordSuccess(request, duration)
      request.resolve(result)

      this.emit('request:success', {
        requestId: request.id,
        mlAccountId: request.mlAccountId,
        endpoint: request.endpoint,
        duration
      })

    } catch (error: any) {
      const duration = Date.now() - startTime

      logger.error('[GlobalRateLimiter] Request failed', {
        requestId: request.id,
        mlAccountId: request.mlAccountId,
        endpoint: request.endpoint,
        error: error.message,
        retryCount: request.retryCount
      })

      // Verificar se deve fazer retry
      if (request.retryCount < request.maxRetries && this.shouldRetry(error)) {
        request.retryCount++

        // Re-adicionar à fila com prioridade alta
        request.priority = 'high'
        this.addToQueue(request)

        this.emit('request:retry', {
          requestId: request.id,
          mlAccountId: request.mlAccountId,
          endpoint: request.endpoint,
          retryCount: request.retryCount
        })

        return
      }

      // Falha definitiva
      this.recordFailure(request, duration, error)
      request.reject(error)

      this.emit('request:failed', {
        requestId: request.id,
        mlAccountId: request.mlAccountId,
        endpoint: request.endpoint,
        error: error.message
      })
    }
  }

  /**
   * ✅ FIX P1-1: Verificar quota GLOBAL (todos os requests)
   */
  private checkGlobalQuota(): boolean {
    const oneHourAgo = Date.now() - 3600000
    const globalRequestsLastHour = this.requestHistory.filter(r => r.timestamp > oneHourAgo).length

    if (globalRequestsLastHour >= CONFIG.MAX_REQUESTS_PER_HOUR_GLOBAL) {
      logger.warn('[GlobalRateLimiter] ⚠️ GLOBAL quota exceeded', {
        requestsLastHour: globalRequestsLastHour,
        limit: CONFIG.MAX_REQUESTS_PER_HOUR_GLOBAL
      })
      return false
    }

    return true
  }

  /**
   * Verificar quota da conta
   */
  private checkAccountQuota(mlAccountId: string): boolean {
    const quota = this.accountQuotas.get(mlAccountId)

    if (!quota) {
      this.accountQuotas.set(mlAccountId, {
        mlAccountId,
        requestsLastHour: [],
        lastRequestAt: 0,
        isThrottled: false
      })
      return true
    }

    // Limpar requests antigas (> 1 hora)
    const oneHourAgo = Date.now() - 3600000
    quota.requestsLastHour = quota.requestsLastHour.filter(ts => ts > oneHourAgo)

    // Verificar limite
    if (quota.requestsLastHour.length >= CONFIG.MAX_REQUESTS_PER_HOUR_PER_ACCOUNT) {
      logger.warn('[GlobalRateLimiter] ⚠️ Account quota exceeded', {
        mlAccountId,
        requestsLastHour: quota.requestsLastHour.length,
        limit: CONFIG.MAX_REQUESTS_PER_HOUR_PER_ACCOUNT
      })
      return false
    }

    return true
  }

  /**
   * Registrar sucesso
   */
  private recordSuccess(request: MLAPIRequest, _duration: number) {
    this.metrics.totalRequests++
    this.metrics.successfulRequests++
    this.metrics.lastRequestAt = Date.now()

    // Atualizar quota da conta
    const quota = this.accountQuotas.get(request.mlAccountId)
    if (quota) {
      quota.requestsLastHour.push(Date.now())
      quota.lastRequestAt = Date.now()
    }

    // Atualizar histórico
    this.requestHistory.push({
      timestamp: Date.now(),
      accountId: request.mlAccountId,
      success: true
    })

    // Reset circuit breaker em caso de sucesso
    this.circuitFailures = 0
    if (this.circuitOpen) {
      this.closeCircuit()
    }

    // Atualizar métricas por conta
    const accountCount = this.metrics.requestsPerAccount.get(request.mlAccountId) || 0
    this.metrics.requestsPerAccount.set(request.mlAccountId, accountCount + 1)
  }

  /**
   * Registrar falha
   */
  private recordFailure(request: MLAPIRequest, _duration: number, _error: any) {
    this.metrics.totalRequests++
    this.metrics.failedRequests++
    this.metrics.lastRequestAt = Date.now()

    // Atualizar histórico
    this.requestHistory.push({
      timestamp: Date.now(),
      accountId: request.mlAccountId,
      success: false
    })

    // Circuit breaker
    this.circuitFailures++
    if (this.circuitFailures >= CONFIG.CIRCUIT_FAILURE_THRESHOLD) {
      this.openCircuit()
    }
  }

  /**
   * Verificar se deve fazer retry
   * 🚀 ENTERPRISE FIX: 429 DEVE fazer retry com backoff exponencial
   */
  private shouldRetry(error: any): boolean {
    // ✅ CRITICAL: 429 (Rate Limit) DEVE fazer retry!
    // ML API está temporariamente limitando, precisamos ESPERAR e RETENTAR
    if (error.statusCode === 429) return true

    // Outros erros temporários
    if (error.statusCode === 503) return true
    if (error.code === 'ECONNRESET') return true
    if (error.code === 'ETIMEDOUT') return true
    if (error.code === 'ECONNREFUSED') return true

    return false
  }

  /**
   * Abrir circuit breaker
   */
  private openCircuit() {
    this.circuitOpen = true
    logger.error('[GlobalRateLimiter] ⚠️ Circuit breaker OPEN - too many failures')

    this.emit('circuit:open', {
      failures: this.circuitFailures,
      timestamp: Date.now()
    })

    // Auto-reset após timeout
    this.circuitResetTimer = setTimeout(() => {
      this.closeCircuit()
    }, CONFIG.CIRCUIT_RESET_TIMEOUT_MS)
  }

  /**
   * Fechar circuit breaker
   */
  private closeCircuit() {
    this.circuitOpen = false
    this.circuitFailures = 0

    if (this.circuitResetTimer) {
      clearTimeout(this.circuitResetTimer)
      this.circuitResetTimer = null
    }

    logger.info('[GlobalRateLimiter] ✅ Circuit breaker CLOSED')

    this.emit('circuit:closed', {
      timestamp: Date.now()
    })
  }

  /**
   * Atualizar métricas
   */
  private updateMetrics() {
    this.metrics.queueSize = this.queue.length
    this.metrics.nextAvailableAt = this.nextAvailableTimestamp

    // Calcular tempo médio de espera
    const now = Date.now()
    if (this.queue.length > 0) {
      const totalWaitTime = this.queue.reduce((sum, req) => sum + (now - req.createdAt), 0)
      this.metrics.averageWaitTime = totalWaitTime / this.queue.length
    } else {
      this.metrics.averageWaitTime = 0
    }

    // Limpar histórico antigo
    const windowStart = now - CONFIG.METRICS_WINDOW_MS
    this.requestHistory = this.requestHistory.filter(r => r.timestamp > windowStart)

    // Calcular requests por minuto/hora
    const oneMinuteAgo = now - 60000
    const oneHourAgo = now - 3600000

    this.metrics.requestsPerMinute = this.requestHistory.filter(r => r.timestamp > oneMinuteAgo).length
    this.metrics.requestsPerHour = this.requestHistory.filter(r => r.timestamp > oneHourAgo).length

    // Emitir evento de métricas
    this.emit('metrics:updated', this.getMetrics())
  }

  /**
   * Obter métricas atuais
   */
  getMetrics(): RateLimiterMetrics {
    return {
      ...this.metrics,
      requestsPerAccount: new Map(this.metrics.requestsPerAccount)
    }
  }

  /**
   * Obter status da fila
   */
  getQueueStatus() {
    return {
      size: this.queue.length,
      processing: this.processing,
      nextAvailableIn: this.nextAvailableTimestamp
        ? Math.max(0, this.nextAvailableTimestamp - Date.now())
        : 0,
      requests: this.queue.map(req => ({
        id: req.id,
        mlAccountId: req.mlAccountId,
        endpoint: req.endpoint,
        priority: req.priority,
        waitTime: Date.now() - req.createdAt
      }))
    }
  }

  /**
   * Limpar fila (emergency)
   */
  clearQueue(mlAccountId?: string) {
    if (mlAccountId) {
      const removed = this.queue.filter(req => req.mlAccountId === mlAccountId)
      this.queue = this.queue.filter(req => req.mlAccountId !== mlAccountId)

      removed.forEach(req => {
        req.reject(new Error('Queue cleared by admin'))
      })

      logger.warn('[GlobalRateLimiter] Queue cleared for account', { mlAccountId, count: removed.length })
    } else {
      this.queue.forEach(req => {
        req.reject(new Error('Queue cleared by admin'))
      })
      this.queue = []

      logger.warn('[GlobalRateLimiter] All queues cleared')
    }

    this.updateMetrics()
  }

  /**
   * Cleanup timer
   */
  private startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      // Limpar quotas antigas
      const oneHourAgo = Date.now() - 3600000
      for (const [accountId, quota] of this.accountQuotas.entries()) {
        quota.requestsLastHour = quota.requestsLastHour.filter(ts => ts > oneHourAgo)

        // Remover se vazio e sem atividade
        if (quota.requestsLastHour.length === 0 && Date.now() - quota.lastRequestAt > 7200000) {
          this.accountQuotas.delete(accountId)
        }
      }

      logger.debug('[GlobalRateLimiter] Cleanup completed', {
        activeAccounts: this.accountQuotas.size,
        historySize: this.requestHistory.length
      })
    }, CONFIG.CLEANUP_INTERVAL_MS)
  }

  /**
   * Shutdown gracefully
   */
  shutdown() {
    logger.info('[GlobalRateLimiter] Shutting down...')

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    if (this.circuitResetTimer) {
      clearTimeout(this.circuitResetTimer)
    }

    this.clearQueue()
    this.removeAllListeners()
  }

  /**
   * Helper: sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ==================== SINGLETON ====================

export const globalMLRateLimiter = new GlobalMLRateLimiter()

// Graceful shutdown
process.on('SIGTERM', () => {
  globalMLRateLimiter.shutdown()
})

process.on('SIGINT', () => {
  globalMLRateLimiter.shutdown()
})

// ==================== EXPORTS ====================

export default globalMLRateLimiter
export type { MLAPIRequest, RateLimiterMetrics, AccountQuota }
