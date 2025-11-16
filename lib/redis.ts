/**
 * Cliente Redis para cache e sessões
 * Implementa isolamento completo por tenant (organizationId)
 * Crítico para multi-tenancy seguro
 */

import { logger } from '@/lib/logger'
import { Redis } from 'ioredis'

const REDIS_URL = process.env['REDIS_URL'] || 'redis://localhost:6379'

// Singleton instance
let redisClient: Redis | null = null
let isShuttingDown = false

/**
 * Obtém ou cria o cliente Redis
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    // Check if we're in build time
    const isBuildTime = process.env['NEXT_PHASE'] === 'phase-production-build' ||
                        process.env['BUILDING'] === 'true'

    const config = {
      maxRetriesPerRequest: isBuildTime ? null : 3,
      enableOfflineQueue: true, // ✅ Ativado para permitir operações em fila quando offline
      lazyConnect: true,
      enableReadyCheck: !isBuildTime,
      retryStrategy: (times: number) => {
        if (isShuttingDown || isBuildTime) return null
        if (times > 10) return null // Limita tentativas
        const delay = Math.min(times * 100, 3000)
        return delay
      },
      reconnectOnError: (err: Error) => {
        if (isShuttingDown || isBuildTime) return false
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED']
        if (targetErrors.some(e => err.message.includes(e))) {
          return true
        }
        return false
      },
      // Configurações de resiliência
      connectTimeout: 10000,
      keepAlive: 30000,
      family: 4 // Force IPv4
    }

    redisClient = new Redis(REDIS_URL, config)

    redisClient.on('error', (err) => {
      if (!isShuttingDown && !isBuildTime) {
        logger.error('[Redis] Connection error:', { error: { error: err } })
      }
    })

    redisClient.on('connect', () => {
      if (!isShuttingDown && !isBuildTime) {
        logger.info('[Redis] Connected successfully')
      }
    })

    // Connect only in runtime, not during build
    if (process.env['NODE_ENV'] !== 'test' && !isBuildTime) {
      redisClient.connect().catch(err => {
        if (!isShuttingDown) {
          logger.error('[Redis] Failed to connect:', { error: err })
        }
      })
    }
  }

  return redisClient
}

// Export direto - getRedisClient já faz lazy loading
export const redis = getRedisClient()

/**
 * Build tenant-isolated cache key
 */
function buildTenantKey(organizationId: string, key: string): string {
  if (!organizationId || organizationId === 'unknown') {
    throw new Error('OrganizationId is required for cache operations')
  }
  return `org:${organizationId}:${key}`
}

/**
 * Cache helpers com isolamento por tenant
 */
export const cache = {
  /**
   * Set com TTL e isolamento por tenant
   */
  async set(key: string, value: any, ttlSeconds?: number, organizationId?: string): Promise<void> {
    const finalKey = organizationId ? buildTenantKey(organizationId, key) : key
    const data = JSON.stringify(value)
    if (ttlSeconds) {
      await redis.setex(finalKey, ttlSeconds, data)
    } else {
      await redis.set(finalKey, data)
    }
  },
  
  /**
   * Get com parse automático e isolamento por tenant
   */
  async get<T = any>(key: string, organizationId?: string): Promise<T | null> {
    const finalKey = organizationId ? buildTenantKey(organizationId, key) : key
    const data = await redis.get(finalKey)
    if (!data) return null
    try {
      return JSON.parse(data) as T
    } catch {
      return data as any
    }
  },
  
  /**
   * Delete com isolamento por tenant
   */
  async del(key: string, organizationId?: string): Promise<void> {
    const finalKey = organizationId ? buildTenantKey(organizationId, key) : key
    await redis.del(finalKey)
  },
  
  /**
   * Check if exists com isolamento por tenant
   */
  async exists(key: string, organizationId?: string): Promise<boolean> {
    const finalKey = organizationId ? buildTenantKey(organizationId, key) : key
    const result = await redis.exists(finalKey)
    return result === 1
  },
  
  /**
   * Set com expiração em timestamp e isolamento por tenant
   */
  async setWithExpireAt(key: string, value: any, expireAt: Date, organizationId?: string): Promise<void> {
    const finalKey = organizationId ? buildTenantKey(organizationId, key) : key
    const data = JSON.stringify(value)
    await redis.set(finalKey, data)
    await redis.expireat(finalKey, Math.floor(expireAt.getTime() / 1000))
  },
  
  /**
   * Clear all cache for a specific organization
   */
  async clearOrganization(organizationId: string): Promise<void> {
    const pattern = `org:${organizationId}:*`
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  }
}

/**
 * Rate limiting helpers com isolamento por tenant
 */
export const rateLimiter = {
  /**
   * Check rate limit com isolamento por tenant
   */
  async check(key: string, limit: number, windowSeconds: number, organizationId?: string): Promise<{
    allowed: boolean
    remaining: number
    resetIn: number
  }> {
    const finalKey = organizationId ? buildTenantKey(organizationId, `ratelimit:${key}`) : `ratelimit:${key}`
    const now = Date.now()
    const windowStart = now - (windowSeconds * 1000)
    
    // Remove old entries
    await redis.zremrangebyscore(finalKey, '-inf', windowStart)
    
    // Count current entries
    const count = await redis.zcard(finalKey)
    
    if (count < limit) {
      // Add new entry
      await redis.zadd(finalKey, now, `${now}-${Math.random()}`)
      await redis.expire(finalKey, windowSeconds)
      
      return {
        allowed: true,
        remaining: limit - count - 1,
        resetIn: windowSeconds * 1000
      }
    }
    
    // Get oldest entry to calculate reset time
    const oldest = await redis.zrange(finalKey, 0, 0, 'WITHSCORES')
    const resetAt = oldest.length > 1 && oldest[1] ? parseInt(oldest[1]) + (windowSeconds * 1000) : now + (windowSeconds * 1000)
    
    return {
      allowed: false,
      remaining: 0,
      resetIn: resetAt - now
    }
  },
  
  /**
   * Reset rate limit com isolamento por tenant
   */
  async reset(key: string, organizationId?: string): Promise<void> {
    const finalKey = organizationId ? buildTenantKey(organizationId, `ratelimit:${key}`) : `ratelimit:${key}`
    await redis.del(finalKey)
  }
}

/**
 * Session storage helpers
 */
export const sessionStore = {
  /**
   * Store session
   */
  async set(sessionId: string, data: any, ttlSeconds: number = 86400): Promise<void> {
    await cache.set(`session:${sessionId}`, data, ttlSeconds)
  },
  
  /**
   * Get session
   */
  async get<T = any>(sessionId: string): Promise<T | null> {
    return cache.get<T>(`session:${sessionId}`)
  },
  
  /**
   * Delete session
   */
  async del(sessionId: string): Promise<void> {
    await cache.del(`session:${sessionId}`)
  },
  
  /**
   * Refresh TTL
   */
  async refresh(sessionId: string, ttlSeconds: number = 86400): Promise<void> {
    await redis.expire(`session:${sessionId}`, ttlSeconds)
  }
}

/**
 * OAuth state storage
 */
export const oauthStore = {
  /**
   * Store OAuth state
   */
  async setState(state: string, data: any, ttlSeconds: number = 600): Promise<void> {
    await cache.set(`oauth:${state}`, data, ttlSeconds)
  },
  
  /**
   * Get and delete OAuth state
   */
  async getState<T = any>(state: string): Promise<T | null> {
    const data = await cache.get<T>(`oauth:${state}`)
    if (data) {
      await cache.del(`oauth:${state}`)
    }
    return data
  }
}

/**
 * ML API cache com isolamento por tenant
 */
export const mlCache = {
  /**
   * Cache user info com isolamento por tenant
   */
  async setUserInfo(mlUserId: string, data: any, organizationId: string, ttlSeconds: number = 3600): Promise<void> {
    await cache.set(`ml:user:${mlUserId}`, data, ttlSeconds, organizationId)
  },
  
  /**
   * Get cached user info com isolamento por tenant
   */
  async getUserInfo(mlUserId: string, organizationId: string): Promise<any> {
    return cache.get(`ml:user:${mlUserId}`, organizationId)
  },
  
  /**
   * Cache metrics com isolamento por tenant
   */
  async setMetrics(mlUserId: string, type: string, data: any, organizationId: string, ttlSeconds: number = 300): Promise<void> {
    await cache.set(`ml:metrics:${mlUserId}:${type}`, data, ttlSeconds, organizationId)
  },
  
  /**
   * Get cached metrics com isolamento por tenant
   */
  async getMetrics(mlUserId: string, type: string, organizationId: string): Promise<any> {
    return cache.get(`ml:metrics:${mlUserId}:${type}`, organizationId)
  },
  
  /**
   * Clear all ML cache for an organization
   */
  async clearOrganizationCache(organizationId: string): Promise<void> {
    await cache.clearOrganization(organizationId)
  }
}

/**
 * Cleanup old data
 */
export async function cleanupExpiredData(): Promise<void> {
  // This is handled by Redis TTL automatically
  logger.info('[Redis] Cleanup task run (TTL-based)')
}

// Graceful shutdown - apenas em runtime
const isBuildTime = process.env['NEXT_PHASE'] === 'phase-production-build'
if (typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'test' && !isBuildTime) {
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown || !redisClient) return

    isShuttingDown = true
    logger.info(`[Redis] ${signal} received, shutting down gracefully...`)

    try {
      // Check if client is still connected before attempting to quit
      if (redisClient.status === 'ready' || redisClient.status === 'connect') {
        await redisClient.quit()
        logger.info('[Redis] Connection closed gracefully')
      } else {
        logger.info('[Redis] Connection already closed')
      }
    } catch (err) {
      // Ignore errors during shutdown
      if (process.env['NODE_ENV'] === 'development') {
        logger.debug('[Redis] Shutdown error (safe to ignore):', { error: err })
      }
    } finally {
      redisClient = null
    }
  }

  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.once('SIGINT', () => gracefulShutdown('SIGINT'))
}