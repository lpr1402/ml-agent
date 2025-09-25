import { logger } from '@/lib/logger'

interface CacheEntry {
  value: any
  expires: number
}

class CacheManager {
  private cache: Map<string, CacheEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      return null
    }

    logger.debug(`[Cache] Hit for key: ${key}`)
    return entry.value
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    const expires = Date.now() + (ttl * 1000)
    this.cache.set(key, { value, expires })
    logger.debug(`[Cache] Set key: ${key}, TTL: ${ttl}s`)
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key)
    logger.debug(`[Cache] Deleted key: ${key}`)
  }

  async clear(): Promise<void> {
    this.cache.clear()
    logger.info('[Cache] Cleared all entries')
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern)
    let deletedCount = 0

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        deletedCount++
      }
    }

    logger.info(`[Cache] Invalidated ${deletedCount} entries matching pattern: ${pattern}`)
  }

  private cleanup(): void {
    const now = Date.now()
    let expiredCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key)
        expiredCount++
      }
    }

    if (expiredCount > 0) {
      logger.debug(`[Cache] Cleaned up ${expiredCount} expired entries`)
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.cache.clear()
  }
}

// Singleton instance
export const cacheManager = new CacheManager()

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    cacheManager.destroy()
  })

  process.on('SIGINT', () => {
    cacheManager.destroy()
  })
}