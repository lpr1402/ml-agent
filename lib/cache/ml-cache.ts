import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'

export class MLCache {
  private static readonly TTL = {
    USER: 10800,       // 3 horas - dados do vendedor atualizados regularmente
    ITEM: 1800,        // 30 minutos - items podem ter atualizações
    ITEM_DESC: 1800,   // 30 minutos - descrição do item (igual ao item)
    SHIPPING: 3600,    // 1 hora - shipping raramente muda
    METRICS: 10800     // 3 horas - métricas atualizadas regularmente
    // REMOVIDO: QUESTION (cada pergunta é única, sem cache)
    // REMOVIDO: REPUTATION (não precisamos buscar)
  }

  /**
   * Gera chave de cache com namespace
   */
  private static key(type: string, id: string, accountId?: string): string {
    const prefix = accountId ? `ml:${accountId}` : 'ml:shared'
    return `${prefix}:${type}:${id}`
  }

  /**
   * Busca dados do cache
   */
  static async get<T>(type: string, id: string, accountId?: string): Promise<T | null> {
    try {
      const key = this.key(type, id, accountId)
      const cached = await redis.get(key)

      if (cached) {
        logger.debug(`[MLCache] Cache HIT: ${key}`)
        return JSON.parse(cached) as T
      }

      logger.debug(`[MLCache] Cache MISS: ${key}`)
      return null
    } catch (error) {
      logger.error('[MLCache] Error getting from cache', { error, type, id })
      return null
    }
  }

  /**
   * Armazena dados no cache
   */
  static async set<T>(
    type: string,
    id: string,
    data: T,
    accountId?: string,
    customTTL?: number
  ): Promise<void> {
    try {
      const key = this.key(type, id, accountId)
      const ttl = customTTL || this.TTL[type as keyof typeof this.TTL] || 600

      await redis.setex(key, ttl, JSON.stringify(data))
      logger.debug(`[MLCache] Cached: ${key} (TTL: ${ttl}s)`)
    } catch (error) {
      logger.error('[MLCache] Error setting cache', { error, type, id })
    }
  }

  /**
   * Invalida cache específico
   */
  static async invalidate(type: string, id: string, accountId?: string): Promise<void> {
    try {
      const key = this.key(type, id, accountId)
      await redis.del(key)
      logger.debug(`[MLCache] Invalidated: ${key}`)
    } catch (error) {
      logger.error('[MLCache] Error invalidating cache', { error, type, id })
    }
  }

  /**
   * Invalida todo cache de uma conta
   */
  static async invalidateAccount(accountId: string): Promise<void> {
    try {
      const pattern = `ml:${accountId}:*`
      const keys = await redis.keys(pattern)

      if (keys.length > 0) {
        await redis.del(...keys)
        logger.info(`[MLCache] Invalidated ${keys.length} keys for account ${accountId}`)
      }
    } catch (error) {
      logger.error('[MLCache] Error invalidating account cache', { error, accountId })
    }
  }

  /**
   * Cache com função de fallback
   */
  static async getOrFetch<T>(
    type: string,
    id: string,
    fetcher: () => Promise<T>,
    accountId?: string,
    customTTL?: number
  ): Promise<T | null> {
    try {
      // Tenta buscar do cache
      const cached = await this.get<T>(type, id, accountId)
      if (cached) {
        return cached
      }

      // Se não tem cache, busca da API
      const data = await fetcher()

      // Armazena no cache para próximas requisições
      if (data) {
        await this.set(type, id, data, accountId, customTTL)
      }

      return data
    } catch (error) {
      logger.error('[MLCache] Error in getOrFetch', { error, type, id })
      return null
    }
  }

  /**
   * Estatísticas do cache
   */
  static async getStats(): Promise<{
    totalKeys: number
    memoryUsage: string
    byAccount: Record<string, number>
  }> {
    try {
      const keys = await redis.keys('ml:*')
      const info = await redis.info('memory')
      const memMatch = info.match(/used_memory_human:(.+)\r?\n/)

      // Agrupa por conta
      const byAccount: Record<string, number> = {}
      for (const key of keys) {
        const match = key.match(/ml:([^:]+):/)
        if (match && match[1]) {
          const account = match[1]
          byAccount[account] = (byAccount[account] || 0) + 1
        }
      }

      return {
        totalKeys: keys.length,
        memoryUsage: memMatch?.[1] || 'N/A',
        byAccount
      }
    } catch (error) {
      logger.error('[MLCache] Error getting stats', { error })
      return {
        totalKeys: 0,
        memoryUsage: 'N/A',
        byAccount: {}
      }
    }
  }
}