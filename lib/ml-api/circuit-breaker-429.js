/**
 * Circuit Breaker para API do Mercado Livre
 * Proteção contra rate limiting (429) com backoff inteligente
 *
 * ESTRATÉGIA BEST PRACTICES ML:
 * - Identificar erro 429 e distribuir requisições ao longo do tempo
 * - Backoff exponencial em caso de falhas
 * - Isolamento por conta ML (multi-tenant)
 * - Recovery automático com half-open state
 */

const Redis = require('ioredis')
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

class MLCircuitBreaker {
  constructor() {
    // Estado do circuit breaker por conta ML
    this.states = new Map() // mlAccountId -> { state, failures, lastFailTime, nextRetryTime }
    this.FAILURE_THRESHOLD = 3 // Abrir circuit após 3 falhas 429 consecutivas
    this.RECOVERY_TIMEOUT = 90000 // 90 segundos para tentar recovery (margem de segurança)
    this.BACKOFF_MULTIPLIER = 2 // Backoff exponencial
    this.MAX_BACKOFF_TIME = 300000 // Máximo 5 minutos de backoff

    console.log('🛡️ Circuit Breaker initialized with ML best practices')
  }

  /**
   * Verifica se pode fazer chamada para uma conta ML
   */
  async canExecute(mlAccountId) {
    const state = await this.getState(mlAccountId)

    if (state.state === 'OPEN') {
      // Circuit aberto - verificar se já pode tentar recovery
      const now = Date.now()
      if (now >= state.nextRetryTime) {
        // Tentar half-open
        await this.setState(mlAccountId, {
          ...state,
          state: 'HALF_OPEN'
        })
        return true
      }
      return false // Ainda em cooldown
    }

    return true // CLOSED ou HALF_OPEN - pode executar
  }

  /**
   * Registra sucesso de uma chamada
   */
  async onSuccess(mlAccountId) {
    const state = await this.getState(mlAccountId)

    if (state.state === 'HALF_OPEN') {
      // Recovery bem-sucedido - fechar circuit
      await this.setState(mlAccountId, {
        state: 'CLOSED',
        failures: 0,
        lastFailTime: 0,
        nextRetryTime: 0
      })
      console.log(`✅ Circuit breaker CLOSED for account ${mlAccountId}`)
    }

    // Reset failure count em sucesso
    if (state.failures > 0) {
      await this.setState(mlAccountId, {
        ...state,
        failures: 0
      })
    }
  }

  /**
   * Registra falha 429 de uma chamada
   */
  async on429Error(mlAccountId, retryAfterSeconds = null) {
    const state = await this.getState(mlAccountId)
    const now = Date.now()

    // Incrementar contador de falhas
    state.failures = (state.failures || 0) + 1
    state.lastFailTime = now

    // Se atingiu threshold ou está HALF_OPEN, abrir circuit
    if (state.failures >= this.FAILURE_THRESHOLD || state.state === 'HALF_OPEN') {
      // Calcular backoff time seguindo ML best practices
      let backoffTime = this.RECOVERY_TIMEOUT

      // Se ML enviou Retry-After, SEMPRE respeitar (best practice)
      if (retryAfterSeconds) {
        backoffTime = Math.max(retryAfterSeconds * 1000, backoffTime)
        console.log(`📊 ML API Retry-After: ${retryAfterSeconds}s (respeitando header)`)
      } else {
        // Backoff exponencial baseado no número de falhas
        backoffTime = Math.min(
          this.RECOVERY_TIMEOUT * Math.pow(this.BACKOFF_MULTIPLIER, state.failures - this.FAILURE_THRESHOLD),
          this.MAX_BACKOFF_TIME
        )
      }

      state.state = 'OPEN'
      state.nextRetryTime = now + backoffTime

      console.log(`🔴 Circuit breaker OPEN for account ${mlAccountId}`)
      console.log(`   Will retry in ${Math.round(backoffTime / 1000)} seconds`)

      // Salvar no Redis para compartilhar entre workers
      await redis.set(
        `circuit:${mlAccountId}`,
        JSON.stringify(state),
        'PX',
        backoffTime
      )
    }

    await this.setState(mlAccountId, state)
    return state
  }

  /**
   * Registra outro tipo de erro (não 429)
   */
  async onError(mlAccountId, error) {
    // Outros erros não abrem o circuit, mas podem ser logados
    console.log(`⚠️ Non-429 error for account ${mlAccountId}:`, error.message)

    // Se for 401/403, pode ser útil marcar a conta
    if (error.status === 401 || error.status === 403) {
      await redis.set(
        `auth_error:${mlAccountId}`,
        JSON.stringify({ error: error.message, time: Date.now() }),
        'EX',
        3600 // Expirar em 1 hora
      )
    }
  }

  /**
   * Obtem estado atual do circuit para uma conta
   */
  async getState(mlAccountId) {
    // Tentar obter do Redis primeiro (compartilhado entre workers)
    const redisState = await redis.get(`circuit:${mlAccountId}`)
    if (redisState) {
      const parsed = JSON.parse(redisState)
      this.states.set(mlAccountId, parsed)
      return parsed
    }

    // Se não tem no Redis, pegar do Map local
    if (!this.states.has(mlAccountId)) {
      this.states.set(mlAccountId, {
        state: 'CLOSED',
        failures: 0,
        lastFailTime: 0,
        nextRetryTime: 0
      })
    }

    return this.states.get(mlAccountId)
  }

  /**
   * Atualiza estado do circuit
   */
  async setState(mlAccountId, state) {
    this.states.set(mlAccountId, state)

    // Se circuit está aberto, salvar no Redis
    if (state.state === 'OPEN') {
      const ttl = Math.max(state.nextRetryTime - Date.now(), 1000)
      await redis.set(
        `circuit:${mlAccountId}`,
        JSON.stringify(state),
        'PX',
        ttl
      )
    }
  }

  /**
   * Obtem tempo de espera para uma conta (0 se pode executar)
   */
  async getWaitTime(mlAccountId) {
    const state = await this.getState(mlAccountId)

    if (state.state === 'OPEN') {
      const now = Date.now()
      if (now < state.nextRetryTime) {
        return state.nextRetryTime - now
      }
    }

    return 0
  }

  /**
   * Limpa estado de uma conta (para testes ou reset manual)
   */
  async reset(mlAccountId) {
    this.states.delete(mlAccountId)
    await redis.del(`circuit:${mlAccountId}`)
    console.log(`🔄 Circuit breaker reset for account ${mlAccountId}`)
  }

  /**
   * Retorna estatísticas do circuit breaker
   */
  getStats() {
    const stats = {
      total: this.states.size,
      open: 0,
      halfOpen: 0,
      closed: 0
    }

    for (const [accountId, state] of this.states) {
      switch (state.state) {
        case 'OPEN':
          stats.open++
          break
        case 'HALF_OPEN':
          stats.halfOpen++
          break
        default:
          stats.closed++
      }
    }

    return stats
  }
}

// Singleton
const circuitBreaker = new MLCircuitBreaker()

// Log stats periodicamente
setInterval(() => {
  const stats = circuitBreaker.getStats()
  if (stats.total > 0) {
    console.log(`📊 Circuit Breaker Stats:`, stats)
  }
}, 60000) // A cada minuto

module.exports = { circuitBreaker }