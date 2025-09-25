/**
 * Rate Limiter Implementation
 * Production-ready rate limiting for API and WebSocket connections
 */

import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'

export interface RateLimitOptions {
  windowMs?: number
  maxRequests?: number
  keyPrefix?: string
}

class RateLimiter {
  private readonly defaultWindowMs = 60000 // 1 minute
  private readonly defaultMaxRequests = 100

  /**
   * Check if a request is allowed based on rate limits
   * @param key Unique identifier for rate limiting (e.g., IP, user ID, organization ID)
   * @param maxRequests Maximum number of requests allowed
   * @param windowMs Time window in milliseconds
   * @returns Whether the request is allowed
   */
  async check(
    key: string,
    maxRequests: number = this.defaultMaxRequests,
    windowMs: number = this.defaultWindowMs
  ): Promise<boolean> {
    try {
      const redisKey = `ratelimit:${key}`
      const now = Date.now()
      const windowStart = now - windowMs

      // Use Redis sorted sets for sliding window rate limiting
      const pipe = redis.pipeline()
      
      // Remove old entries outside the window
      pipe.zremrangebyscore(redisKey, '-inf', windowStart)
      
      // Count current entries in the window
      pipe.zcard(redisKey)
      
      // Add current request
      pipe.zadd(redisKey, now, `${now}-${Math.random()}`)
      
      // Set expiry
      pipe.expire(redisKey, Math.ceil(windowMs / 1000))
      
      const results = await pipe.exec()
      
      if (!results) {
        logger.error('[RateLimiter] Pipeline execution failed')
        return true // Allow on error
      }

      const count = results[1]?.[1] as number
      
      if (count >= maxRequests) {
        logger.warn('[RateLimiter] Rate limit exceeded', { key, count, maxRequests })
        return false
      }

      return true
    } catch (error) {
      logger.error('[RateLimiter] Check failed', { error, key })
      return true // Allow on error to prevent blocking
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  async reset(key: string): Promise<void> {
    try {
      await redis.del(`ratelimit:${key}`)
    } catch (error) {
      logger.error('[RateLimiter] Reset failed', { error, key })
    }
  }

  /**
   * Get current usage for a key
   */
  async getUsage(key: string, windowMs: number = this.defaultWindowMs): Promise<number> {
    try {
      const redisKey = `ratelimit:${key}`
      const now = Date.now()
      const windowStart = now - windowMs

      // Count entries in current window
      const count = await redis.zcount(redisKey, windowStart, now)
      return count
    } catch (error) {
      logger.error('[RateLimiter] Get usage failed', { error, key })
      return 0
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter()