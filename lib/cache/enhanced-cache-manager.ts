/**
 * Enhanced Cache Manager with Stampede Protection
 * Prevents multiple simultaneous cache misses from overwhelming the database
 */

import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
// import { createHash } from 'crypto' - unused

interface CacheOptions {
  ttl?: number // Time to live in seconds
  staleWhileRevalidate?: number // Serve stale content while revalidating
  lockTimeout?: number // Lock timeout in milliseconds
  tags?: string[] // Cache tags for invalidation
}

interface CacheEntry<T> {
  data: T
  expiredAt: number
  staleAt?: number
  version: number
  tags?: string[]
}

export class EnhancedCacheManager {
  private readonly DEFAULT_TTL = 300 // 5 minutes
  private readonly DEFAULT_LOCK_TIMEOUT = 5000 // 5 seconds
  private readonly LOCK_RETRY_INTERVAL = 50 // 50ms
  private readonly MAX_LOCK_RETRIES = 100 // Max 5 seconds wait
  
  // In-memory L1 cache for hot data
  private memoryCache = new Map<string, CacheEntry<any>>()
  private readonly MAX_MEMORY_ITEMS = 10000
  
  constructor() {
    // Start cleanup job for memory cache
    this.startMemoryCleanup()
  }

  /**
   * Get value with cache-aside pattern and stampede protection
   */
  public async get<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const fullKey = this.generateKey(key)
    
    // 1. Try L1 memory cache first
    const memoryValue = this.getFromMemory<T>(fullKey)
    if (memoryValue !== null) {
      logger.debug(`[Cache] L1 hit: ${key}`)
      return memoryValue
    }

    // 2. Try L2 Redis cache
    const redisValue = await this.getFromRedis<T>(fullKey)
    if (redisValue !== null) {
      // Check if stale while revalidate
      if (redisValue.staleAt && Date.now() > redisValue.staleAt) {
        // Serve stale and revalidate in background
        this.revalidateInBackground(fullKey, fetchFn, options)
      }
      
      // Promote to L1
      this.setMemory(fullKey, redisValue)
      logger.debug(`[Cache] L2 hit: ${key}`)
      return redisValue.data
    }

    // 3. Cache miss - acquire lock to prevent stampede
    const lockKey = `${fullKey}:lock`
    const lockAcquired = await this.acquireLock(lockKey, options.lockTimeout)
    
    try {
      if (!lockAcquired) {
        // Another process is fetching, wait for result
        logger.debug(`[Cache] Waiting for lock: ${key}`)
        const result = await this.waitForResult<T>(fullKey)
        if (result !== null) {
          return result
        }
        // If still no result, proceed to fetch
      }

      // 4. Double-check cache after acquiring lock
      const recheckedValue = await this.getFromRedis<T>(fullKey)
      if (recheckedValue !== null) {
        return recheckedValue.data
      }

      // 5. Fetch fresh data
      logger.debug(`[Cache] Fetching fresh: ${key}`)
      const startTime = Date.now()
      const freshData = await fetchFn()
      const fetchTime = Date.now() - startTime
      
      // Log slow fetches
      if (fetchTime > 1000) {
        logger.warn(`[Cache] Slow fetch for ${key}: ${fetchTime}ms`)
      }

      // 6. Store in cache
      await this.set(fullKey, freshData, options)
      
      return freshData
    } finally {
      // Always release lock
      if (lockAcquired) {
        await this.releaseLock(lockKey)
      }
    }
  }

  /**
   * Set value in cache with both L1 and L2
   */
  public async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const fullKey = this.generateKey(key)
    const ttl = options.ttl || this.DEFAULT_TTL
    const expiredAt = Date.now() + (ttl * 1000)
    const staleAt = options.staleWhileRevalidate 
      ? Date.now() + ((ttl - options.staleWhileRevalidate) * 1000)
      : undefined

    const entry: CacheEntry<T> = {
      data: value,
      expiredAt,
      ...(staleAt !== undefined && { staleAt }),
      version: 1,
      ...(options.tags !== undefined && { tags: options.tags })
    }

    // Store in L2 (Redis)
    await redis.setex(
      fullKey,
      ttl,
      JSON.stringify(entry)
    )

    // Store in L1 (Memory)
    this.setMemory(fullKey, entry)

    // Update tag mappings
    if (options.tags) {
      await this.updateTags(fullKey, options.tags)
    }
  }

  /**
   * Invalidate cache by key or tags
   */
  public async invalidate(keyOrTag: string): Promise<void> {
    if (keyOrTag.includes(':')) {
      // It's a key
      const fullKey = this.generateKey(keyOrTag)
      await this.invalidateKey(fullKey)
    } else {
      // It's a tag
      await this.invalidateTag(keyOrTag)
    }
  }

  /**
   * Acquire distributed lock
   */
  private async acquireLock(
    lockKey: string,
    timeout?: number
  ): Promise<boolean> {
    const lockTimeout = timeout || this.DEFAULT_LOCK_TIMEOUT
    const lockValue = Date.now() + lockTimeout
    
    const result = await redis.set(
      lockKey,
      lockValue,
      'PX',
      lockTimeout,
      'NX'
    )
    
    return result === 'OK'
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(lockKey: string): Promise<void> {
    await redis.del(lockKey)
  }

  /**
   * Wait for another process to populate cache
   */
  private async waitForResult<T>(key: string): Promise<T | null> {
    for (let i = 0; i < this.MAX_LOCK_RETRIES; i++) {
      await new Promise(resolve => setTimeout(resolve, this.LOCK_RETRY_INTERVAL))
      
      // Check cache
      const value = await this.getFromRedis<T>(key)
      if (value !== null) {
        return value.data
      }
      
      // Check if lock still exists
      const lockKey = `${key}:lock`
      const lockExists = await redis.exists(lockKey)
      if (!lockExists) {
        // Lock released but no value, something went wrong
        return null
      }
    }
    
    logger.warn(`[Cache] Timeout waiting for ${key}`)
    return null
  }

  /**
   * Revalidate cache in background
   */
  private async revalidateInBackground<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    // Don't block, run in background
    setImmediate(async () => {
      try {
        const lockKey = `${key}:revalidate:lock`
        const lockAcquired = await this.acquireLock(lockKey, 1000)
        
        if (!lockAcquired) {
          // Another process is revalidating
          return
        }

        const freshData = await fetchFn()
        await this.set(key, freshData, options)
        
        await this.releaseLock(lockKey)
        logger.debug(`[Cache] Revalidated: ${key}`)
      } catch (_error) {
        logger.error(`[Cache] Revalidation failed for ${key}:`, { error: _error instanceof Error ? _error.message : String(_error) })
      }
    })
  }

  /**
   * Get from L1 memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key)
    
    if (!entry) {
      return null
    }

    if (Date.now() > entry.expiredAt) {
      this.memoryCache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Get from L2 Redis cache
   */
  private async getFromRedis<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const value = await redis.get(key)
      
      if (!value) {
        return null
      }

      const entry = JSON.parse(value) as CacheEntry<T>
      
      if (Date.now() > entry.expiredAt) {
        await redis.del(key)
        return null
      }

      return entry
    } catch (_error) {
      logger.error(`[Cache] Redis get _error for ${key}:`, { error: _error instanceof Error ? _error.message : String(_error) })
      return null
    }
  }

  /**
   * Set in L1 memory cache with LRU eviction
   */
  private setMemory<T>(key: string, entry: CacheEntry<T>): void {
    // LRU eviction if at capacity
    if (this.memoryCache.size >= this.MAX_MEMORY_ITEMS) {
      const firstKey = this.memoryCache.keys().next().value
      if (firstKey) {
        this.memoryCache.delete(firstKey)
      }
    }

    this.memoryCache.set(key, entry)
  }

  /**
   * Invalidate a specific key
   */
  private async invalidateKey(key: string): Promise<void> {
    // Remove from L1
    this.memoryCache.delete(key)
    
    // Remove from L2
    await redis.del(key)
    
    logger.debug(`[Cache] Invalidated key: ${key}`)
  }

  /**
   * Invalidate all keys with a specific tag
   */
  private async invalidateTag(tag: string): Promise<void> {
    const tagKey = `tag:${tag}`
    const keys = await redis.smembers(tagKey)
    
    if (keys.length === 0) {
      return
    }

    // Remove from L1
    for (const key of keys) {
      this.memoryCache.delete(key)
    }

    // Remove from L2
    if (keys.length > 0) {
      await redis.del(...keys)
    }

    // Clean up tag set
    await redis.del(tagKey)
    
    logger.debug(`[Cache] Invalidated tag ${tag}: ${keys.length} keys`)
  }

  /**
   * Update tag mappings
   */
  private async updateTags(key: string, tags: string[]): Promise<void> {
    const pipeline = redis.pipeline()
    
    for (const tag of tags) {
      pipeline.sadd(`tag:${tag}`, key)
      // Set expiry on tag set (2x TTL)
      pipeline.expire(`tag:${tag}`, this.DEFAULT_TTL * 2)
    }

    await pipeline.exec()
  }

  /**
   * Generate cache key with namespace
   */
  private generateKey(key: string): string {
    const namespace = process.env['CACHE_NAMESPACE'] || 'ml-agent'
    return `${namespace}:${key}`
  }

  /**
   * Start memory cache cleanup job
   */
  private startMemoryCleanup(): void {
    setInterval(() => {
      const now = Date.now()
      const keysToDelete: string[] = []

      for (const [key, entry] of this.memoryCache) {
        if (now > entry.expiredAt) {
          keysToDelete.push(key)
        }
      }

      for (const key of keysToDelete) {
        this.memoryCache.delete(key)
      }

      if (keysToDelete.length > 0) {
        logger.debug(`[Cache] Cleaned ${keysToDelete.length} expired L1 entries`)
      }
    }, 60000) // Every minute
  }

  /**
   * Get cache statistics
   */
  public getStats() {
    return {
      l1Size: this.memoryCache.size,
      l1MaxSize: this.MAX_MEMORY_ITEMS,
      l1Utilization: (this.memoryCache.size / this.MAX_MEMORY_ITEMS) * 100
    }
  }

  /**
   * Clear all cache
   */
  public async clear(): Promise<void> {
    // Clear L1
    this.memoryCache.clear()
    
    // Clear L2 (be careful in production!)
    const pattern = `${process.env['CACHE_NAMESPACE'] || 'ml-agent'}:*`
    const keys = await redis.keys(pattern)
    
    if (keys.length > 0) {
      await redis.del(...keys)
    }

    logger.info(`[Cache] Cleared all cache: ${keys.length} keys`)
  }
}

// Export singleton instance
export const cacheManager = new EnhancedCacheManager()