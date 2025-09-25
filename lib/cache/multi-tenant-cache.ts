import { logger } from '@/lib/logger'
import { Redis } from 'ioredis'
import crypto from 'crypto'

// Configurações de TTL por tipo de cache
export const CACHE_TTL = {
  // Métricas agregadas - 30 segundos
  METRICS_AGGREGATED: 30,
  // Métricas por conta - 60 segundos
  METRICS_ACCOUNT: 60,
  // Lista de perguntas - 10 segundos
  QUESTIONS_LIST: 10,
  // Detalhes de pergunta - 5 minutos
  QUESTION_DETAIL: 300,
  // Dados de conta ML - 5 minutos
  ML_ACCOUNT: 300,
  // Dados de organização - 10 minutos
  ORGANIZATION: 600,
  // Token de aprovação - 24 horas
  APPROVAL_TOKEN: 86400,
  // Dados da API do ML - 2 minutos
  ML_API_DATA: 120,
  // Sessão de usuário - 30 minutos
  USER_SESSION: 1800
} as const

// Interface para item cacheável
export interface CacheableItem<T = any> {
  data: T
  timestamp: string
  ttl: number
  organizationId?: string
  accountId?: string
  tags?: string[]
}

// Classe principal de cache multi-tenant
export class MultiTenantCache {
  private redis: Redis
  private prefix: string
  
  constructor(redisUrl?: string, prefix = 'cache') {
    this.redis = new Redis(redisUrl || process.env['REDIS_URL'] || 'redis://localhost:6379')
    this.prefix = prefix
    
    this.redis.on('error', (error) => {
      logger.error('[Cache] Redis connection error', { error })
    })
    
    this.redis.on('connect', () => {
      logger.info('[Cache] Connected to Redis')
    })
  }
  
  /**
   * Gera chave de cache com isolamento por tenant
   */
  private generateKey(
    type: string,
    identifier: string,
    organizationId?: string,
    accountId?: string
  ): string {
    const parts = [this.prefix, type]
    
    if (organizationId) {
      parts.push(`org:${organizationId}`)
    }
    
    if (accountId) {
      parts.push(`acc:${accountId}`)
    }
    
    parts.push(identifier)
    
    return parts.join(':')
  }
  
  /**
   * Gera hash MD5 para chaves longas
   */
  private hashKey(key: string): string {
    if (key.length > 200) {
      const hash = crypto.createHash('md5').update(key).digest('hex')
      return `${this.prefix}:hash:${hash}`
    }
    return key
  }
  
  /**
   * Define item no cache com TTL
   */
  async set<T>(
    type: string,
    identifier: string,
    data: T,
    ttl: number,
    organizationId?: string,
    accountId?: string,
    tags?: string[]
  ): Promise<void> {
    try {
      const key = this.generateKey(type, identifier, organizationId, accountId)
      const hashedKey = this.hashKey(key)
      
      const cacheItem: CacheableItem<T> = {
        data,
        timestamp: new Date().toISOString(),
        ttl,
        ...(organizationId && { organizationId }),
        ...(accountId && { accountId }),
        ...(tags && { tags })
      }
      
      const serialized = JSON.stringify(cacheItem)
      
      await this.redis.setex(hashedKey, ttl, serialized)
      
      // Adicionar às tags para invalidação em grupo
      if (tags && tags.length > 0) {
        const pipeline = this.redis.pipeline()
        for (const tag of tags) {
          const tagKey = `${this.prefix}:tag:${tag}`
          pipeline.sadd(tagKey, hashedKey)
          pipeline.expire(tagKey, ttl)
        }
        await pipeline.exec()
      }
      
      // Adicionar ao índice da organização
      if (organizationId) {
        const orgIndexKey = `${this.prefix}:org-index:${organizationId}`
        await this.redis.sadd(orgIndexKey, hashedKey)
        await this.redis.expire(orgIndexKey, 86400) // 24 horas
      }
      
      logger.debug('[Cache] Item cached', {
        type,
        identifier,
        ttl,
        organizationId,
        accountId,
        hashedKey
      })
      
    } catch (error) {
      logger.error('[Cache] Error setting cache', { error, type, identifier })
    }
  }
  
  /**
   * Obtém item do cache
   */
  async get<T>(
    type: string,
    identifier: string,
    organizationId?: string,
    accountId?: string
  ): Promise<T | null> {
    try {
      const key = this.generateKey(type, identifier, organizationId, accountId)
      const hashedKey = this.hashKey(key)
      
      const cached = await this.redis.get(hashedKey)
      
      if (!cached) {
        logger.debug('[Cache] Cache miss', { type, identifier })
        return null
      }
      
      const cacheItem: CacheableItem<T> = JSON.parse(cached)
      
      // Verificar isolamento multi-tenant
      if (organizationId && cacheItem.organizationId !== organizationId) {
        logger.warn('[Cache] Tenant isolation violation attempt', {
          requested: organizationId,
          cached: cacheItem.organizationId
        })
        return null
      }
      
      logger.debug('[Cache] Cache hit', { 
        type, 
        identifier,
        age: Date.now() - new Date(cacheItem.timestamp).getTime()
      })
      
      return cacheItem.data
      
    } catch (error) {
      logger.error('[Cache] Error getting cache', { error, type, identifier })
      return null
    }
  }
  
  /**
   * Invalida cache por chave
   */
  async invalidate(
    type: string,
    identifier: string,
    organizationId?: string,
    accountId?: string
  ): Promise<void> {
    try {
      const key = this.generateKey(type, identifier, organizationId, accountId)
      const hashedKey = this.hashKey(key)
      
      await this.redis.del(hashedKey)
      
      logger.debug('[Cache] Cache invalidated', { type, identifier })
      
    } catch (error) {
      logger.error('[Cache] Error invalidating cache', { error, type, identifier })
    }
  }
  
  /**
   * Invalida cache por tag
   */
  async invalidateByTag(tag: string): Promise<void> {
    try {
      const tagKey = `${this.prefix}:tag:${tag}`
      const keys = await this.redis.smembers(tagKey)
      
      if (keys.length > 0) {
        await this.redis.del(...keys)
        await this.redis.del(tagKey)
        
        logger.info('[Cache] Invalidated by tag', { tag, count: keys.length })
      }
      
    } catch (error) {
      logger.error('[Cache] Error invalidating by tag', { error, tag })
    }
  }
  
  /**
   * Invalida todo cache de uma organização
   */
  async invalidateOrganization(organizationId: string): Promise<void> {
    try {
      const orgIndexKey = `${this.prefix}:org-index:${organizationId}`
      const keys = await this.redis.smembers(orgIndexKey)
      
      if (keys.length > 0) {
        await this.redis.del(...keys)
        await this.redis.del(orgIndexKey)
        
        logger.info('[Cache] Organization cache invalidated', { 
          organizationId, 
          count: keys.length 
        })
      }
      
    } catch (error) {
      logger.error('[Cache] Error invalidating organization', { error, organizationId })
    }
  }
  
  /**
   * Implementa cache-aside pattern
   */
  async getOrSet<T>(
    type: string,
    identifier: string,
    factory: () => Promise<T>,
    ttl: number,
    organizationId?: string,
    accountId?: string,
    tags?: string[]
  ): Promise<T> {
    // Tentar obter do cache
    const cached = await this.get<T>(type, identifier, organizationId, accountId)
    
    if (cached !== null) {
      return cached
    }
    
    // Se não estiver em cache, executar factory
    const data = await factory()
    
    // Armazenar no cache
    await this.set(type, identifier, data, ttl, organizationId, accountId, tags)
    
    return data
  }
  
  /**
   * Obtém estatísticas de cache
   */
  async getStats(): Promise<{
    keys: number
    memory: string
    hits: number
    misses: number
    hitRate: number
  }> {
    const info = await this.redis.info('stats')
    const stats = info.split('\r\n').reduce((acc, line) => {
      const [key, value] = line.split(':')
      if (key && value) {
        acc[key] = value
      }
      return acc
    }, {} as Record<string, string>)
    
    const hits = parseInt(stats['keyspace_hits'] || '0')
    const misses = parseInt(stats['keyspace_misses'] || '0')
    
    return {
      keys: await this.redis.dbsize(),
      memory: stats['used_memory_human'] || '0',
      hits,
      misses,
      hitRate: (hits + misses) > 0 ? (hits / (hits + misses)) * 100 : 0
    }
  }
  
  /**
   * Limpa cache expirado
   */
  async cleanup(): Promise<void> {
    try {
      // Redis já remove automaticamente chaves expiradas
      // Mas podemos forçar uma limpeza
      const result = await this.redis.eval(
        `
        local expired = 0
        local cursor = "0"
        repeat
          local result = redis.call("SCAN", cursor, "MATCH", "${this.prefix}:*", "COUNT", 100)
          cursor = result[1]
          for _, key in ipairs(result[2]) do
            if redis.call("TTL", key) == -1 then
              redis.call("DEL", key)
              expired = expired + 1
            end
          end
        until cursor == "0"
        return expired
        `,
        0
      )
      
      if (result && typeof result === 'number' && result > 0) {
        logger.info('[Cache] Cleanup completed', { expired: result })
      }
      
    } catch (error) {
      logger.error('[Cache] Error during cleanup', { error })
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
let cacheInstance: MultiTenantCache | null = null

export function getCache(): MultiTenantCache {
  if (!cacheInstance) {
    cacheInstance = new MultiTenantCache()
  }
  return cacheInstance
}

// Helper functions para uso direto nas APIs
export async function cacheGet<T>(
  key: string,
  organizationId: string
): Promise<T | null> {
  const cache = getCache()
  return cache.get<T>('api', key, organizationId)
}

export async function cacheSet<T>(
  key: string,
  data: T,
  ttl: number,
  organizationId: string
): Promise<void> {
  const cache = getCache()
  await cache.set('api', key, data, ttl, organizationId)
}

export async function cacheInvalidate(
  key: string,
  organizationId: string
): Promise<void> {
  const cache = getCache()
  await cache.invalidate('api', key, organizationId)
}