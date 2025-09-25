/**
 * Rate Limiting Granular por Endpoint
 * Controle fino de rate limits respeitando limites ML
 * Suporta milhares de usuários simultâneos
 */

import { logger } from '@/lib/logger'
import { mlRateLimitHits } from '@/lib/monitoring/prometheus-metrics'

/**
 * Configuração de rate limits por endpoint
 * Baseado na documentação oficial do ML
 */
export const ENDPOINT_LIMITS = {
  // Endpoints críticos (baixo limite)
  '/oauth/token': {
    requests: 10,
    window: 60 * 1000, // 1 minuto
    message: 'Token refresh limit exceeded'
  },
  '/questions/answer': {
    requests: 100,
    window: 60 * 1000, // 100 por minuto
    message: 'Answer rate limit exceeded'
  },
  
  // Endpoints de leitura (médio limite)
  '/users/me': {
    requests: 60,
    window: 60 * 1000, // 1 por segundo
    message: 'User info rate limit exceeded'
  },
  '/items': {
    requests: 300,
    window: 60 * 1000, // 5 por segundo
    message: 'Items query limit exceeded'
  },
  '/questions/search': {
    requests: 120,
    window: 60 * 1000, // 2 por segundo
    message: 'Questions search limit exceeded'
  },
  
  // Endpoints de escrita (baixo limite)
  '/items/update': {
    requests: 30,
    window: 60 * 1000, // 30 por minuto
    message: 'Item update limit exceeded'
  },
  '/messages/send': {
    requests: 60,
    window: 60 * 1000, // 1 por segundo
    message: 'Message send limit exceeded'
  },
  
  // Endpoints de analytics (alto limite, cache pesado)
  '/metrics': {
    requests: 10,
    window: 60 * 1000, // 10 por minuto (usa cache)
    message: 'Metrics query limit exceeded'
  },
  '/reports': {
    requests: 5,
    window: 60 * 1000, // 5 por minuto (processamento pesado)
    message: 'Reports generation limit exceeded'
  },
  
  // Webhook endpoints (sem limite, mas com validação)
  '/webhook/ml': {
    requests: 1000,
    window: 60 * 1000, // Alto limite, ML controla do lado deles
    message: 'Webhook rate limit exceeded'
  },
  
  // Default para endpoints não especificados
  default: {
    requests: 60,
    window: 60 * 1000, // 1 por segundo padrão
    message: 'API rate limit exceeded'
  }
} as const

/**
 * Interface para bucket de rate limit
 */
interface RateLimitBucket {
  requests: number[]
  window: number
  limit: number
}

/**
 * Classe de Rate Limiter Granular
 * Implementa sliding window com precisão de milissegundos
 */
export class GranularRateLimiter {
  // Mapas separados por organização e endpoint
  private buckets = new Map<string, RateLimitBucket>()
  
  // Limpa buckets antigos periodicamente
  private cleanupInterval: NodeJS.Timeout
  
  constructor() {
    // Cleanup a cada minuto
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60 * 1000)
  }
  
  /**
   * Gera chave única para bucket
   */
  private getBucketKey(
    organizationId: string,
    accountId: string,
    endpoint: string
  ): string {
    return `${organizationId}:${accountId}:${endpoint}`
  }
  
  /**
   * Obtém configuração de limite para endpoint
   */
  private getEndpointConfig(endpoint: string): typeof ENDPOINT_LIMITS[keyof typeof ENDPOINT_LIMITS] {
    // Procura match exato
    if (endpoint in ENDPOINT_LIMITS) {
      return ENDPOINT_LIMITS[endpoint as keyof typeof ENDPOINT_LIMITS]
    }
    
    // Procura match por padrão
    for (const [pattern, config] of Object.entries(ENDPOINT_LIMITS)) {
      if (endpoint.includes(pattern.replace('/', ''))) {
        return config
      }
    }
    
    // Retorna default
    return ENDPOINT_LIMITS.default
  }
  
  /**
   * Verifica se requisição é permitida
   */
  async checkLimit(
    organizationId: string,
    accountId: string,
    endpoint: string
  ): Promise<{
    allowed: boolean
    remaining: number
    resetAt: number
    retryAfter?: number
    message?: string
  }> {
    const key = this.getBucketKey(organizationId, accountId, endpoint)
    const config = this.getEndpointConfig(endpoint)
    const now = Date.now()
    
    // Obtém ou cria bucket
    let bucket = this.buckets.get(key)
    if (!bucket) {
      bucket = {
        requests: [],
        window: config.window,
        limit: config.requests
      }
      this.buckets.set(key, bucket)
    }
    
    // Remove requisições fora da janela
    bucket.requests = bucket.requests.filter(
      timestamp => now - timestamp < bucket.window
    )
    
    // Verifica limite
    const remaining = bucket.limit - bucket.requests.length
    
    if (remaining <= 0) {
      // Calcula quando o próximo slot estará disponível
      const oldestRequest = Math.min(...bucket.requests)
      const resetAt = oldestRequest + bucket.window
      const retryAfter = Math.ceil((resetAt - now) / 1000) // Em segundos
      
      // Registra métrica
      mlRateLimitHits.inc({
        account_id: accountId,
        endpoint
      })
      
      logger.warn('[RateLimit] Limit exceeded', {
        organizationId,
        accountId,
        endpoint,
        limit: bucket.limit,
        window: bucket.window,
        retryAfter
      })
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
        message: config.message
      }
    }
    
    // Adiciona nova requisição
    bucket.requests.push(now)
    
    // Calcula reset time
    const resetAt = bucket.requests.length > 0
      ? Math.min(...bucket.requests) + bucket.window
      : now + bucket.window
    
    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt
    }
  }
  
  /**
   * Reseta limite para conta específica
   */
  resetLimit(
    organizationId: string,
    accountId: string,
    endpoint?: string
  ): void {
    if (endpoint) {
      const key = this.getBucketKey(organizationId, accountId, endpoint)
      this.buckets.delete(key)
    } else {
      // Reseta todos os endpoints da conta
      const prefix = `${organizationId}:${accountId}:`
      for (const key of this.buckets.keys()) {
        if (key.startsWith(prefix)) {
          this.buckets.delete(key)
        }
      }
    }
    
    logger.info('[RateLimit] Limits reset', {
      organizationId,
      accountId,
      endpoint: endpoint || 'all'
    })
  }
  
  /**
   * Obtém estatísticas de uso
   */
  getStats(organizationId: string, accountId: string): Record<string, {
    used: number
    limit: number
    percentage: number
  }> {
    const stats: Record<string, any> = {}
    const prefix = `${organizationId}:${accountId}:`
    const now = Date.now()
    
    for (const [key, bucket] of this.buckets.entries()) {
      if (key.startsWith(prefix)) {
        const endpoint = key.replace(prefix, '')
        
        // Remove requisições antigas
        const validRequests = bucket.requests.filter(
          timestamp => now - timestamp < bucket.window
        )
        
        stats[endpoint] = {
          used: validRequests.length,
          limit: bucket.limit,
          percentage: Math.round((validRequests.length / bucket.limit) * 100)
        }
      }
    }
    
    return stats
  }
  
  /**
   * Limpa buckets vazios ou expirados
   */
  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, bucket] of this.buckets.entries()) {
      // Remove requisições antigas
      bucket.requests = bucket.requests.filter(
        timestamp => now - timestamp < bucket.window
      )
      
      // Remove bucket se vazio há mais de 5 minutos
      if (bucket.requests.length === 0) {
        this.buckets.delete(key)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      logger.info(`[RateLimit] Cleaned ${cleaned} empty buckets`)
    }
  }
  
  /**
   * Para o cleanup interval (para testes)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

// Instância global
export const granularRateLimiter = new GranularRateLimiter()

/**
 * Middleware para Express/Next.js
 */
export async function rateLimitMiddleware(
  req: any,
  res: any,
  next: any
): Promise<void> {
  // Extrai informações da requisição
  const organizationId = req.user?.organizationId || 'anonymous'
  const accountId = req.user?.accountId || req.ip || 'unknown'
  const endpoint = req.path || req.url || '/'
  
  // Verifica limite
  const result = await granularRateLimiter.checkLimit(
    organizationId,
    accountId,
    endpoint
  )
  
  // Adiciona headers de rate limit
  res.setHeader('X-RateLimit-Limit', result.remaining + 1)
  res.setHeader('X-RateLimit-Remaining', result.remaining)
  res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString())
  
  if (!result.allowed) {
    res.setHeader('Retry-After', result.retryAfter || 60)
    res.status(429).json({
      error: 'Too Many Requests',
      message: result.message,
      retryAfter: result.retryAfter
    })
    return
  }
  
  next()
}

/**
 * Rate limiter específico para ML API
 * Garante que não excedemos 2000 req/hora global
 */
export class MLApiRateLimiter {
  private globalRequests: number[] = []
  private readonly GLOBAL_LIMIT = 1800 // 90% de 2000 para margem
  private readonly WINDOW = 60 * 60 * 1000 // 1 hora
  
  canMakeRequest(): boolean {
    const now = Date.now()
    
    // Remove requisições antigas
    this.globalRequests = this.globalRequests.filter(
      timestamp => now - timestamp < this.WINDOW
    )
    
    return this.globalRequests.length < this.GLOBAL_LIMIT
  }
  
  recordRequest(): void {
    this.globalRequests.push(Date.now())
  }
  
  getUsage(): {
    used: number
    limit: number
    percentage: number
    resetAt: number
  } {
    const now = Date.now()
    
    // Remove requisições antigas
    this.globalRequests = this.globalRequests.filter(
      timestamp => now - timestamp < this.WINDOW
    )
    
    const oldestRequest = Math.min(...this.globalRequests)
    
    return {
      used: this.globalRequests.length,
      limit: this.GLOBAL_LIMIT,
      percentage: Math.round((this.globalRequests.length / this.GLOBAL_LIMIT) * 100),
      resetAt: oldestRequest + this.WINDOW
    }
  }
}

export const mlApiRateLimiter = new MLApiRateLimiter()

export default {
  granularRateLimiter,
  mlApiRateLimiter,
  rateLimitMiddleware,
  ENDPOINT_LIMITS
}