/**
 * Sistema de Cache para APIs do Mercado Livre
 * Reduz chamadas desnecessárias e melhora performance
 * Implementa cache em memória com TTL configurável
 */

import { logger } from '@/lib/logger'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class CacheManager {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly defaultTTL = 5 * 60 * 1000 // 5 minutos

  constructor(private name: string) {
    // Limpa cache expirado a cada minuto
    setInterval(() => this.cleanup(), 60000)
  }

  /**
   * Obtém item do cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Verifica se expirou
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    logger.info(`[Cache:${this.name}] HIT para ${key}`)
    return entry.data as T
  }

  /**
   * Armazena item no cache
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
    logger.info(`[Cache:${this.name}] SET ${key} com TTL ${ttl}ms`)
  }

  /**
   * Remove item do cache
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear()
    logger.info(`[Cache:${this.name}] Cache limpo`)
  }

  /**
   * Limpa itens expirados
   */
  private cleanup(): void {
    let removed = 0
    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        removed++
      }
    }
    if (removed > 0) {
      logger.info(`[Cache:${this.name}] Removidos ${removed} itens expirados`)
    }
  }

  /**
   * Retorna estatísticas do cache
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Executa função com cache
   */
  async withCache<T>(
    key: string, 
    fn: () => Promise<T>, 
    ttl: number = this.defaultTTL
  ): Promise<T> {
    // Verifica cache primeiro
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Se não tem cache, executa função
    try {
      const result = await fn()
      // Só armazena no cache se sucesso
      this.set(key, result, ttl)
      return result
    } catch (error) {
      // Em caso de erro, não armazena no cache
      throw error
    }
  }
}

// Caches específicos por tipo de dados
export const userCache = new CacheManager('User')
export const metricsCache = new CacheManager('Metrics')
export const itemsCache = new CacheManager('Items')
export const questionsCache = new CacheManager('Questions')
export const billingCache = new CacheManager('Billing')

/**
 * TTLs recomendados por tipo de dado
 */
export const CacheTTL = {
  USER: 10 * 60 * 1000,        // 10 minutos - dados do usuário mudam pouco
  METRICS: 5 * 60 * 1000,       // 5 minutos - métricas atualizadas
  ITEMS: 15 * 60 * 1000,        // 15 minutos - produtos mudam menos
  QUESTIONS: 2 * 60 * 1000,     // 2 minutos - perguntas são dinâmicas
  BILLING: 30 * 60 * 1000,      // 30 minutos - faturamento muda pouco
  ORDERS: 3 * 60 * 1000,        // 3 minutos - pedidos são críticos
  REPUTATION: 60 * 60 * 1000    // 1 hora - reputação muda lentamente
}

/**
 * Gera chave de cache baseada em parâmetros
 */
export function getCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('-')
  return `${prefix}:${sortedParams}`
}

/**
 * Invalida cache relacionado quando dados mudam
 */
export function invalidateRelatedCache(type: string, id?: string): void {
  switch (type) {
    case 'user':
      userCache.clear()
      metricsCache.clear() // Métricas dependem do usuário
      break
    case 'order':
      metricsCache.clear() // Pedidos afetam métricas
      billingCache.clear() // E faturamento
      break
    case 'question':
      questionsCache.clear()
      metricsCache.clear() // Questões afetam métricas de atendimento
      break
    case 'item':
      if (id) {
        itemsCache.delete(`item:${id}`)
      } else {
        itemsCache.clear()
      }
      break
    default:
      // Por segurança, limpa tudo
      userCache.clear()
      metricsCache.clear()
      itemsCache.clear()
      questionsCache.clear()
      billingCache.clear()
  }
}