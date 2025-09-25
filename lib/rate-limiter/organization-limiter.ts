import { logger } from '@/lib/logger'
import { Redis } from 'ioredis'

// Interface para configuração de rate limit
export interface RateLimitConfig {
  windowMs: number      // Janela de tempo em ms
  maxRequests: number   // Máximo de requisições na janela
  keyPrefix?: string    // Prefixo para chave Redis
}

// Configurações padrão por tipo de operação
export const RATE_LIMITS = {
  // API do Mercado Livre - 2000 req/hora por conta
  ML_API: {
    windowMs: 60 * 60 * 1000, // 1 hora
    maxRequests: 2000,
    keyPrefix: 'rl:ml_api'
  },
  // APIs internas - 1000 req/min por organização
  INTERNAL_API: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 1000,
    keyPrefix: 'rl:internal'
  },
  // Webhooks - 100 req/seg por organização
  WEBHOOK: {
    windowMs: 1000, // 1 segundo
    maxRequests: 100,
    keyPrefix: 'rl:webhook'
  },
  // Operações de escrita - 100 req/min por organização
  WRITE_OPS: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 100,
    keyPrefix: 'rl:write'
  },
  // SSE connections - 10 conexões simultâneas por organização
  SSE_CONNECTIONS: {
    windowMs: 0, // Não usa janela temporal
    maxRequests: 10,
    keyPrefix: 'rl:sse'
  }
} as const

// Classe para rate limiting por organização
export class OrganizationRateLimiter {
  private redis: Redis
  
  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env['REDIS_URL'] || 'redis://localhost:6379')
    
    this.redis.on('error', (error) => {
      logger.error('[RateLimiter] Redis connection error', { error })
    })
    
    this.redis.on('connect', () => {
      logger.info('[RateLimiter] Connected to Redis')
    })
  }
  
  /**
   * Verifica se a organização pode fazer a requisição
   * @returns true se permitido, false se limitado
   */
  async checkLimit(
    organizationId: string,
    config: RateLimitConfig = RATE_LIMITS.INTERNAL_API
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    try {
      const key = `${config.keyPrefix}:${organizationId}`
      const now = Date.now()
      const windowStart = now - config.windowMs
      
      // Usar sorted set do Redis para janela deslizante
      const pipeline = this.redis.pipeline()
      
      // Remover entradas antigas (fora da janela)
      pipeline.zremrangebyscore(key, '-inf', windowStart)
      
      // Contar requisições na janela atual
      pipeline.zcard(key)
      
      // Adicionar requisição atual se não exceder limite
      pipeline.zadd(key, now, `${now}-${Math.random()}`)
      
      // Definir TTL para limpeza automática
      pipeline.expire(key, Math.ceil(config.windowMs / 1000))
      
      const results = await pipeline.exec()
      
      if (!results) {
        throw new Error('Redis pipeline failed')
      }
      
      const count = results[1]?.[1] as number || 0
      const allowed = count < config.maxRequests
      
      // Se não permitido, remover a requisição adicionada
      if (!allowed && results[2]?.[1]) {
        await this.redis.zrem(key, `${now}-${Math.random()}`)
      }
      
      const remaining = Math.max(0, config.maxRequests - count - (allowed ? 1 : 0))
      const resetAt = new Date(now + config.windowMs)
      
      if (!allowed) {
        logger.warn('[RateLimiter] Rate limit exceeded', {
          organizationId,
          limit: config.maxRequests,
          window: config.windowMs,
          count
        })
      }
      
      return { allowed, remaining, resetAt }
      
    } catch (error) {
      // Em caso de erro, permitir a requisição mas logar
      logger.error('[RateLimiter] Error checking limit', { error, organizationId })
      return { 
        allowed: true, 
        remaining: config.maxRequests,
        resetAt: new Date(Date.now() + config.windowMs)
      }
    }
  }
  
  /**
   * Verifica limite específico para API do ML por conta
   */
  async checkMLAccountLimit(
    mlAccountId: string,
    organizationId: string
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    // Usar limite específico por conta ML (2000/hora)
    const config = RATE_LIMITS.ML_API
    
    const result = await this.checkLimit(mlAccountId, config)
    
    // Também verificar limite geral da organização
    const orgLimit = await this.checkLimit(organizationId, {
      ...RATE_LIMITS.ML_API,
      maxRequests: RATE_LIMITS.ML_API.maxRequests * 10 // 10 contas max
    })
    
    // Retornar o mais restritivo
    if (!orgLimit.allowed) {
      return orgLimit
    }
    
    return result
  }
  
  /**
   * Reseta o limite para uma organização (admin only)
   */
  async resetLimit(organizationId: string, config: RateLimitConfig): Promise<void> {
    const key = `${config.keyPrefix}:${organizationId}`
    await this.redis.del(key)
    
    logger.info('[RateLimiter] Limit reset', { organizationId, key })
  }
  
  /**
   * Obtém estatísticas de uso
   */
  async getUsageStats(organizationId: string): Promise<Record<string, any>> {
    const stats: Record<string, any> = {}
    
    for (const [name, config] of Object.entries(RATE_LIMITS)) {
      const key = `${config.keyPrefix}:${organizationId}`
      const count = await this.redis.zcard(key)
      
      stats[name] = {
        current: count,
        limit: config.maxRequests,
        window: config.windowMs,
        percentage: (count / config.maxRequests) * 100
      }
    }
    
    return stats
  }
  
  /**
   * Middleware para Express/Next.js
   */
  middleware(config: RateLimitConfig = RATE_LIMITS.INTERNAL_API) {
    return async (req: any, res: any, next: any) => {
      // Extrair organizationId do request (via session, token, etc)
      const organizationId = req.session?.organizationId || 
                           req.auth?.organizationId ||
                           req.headers['x-organization-id']
      
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not identified' })
      }
      
      const { allowed, remaining, resetAt } = await this.checkLimit(organizationId, config)
      
      // Adicionar headers de rate limit
      res.setHeader('X-RateLimit-Limit', config.maxRequests)
      res.setHeader('X-RateLimit-Remaining', remaining)
      res.setHeader('X-RateLimit-Reset', resetAt.toISOString())
      
      if (!allowed) {
        res.setHeader('Retry-After', Math.ceil((resetAt.getTime() - Date.now()) / 1000))
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Please retry after ${resetAt.toISOString()}`,
          retryAfter: resetAt
        })
      }
      
      next()
    }
  }
  
  /**
   * Fecha conexão com Redis
   */
  async close(): Promise<void> {
    await this.redis.quit()
  }
}

// Singleton para uso global
let rateLimiterInstance: OrganizationRateLimiter | null = null

export function getRateLimiter(): OrganizationRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new OrganizationRateLimiter()
  }
  return rateLimiterInstance
}

// Função helper para verificar rate limit em API routes
export async function checkRateLimit(
  organizationId: string,
  config: RateLimitConfig = RATE_LIMITS.INTERNAL_API
): Promise<{ allowed: boolean; headers: Record<string, string> }> {
  const limiter = getRateLimiter()
  const { allowed, remaining, resetAt } = await limiter.checkLimit(organizationId, config)
  
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetAt.toISOString()
  }
  
  if (!allowed) {
    headers['Retry-After'] = Math.ceil((resetAt.getTime() - Date.now()) / 1000).toString()
  }
  
  return { allowed, headers }
}