/**
 * Multi-Account Processor with Circuit Breaker Isolation
 * Garante que falhas em uma conta não afetem outras
 * Production-ready para 10.000+ contas simultâneas
 */

import { CircuitBreaker, CircuitState } from './circuit-breaker'
import { mlApiProtected } from './ml-api-protected'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { EventEmitter } from 'events'
import pLimit from 'p-limit'

// Status da conta
interface AccountStatus {
  accountId: string
  mlUserId: string
  nickname: string
  status: 'healthy' | 'degraded' | 'failed'
  circuitState: CircuitState
  lastCheck: Date
  consecutiveFailures: number
  errorRate: number
  metrics: {
    totalRequests: number
    failedRequests: number
    successRequests: number
    averageResponseTime: number
  }
}

// Configuração de processamento
interface ProcessorConfig {
  maxConcurrency: number
  checkInterval: number
  maxRetries: number
  isolationMode: boolean
  healthCheckInterval: number
  autoRecovery: boolean
}

/**
 * Multi-Account Processor com isolamento
 */
export class MultiAccountProcessor extends EventEmitter {
  private accountBreakers: Map<string, CircuitBreaker> = new Map()
  private accountStatus: Map<string, AccountStatus> = new Map()
  private healthCheckTimer?: NodeJS.Timer
  private config: ProcessorConfig

  constructor(config: Partial<ProcessorConfig> = {}) {
    super()
    this.setMaxListeners(50) // Prevent memory leak warnings

    this.config = {
      maxConcurrency: config.maxConcurrency ?? 10,
      checkInterval: config.checkInterval ?? 30000, // 30 segundos
      maxRetries: config.maxRetries ?? 3,
      isolationMode: config.isolationMode ?? true,
      healthCheckInterval: config.healthCheckInterval ?? 60000, // 1 minuto
      autoRecovery: config.autoRecovery ?? true
    }

    // Iniciar monitoramento
    this.startHealthMonitoring()
  }

  /**
   * Obter ou criar Circuit Breaker para conta
   */
  private getAccountBreaker(accountId: string): CircuitBreaker {
    if (!this.accountBreakers.has(accountId)) {
      const breaker = new CircuitBreaker({
        name: `account-${accountId}`,
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 30000, // 30 segundos
        volumeThreshold: 10,
        errorThresholdPercentage: 40,
        resetTimeout: 120000 // 2 minutos
      })

      // Monitorar eventos do breaker
      // TODO: Implementar monitoramento de eventos quando CircuitBreaker suportar
      // breaker.on('stateChange', ({ newState }) => {
      //   this.updateAccountStatus(accountId, { circuitState: newState })
      //   this.emit('accountStateChange', { accountId, state: newState })
      // })

      this.accountBreakers.set(accountId, breaker)
    }

    return this.accountBreakers.get(accountId)!
  }

  /**
   * Processar operação para conta específica com isolamento
   */
  async processAccountOperation<T>(
    accountId: string,
    operation: () => Promise<T>,
    options: {
      operationName?: string
      fallback?: () => Promise<T>
      priority?: number
    } = {}
  ): Promise<T> {
    const { operationName = 'unknown', fallback } = options

    try {
      // Verificar se conta está isolada
      const status = this.accountStatus.get(accountId)
      if (status?.status === 'failed' && this.config.isolationMode) {
        logger.warn('[MultiAccountProcessor] Account isolated', {
          accountId,
          nickname: status.nickname,
          operationName
        })

        if (fallback) {
          return await fallback()
        }

        throw new Error(`Account ${accountId} is isolated due to failures`)
      }

      // Obter circuit breaker da conta
      const breaker = this.getAccountBreaker(accountId)

      // Executar com proteção
      const startTime = Date.now()
      const result = await breaker.execute(operation)
      const responseTime = Date.now() - startTime

      // Atualizar métricas
      this.updateAccountMetrics(accountId, {
        success: true,
        responseTime
      })

      logger.debug('[MultiAccountProcessor] Operation successful', {
        accountId,
        operationName,
        responseTime
      })

      return result

    } catch (error: any) {
      // Atualizar métricas de falha
      this.updateAccountMetrics(accountId, {
        success: false,
        error: error.message
      })

      logger.error('[MultiAccountProcessor] Operation failed', {
        accountId,
        operationName,
        error: error.message
      })

      // Tentar fallback se disponível
      if (fallback) {
        logger.info('[MultiAccountProcessor] Using fallback', {
          accountId,
          operationName
        })
        return await fallback()
      }

      throw error
    }
  }

  /**
   * Processar múltiplas contas em paralelo com isolamento
   */
  async processMultipleAccounts<T>(
    accounts: Array<{
      accountId: string
      mlUserId: string
      nickname: string
    }>,
    operation: (account: any) => Promise<T>,
    options: {
      continueOnError?: boolean
      maxConcurrency?: number
    } = {}
  ): Promise<{
    success: Array<{ accountId: string; result: T }>
    failed: Array<{ accountId: string; error: string }>
    skipped: Array<{ accountId: string; reason: string }>
  }> {
    const {
      continueOnError = true,
      maxConcurrency = this.config.maxConcurrency
    } = options

    const results = {
      success: [] as Array<{ accountId: string; result: T }>,
      failed: [] as Array<{ accountId: string; error: string }>,
      skipped: [] as Array<{ accountId: string; reason: string }>
    }

    // Criar limitador de concorrência
    const limit = pLimit(maxConcurrency)

    // Processar contas em paralelo com limite
    const promises = accounts.map(account =>
      limit(async () => {
        try {
          // Verificar status da conta antes de processar
          const status = this.accountStatus.get(account.accountId)

          if (status?.status === 'failed' && this.config.isolationMode) {
            results.skipped.push({
              accountId: account.accountId,
              reason: 'Account isolated due to failures'
            })
            return
          }

          // Processar com isolamento
          const result = await this.processAccountOperation(
            account.accountId,
            () => operation(account),
            { operationName: 'batch-operation' }
          )

          results.success.push({
            accountId: account.accountId,
            result
          })

        } catch (error: any) {
          results.failed.push({
            accountId: account.accountId,
            error: error.message
          })

          if (!continueOnError) {
            throw error
          }
        }
      })
    )

    await Promise.allSettled(promises)

    // Emitir evento com resultado
    this.emit('batchProcessingComplete', {
      total: accounts.length,
      success: results.success.length,
      failed: results.failed.length,
      skipped: results.skipped.length
    })

    return results
  }

  /**
   * Processar perguntas de múltiplas contas
   */
  async processQuestionsForAccounts(
    organizationId: string
  ): Promise<any> {
    // Buscar todas as contas ativas
    const accounts = await prisma.mLAccount.findMany({
      where: {
        organizationId,
        isActive: true
      },
      select: {
        id: true,
        mlUserId: true,
        nickname: true
      }
    })

    logger.info('[MultiAccountProcessor] Processing questions for accounts', {
      organizationId,
      accountCount: accounts.length
    })

    // Processar cada conta isoladamente
    return this.processMultipleAccounts(
      accounts.map(a => ({
        accountId: a.id,
        mlUserId: a.mlUserId,
        nickname: a.nickname
      })),
      async (account) => {
        // Buscar perguntas da conta
        const response = await mlApiProtected.request(
          `/questions/search?seller_id=${account.mlUserId}&status=UNANSWERED`,
          account.mlUserId,
          {
            accountId: account.accountId,
            useCache: true,
            cacheTTL: 60
          }
        )

        if (response.error) {
          throw new Error(response.error)
        }

        return {
          accountId: account.accountId,
          questions: response.data?.questions || []
        }
      },
      {
        continueOnError: true,
        maxConcurrency: 5 // Processar 5 contas por vez
      }
    )
  }

  /**
   * Atualizar status da conta
   */
  private updateAccountStatus(
    accountId: string,
    updates: Partial<AccountStatus>
  ): void {
    const current = this.accountStatus.get(accountId) || {
      accountId,
      mlUserId: '',
      nickname: '',
      status: 'healthy' as const,
      circuitState: CircuitState.CLOSED,
      lastCheck: new Date(),
      consecutiveFailures: 0,
      errorRate: 0,
      metrics: {
        totalRequests: 0,
        failedRequests: 0,
        successRequests: 0,
        averageResponseTime: 0
      }
    }

    const updated: AccountStatus = {
      ...current,
      ...updates,
      lastCheck: new Date()
    }

    // Determinar status baseado no circuit state
    if (updated.circuitState === CircuitState.OPEN) {
      updated.status = 'failed'
    } else if (updated.circuitState === CircuitState.HALF_OPEN) {
      updated.status = 'degraded'
    } else {
      updated.status = updated.errorRate > 30 ? 'degraded' : 'healthy'
    }

    this.accountStatus.set(accountId, updated)
  }

  /**
   * Atualizar métricas da conta
   */
  private updateAccountMetrics(
    accountId: string,
    event: {
      success: boolean
      responseTime?: number
      error?: string
    }
  ): void {
    const status = this.accountStatus.get(accountId)
    if (!status) return

    status.metrics.totalRequests++

    if (event.success) {
      status.metrics.successRequests++
      status.consecutiveFailures = 0

      // Atualizar tempo médio de resposta
      if (event.responseTime) {
        const alpha = 0.2
        status.metrics.averageResponseTime =
          alpha * event.responseTime +
          (1 - alpha) * status.metrics.averageResponseTime
      }
    } else {
      status.metrics.failedRequests++
      status.consecutiveFailures++
    }

    // Calcular taxa de erro
    status.errorRate = status.metrics.totalRequests > 0
      ? (status.metrics.failedRequests / status.metrics.totalRequests) * 100
      : 0

    this.updateAccountStatus(accountId, status)
  }

  /**
   * Health check para todas as contas
   */
  private async performHealthCheck(): Promise<void> {
    const accounts = Array.from(this.accountStatus.values())

    for (const account of accounts) {
      // Pular contas saudáveis recentemente verificadas
      const timeSinceCheck = Date.now() - account.lastCheck.getTime()
      if (
        account.status === 'healthy' &&
        timeSinceCheck < this.config.healthCheckInterval
      ) {
        continue
      }

      try {
        // Fazer health check básico
        const response = await mlApiProtected.request(
          `/users/${account.mlUserId}`,
          account.mlUserId,
          {
            timeout: 5000,
            useCache: false
          }
        )

        if (response.data) {
          // Conta saudável
          if (account.status === 'failed' && this.config.autoRecovery) {
            // Resetar circuit breaker
            const breaker = this.accountBreakers.get(account.accountId)
            if (breaker) {
              breaker.reset()
            }

            logger.info('[MultiAccountProcessor] Account recovered', {
              accountId: account.accountId,
              nickname: account.nickname
            })
          }

          this.updateAccountStatus(account.accountId, {
            status: 'healthy',
            consecutiveFailures: 0
          })
        }
      } catch (_error) {
        // Health check falhou
        this.updateAccountStatus(account.accountId, {
          consecutiveFailures: account.consecutiveFailures + 1
        })
      }
    }
  }

  /**
   * Iniciar monitoramento de saúde
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer as any)
    }

    this.healthCheckTimer = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckInterval
    )

    logger.info('[MultiAccountProcessor] Health monitoring started', {
      interval: this.config.healthCheckInterval
    })
  }

  /**
   * Obter status de todas as contas
   */
  getAllAccountsStatus(): AccountStatus[] {
    return Array.from(this.accountStatus.values())
  }

  /**
   * Obter estatísticas gerais
   */
  getStatistics(): {
    total: number
    healthy: number
    degraded: number
    failed: number
    averageErrorRate: number
  } {
    const accounts = this.getAllAccountsStatus()

    const stats = {
      total: accounts.length,
      healthy: accounts.filter(a => a.status === 'healthy').length,
      degraded: accounts.filter(a => a.status === 'degraded').length,
      failed: accounts.filter(a => a.status === 'failed').length,
      averageErrorRate: 0
    }

    if (accounts.length > 0) {
      const totalErrorRate = accounts.reduce((sum, a) => sum + a.errorRate, 0)
      stats.averageErrorRate = totalErrorRate / accounts.length
    }

    return stats
  }

  /**
   * Resetar conta específica
   */
  resetAccount(accountId: string): void {
    const breaker = this.accountBreakers.get(accountId)
    if (breaker) {
      breaker.reset()
    }

    this.accountStatus.delete(accountId)

    logger.info('[MultiAccountProcessor] Account reset', { accountId })
  }

  /**
   * Destruir processor
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer as any)
    }

    // Clear all circuit breakers
    // Note: CircuitBreaker doesn't have destroy method

    this.accountBreakers.clear()
    this.accountStatus.clear()
    this.removeAllListeners()
  }
}

// Singleton instance
export const multiAccountProcessor = new MultiAccountProcessor({
  maxConcurrency: parseInt(process.env['MAX_ACCOUNT_CONCURRENCY'] || '10'),
  healthCheckInterval: 60000, // 1 minuto
  autoRecovery: true,
  isolationMode: true
})

// Auto-cleanup on exit
process.on('SIGTERM', () => {
  multiAccountProcessor.destroy()
})

export default multiAccountProcessor