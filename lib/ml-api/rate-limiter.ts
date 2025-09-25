import { logger } from '../logger'

interface RateLimitConfig {
  maxRequestsPerHour: number
  maxRequestsPerAccount: number
  retryDelay: number
  maxRetries: number
}

interface AccountRateLimit {
  requests: number[]
  lastReset: number
}

class MLRateLimiter {
  private static instance: MLRateLimiter
  private accountLimits: Map<string, AccountRateLimit> = new Map()
  private globalRequests: number[] = []

  private config: RateLimitConfig = {
    maxRequestsPerHour: 2000,        // Limite global do ML
    maxRequestsPerAccount: 500,      // Limite por conta ML
    retryDelay: 1000,                // Delay inicial para retry (ms)
    maxRetries: 3                    // Número máximo de tentativas
  }

  private constructor() {
    // Limpar contadores a cada hora
    setInterval(() => this.resetHourlyCounters(), 60 * 60 * 1000)
  }

  static getInstance(): MLRateLimiter {
    if (!MLRateLimiter.instance) {
      MLRateLimiter.instance = new MLRateLimiter()
    }
    return MLRateLimiter.instance
  }

  private resetHourlyCounters() {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)

    // Limpar requests globais antigas
    this.globalRequests = this.globalRequests.filter(time => time > oneHourAgo)

    // Limpar requests por conta antigas
    for (const [accountId, limit] of this.accountLimits.entries()) {
      limit.requests = limit.requests.filter(time => time > oneHourAgo)
      if (limit.requests.length === 0) {
        this.accountLimits.delete(accountId)
      }
    }
  }

  private getAccountLimit(accountId: string): AccountRateLimit {
    if (!this.accountLimits.has(accountId)) {
      this.accountLimits.set(accountId, {
        requests: [],
        lastReset: Date.now()
      })
    }
    return this.accountLimits.get(accountId)!
  }

  async canMakeRequest(accountId: string): Promise<boolean> {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)

    // Limpar requests antigas
    this.globalRequests = this.globalRequests.filter(time => time > oneHourAgo)

    const accountLimit = this.getAccountLimit(accountId)
    accountLimit.requests = accountLimit.requests.filter(time => time > oneHourAgo)

    // Verificar limite global
    if (this.globalRequests.length >= this.config.maxRequestsPerHour) {
      logger.warn('[MLRateLimiter] Limite global atingido', {
        current: this.globalRequests.length,
        max: this.config.maxRequestsPerHour
      })
      return false
    }

    // Verificar limite por conta
    if (accountLimit.requests.length >= this.config.maxRequestsPerAccount) {
      logger.warn('[MLRateLimiter] Limite da conta atingido', {
        accountId,
        current: accountLimit.requests.length,
        max: this.config.maxRequestsPerAccount
      })
      return false
    }

    return true
  }

  recordRequest(accountId: string) {
    const now = Date.now()
    this.globalRequests.push(now)

    const accountLimit = this.getAccountLimit(accountId)
    accountLimit.requests.push(now)

    logger.debug('[MLRateLimiter] Request registrado', {
      accountId,
      globalCount: this.globalRequests.length,
      accountCount: accountLimit.requests.length
    })
  }

  async executeWithRetry<T>(
    accountId: string,
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Verificar rate limit
        const canProceed = await this.canMakeRequest(accountId)
        if (!canProceed) {
          const waitTime = this.getWaitTime(accountId)
          logger.info(`[MLRateLimiter] Aguardando ${waitTime}ms antes de tentar ${operationName}`)
          await this.wait(waitTime)
          continue
        }

        // Registrar request
        this.recordRequest(accountId)

        // Executar operação
        const result = await operation()

        if (attempt > 0) {
          logger.info(`[MLRateLimiter] ${operationName} bem-sucedido na tentativa ${attempt + 1}`)
        }

        return result

      } catch (error: any) {
        lastError = error

        // Se for erro 429 (rate limit), aguardar mais tempo
        if (error.status === 429 || error.message?.includes('429')) {
          const waitTime = this.config.retryDelay * Math.pow(2, attempt) // Exponential backoff
          logger.warn(`[MLRateLimiter] Rate limit atingido, aguardando ${waitTime}ms`, {
            operationName,
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries
          })
          await this.wait(waitTime)
          continue
        }

        // Se for erro 401 (unauthorized), não tentar novamente
        if (error.status === 401 || error.message?.includes('401')) {
          logger.error(`[MLRateLimiter] Token inválido ou expirado para ${operationName}`)
          throw error
        }

        // Para outros erros, tentar novamente com delay menor
        if (attempt < this.config.maxRetries - 1) {
          const waitTime = this.config.retryDelay
          logger.warn(`[MLRateLimiter] Erro em ${operationName}, tentando novamente em ${waitTime}ms`, {
            error: error.message,
            attempt: attempt + 1
          })
          await this.wait(waitTime)
        }
      }
    }

    logger.error(`[MLRateLimiter] ${operationName} falhou após ${this.config.maxRetries} tentativas`)
    throw lastError
  }

  private getWaitTime(accountId: string): number {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)

    const accountLimit = this.getAccountLimit(accountId)
    const recentRequests = accountLimit.requests.filter(time => time > oneHourAgo)

    if (recentRequests.length === 0) {
      return 0
    }

    // Calcular tempo até a request mais antiga sair da janela de 1 hora
    const oldestRequest = Math.min(...recentRequests)
    const timeUntilReset = (oldestRequest + (60 * 60 * 1000)) - now

    // Retornar no mínimo 1 segundo, no máximo 60 segundos
    return Math.min(Math.max(timeUntilReset, 1000), 60000)
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getStats() {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)

    const globalCount = this.globalRequests.filter(time => time > oneHourAgo).length
    const accountStats: Record<string, number> = {}

    for (const [accountId, limit] of this.accountLimits.entries()) {
      const count = limit.requests.filter(time => time > oneHourAgo).length
      if (count > 0) {
        accountStats[accountId] = count
      }
    }

    return {
      global: {
        current: globalCount,
        max: this.config.maxRequestsPerHour,
        percentage: Math.round((globalCount / this.config.maxRequestsPerHour) * 100)
      },
      accounts: accountStats,
      config: this.config
    }
  }
}

export const mlRateLimiter = MLRateLimiter.getInstance()