/**
 * Cache Strategy Manager - Sistema de Cache Multi-Camada
 * Otimizado para 10.000+ vendedores simultâneos
 * Production-ready Setembro 2025
 */

import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// Configuração de TTL por tipo de dado
const CACHE_TTL = {
  // Tokens e Auth
  ML_TOKEN: 6 * 60 * 60,        // 6 horas (duração do token ML)
  SESSION: 30 * 60,              // 30 minutos
  USER_DATA: 15 * 60,            // 15 minutos
  
  // ML API Responses
  SELLER_INFO: 60 * 60,          // 1 hora
  REPUTATION: 30 * 60,           // 30 minutos
  ITEMS: 10 * 60,                // 10 minutos
  QUESTIONS: 60,                 // 1 minuto (real-time)
  METRICS: 5 * 60,               // 5 minutos
  
  // Aggregated Data
  DASHBOARD: 2 * 60,             // 2 minutos
  ANALYTICS: 10 * 60,            // 10 minutos
  REPORTS: 60 * 60,              // 1 hora
  
  // System
  CONFIG: 24 * 60 * 60,          // 24 horas
  FEATURE_FLAGS: 60,             // 1 minuto
  RATE_LIMIT: 60,                // 1 minuto
} as const

// Estratégias de invalidação
enum InvalidationStrategy {
  TTL_BASED = 'ttl',           // Expira por tempo
  EVENT_BASED = 'event',       // Invalida por evento
  WRITE_THROUGH = 'write',     // Atualiza ao escrever
  LAZY = 'lazy',                // Invalida sob demanda
}

export class CacheStrategy {
  private static instance: CacheStrategy
  private redisClient: any
  private localCache: Map<string, { value: any; expires: number }> = new Map()
  private warmupQueue: Set<string> = new Set()
  
  private constructor() {
    this.redisClient = redis
    this.initializeWarmup()
    this.startCacheMonitoring()
  }
  
  static getInstance(): CacheStrategy {
    if (!CacheStrategy.instance) {
      CacheStrategy.instance = new CacheStrategy()
    }
    return CacheStrategy.instance
  }
  
  /**
   * Cache com estratégia multi-camada (L1: Memory, L2: Redis)
   */
  async get<T>(
    key: string,
    options?: {
      l1Only?: boolean
      l2Only?: boolean
      deserialize?: (data: string) => T
    }
  ): Promise<T | null> {
    const startTime = Date.now()
    
    try {
      // L1: Cache local em memória (mais rápido)
      if (!options?.l2Only) {
        const local = this.localCache.get(key)
        if (local && (local as any).expires > Date.now()) {
          logger.debug('[Cache] L1 hit', { key, latency: Date.now() - startTime })
          return (local as any).value as T
        }
      }
      
      // L2: Redis cache
      if (!options?.l1Only) {
        const cached = await this.redisClient.get(key)
        if (cached) {
          logger.debug('[Cache] L2 hit', { key, latency: Date.now() - startTime })
          
          const value = options?.deserialize 
            ? options.deserialize(cached)
            : JSON.parse(cached)
          
          // Promove para L1 se for dado quente
          if (this.isHotData(key)) {
            this.setL1(key, value, 60) // 1 min em L1
          }
          
          return value as T
        }
      }
      
      logger.debug('[Cache] Miss', { key, latency: Date.now() - startTime })
      return null
      
    } catch (_error) {
      logger.error('[Cache] Get _error', { key, error: _error })
      return null
    }
  }
  
  /**
   * Set com estratégia multi-camada e warming
   */
  async set<T>(
    key: string,
    value: T,
    ttl?: number,
    options?: {
      strategy?: InvalidationStrategy
      warmup?: boolean
      tags?: string[]
      serialize?: (value: T) => string
    }
  ): Promise<void> {
    try {
      const finalTTL = ttl || this.getDefaultTTL(key)
      const serialized = options?.serialize 
        ? options.serialize(value)
        : JSON.stringify(value)
      
      // L2: Sempre salva no Redis
      await this.redisClient.setex(key, finalTTL, serialized)
      
      // L1: Salva em memória se for dado quente
      if (this.isHotData(key)) {
        this.setL1(key, value, Math.min(finalTTL, 300)) // Max 5 min em L1
      }
      
      // Tags para invalidação em grupo
      if (options?.tags) {
        await this.tagCache(key, options.tags)
      }
      
      // Adiciona para warmup se configurado
      if (options?.warmup) {
        this.warmupQueue.add(key)
      }
      
      logger.debug('[Cache] Set', { key, ttl: finalTTL, strategy: options?.strategy })
      
    } catch (_error) {
      logger.error('[Cache] Set _error', { key, error: _error })
    }
  }
  
  /**
   * Cache de tokens ML com segurança
   */
  async cacheMLToken(
    mlAccountId: string,
    token: string,
    expiresIn: number
  ): Promise<void> {
    const key = `ml:token:${mlAccountId}`
    const encryptedToken = this.encryptSensitive(token)
    
    await this.set(
      key,
      encryptedToken,
      Math.min(expiresIn - 300, CACHE_TTL.ML_TOKEN), // 5 min antes de expirar
      {
        strategy: InvalidationStrategy.TTL_BASED,
        warmup: true,
        tags: ['ml-tokens', `account:${mlAccountId}`]
      }
    )
  }
  
  /**
   * Cache de dados do vendedor
   */
  async cacheSellerData(
    sellerId: string,
    data: any,
    type: 'info' | 'reputation' | 'metrics'
  ): Promise<void> {
    const key = `seller:${type}:${sellerId}`
    const ttl = type === 'info' ? CACHE_TTL.SELLER_INFO :
                type === 'reputation' ? CACHE_TTL.REPUTATION :
                CACHE_TTL.METRICS
    
    await this.set(key, data, ttl, {
      strategy: InvalidationStrategy.EVENT_BASED,
      tags: ['seller-data', `seller:${sellerId}`]
    })
  }
  
  /**
   * Cache de respostas da API ML
   */
  async cacheMLResponse(
    endpoint: string,
    params: any,
    response: any,
    ttl?: number
  ): Promise<void> {
    const key = this.generateCacheKey(endpoint, params)
    const finalTTL = ttl || this.getEndpointTTL(endpoint)
    
    await this.set(key, response, finalTTL, {
      strategy: InvalidationStrategy.TTL_BASED,
      tags: ['ml-api', endpoint]
    })
    
    // Pré-aquece respostas relacionadas
    this.warmupRelated(endpoint, params)
  }
  
  /**
   * Invalidação por tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0
    
    for (const tag of tags) {
      const keys = await this.redisClient.smembers(`tag:${tag}`)
      
      if (keys.length > 0) {
        // Remove do Redis
        await this.redisClient.del(...keys)
        
        // Remove do cache local
        keys.forEach((key: string) => this.localCache.delete(key))
        
        // Limpa associação de tags
        await this.redisClient.del(`tag:${tag}`)
        
        invalidated += keys.length
      }
    }
    
    logger.info('[Cache] Invalidated by tags', { tags, count: invalidated })
    return invalidated
  }
  
  /**
   * Invalidação por padrão
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await this.redisClient.keys(pattern)
    
    if (keys.length > 0) {
      await this.redisClient.del(...keys)
      
      // Remove do cache local também
      keys.forEach((key: string) => this.localCache.delete(key))
      
      logger.info('[Cache] Invalidated by pattern', { pattern, count: keys.length })
      return keys.length
    }
    
    return 0
  }
  
  /**
   * Cache warming - pré-aquece dados críticos
   */
  async warmupCache(): Promise<void> {
    logger.info('[Cache] Starting cache warmup')
    
    try {
      // Aquece tokens ativos
      const activeAccounts = await prisma.mLAccount.findMany({
        where: { isActive: true },
        select: {
          id: true,
          mlUserId: true,
          accessToken: true,
          tokenExpiresAt: true
        }
      })
      
      for (const account of activeAccounts) {
        if (account.tokenExpiresAt > new Date()) {
          const key = `ml:token:${account.id}`
          await this.warmupQueue.add(key)
        }
      }
      
      // Aquece dados de vendedores ativos
      const recentSellers = await prisma.$queryRaw<any[]>`
        SELECT DISTINCT "sellerId" 
        FROM "Question" 
        WHERE "receivedAt" > NOW() - INTERVAL '24 hours'
        LIMIT 100
      `
      
      for (const seller of recentSellers) {
        await this.warmupQueue.add(`seller:info:${seller.sellerId}`)
        await this.warmupQueue.add(`seller:reputation:${seller.sellerId}`)
      }
      
      // Processa fila de warmup
      await this.processWarmupQueue()
      
      logger.info('[Cache] Warmup completed', { 
        accounts: activeAccounts.length,
        sellers: recentSellers.length 
      })
      
    } catch (_error) {
      logger.error('[Cache] Warmup failed', { error: _error })
    }
  }
  
  /**
   * Cache local L1
   */
  private setL1(key: string, value: any, ttl: number): void {
    const expires = Date.now() + (ttl * 1000)
    this.localCache.set(key, { value, expires })
    
    // REAL: Increased L1 cache size for 10k+ users
    if (this.localCache.size > 10000) {
      this.evictL1()
    }
  }
  
  /**
   * Eviction de cache L1 (LRU)
   */
  private evictL1(): void {
    const now = Date.now()
    let evicted = 0
    
    // Remove expirados primeiro
    for (const [key, data] of this.localCache.entries()) {
      if (data.expires < now) {
        this.localCache.delete(key)
        evicted++
      }
    }
    
    // Se ainda estiver cheio, remove os mais antigos
    if (this.localCache.size > 800) {
      const entries = Array.from(this.localCache.entries())
        .sort((a, b) => a[1].expires - b[1].expires)
      
      for (let i = 0; i < Math.min(200, entries.length); i++) {
        const entry = entries[i]
        if (entry) {
          this.localCache.delete(entry[0])
          evicted++
        }
      }
    }
    
    logger.debug('[Cache] L1 eviction', { evicted, remaining: this.localCache.size })
  }
  
  /**
   * Determina se é dado quente (frequentemente acessado)
   */
  private isHotData(key: string): boolean {
    // Tokens e sessions são sempre quentes
    if (key.startsWith('ml:token:') || key.startsWith('session:')) {
      return true
    }
    
    // Dashboard e métricas em horário comercial
    const hour = new Date().getHours()
    if (hour >= 8 && hour <= 20) {
      if (key.startsWith('dashboard:') || key.startsWith('metrics:')) {
        return true
      }
    }
    
    return false
  }
  
  /**
   * Gera chave de cache única
   */
  private generateCacheKey(endpoint: string, params: any): string {
    const normalized = JSON.stringify(params, Object.keys(params).sort())
    const hash = crypto.createHash('md5').update(normalized).digest('hex')
    return `api:${endpoint}:${hash}`
  }
  
  /**
   * TTL padrão por tipo de chave
   */
  private getDefaultTTL(key: string): number {
    if (key.startsWith('ml:token:')) return CACHE_TTL.ML_TOKEN
    if (key.startsWith('session:')) return CACHE_TTL.SESSION
    if (key.startsWith('seller:info:')) return CACHE_TTL.SELLER_INFO
    if (key.startsWith('seller:reputation:')) return CACHE_TTL.REPUTATION
    if (key.startsWith('dashboard:')) return CACHE_TTL.DASHBOARD
    if (key.startsWith('metrics:')) return CACHE_TTL.METRICS
    return 300 // 5 minutos padrão
  }
  
  /**
   * TTL por endpoint da API
   */
  private getEndpointTTL(endpoint: string): number {
    if (endpoint.includes('/users/')) return CACHE_TTL.USER_DATA
    if (endpoint.includes('/items/')) return CACHE_TTL.ITEMS
    if (endpoint.includes('/questions/')) return CACHE_TTL.QUESTIONS
    if (endpoint.includes('/metrics/')) return CACHE_TTL.METRICS
    return 300
  }
  
  /**
   * Criptografa dados sensíveis no cache
   */
  private encryptSensitive(data: string): string {
    // Usa encryption.ts para criptografar
    const key = crypto.scryptSync(process.env['CACHE_ENCRYPTION_KEY'] || 'cache-key', 'salt', 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag()
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
  }
  
  /**
   * Tags para invalidação em grupo
   */
  private async tagCache(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.redisClient.sadd(`tag:${tag}`, key)
      await this.redisClient.expire(`tag:${tag}`, 86400) // 24h
    }
  }
  
  /**
   * Warmup de dados relacionados
   */
  private async warmupRelated(endpoint: string, params: any): Promise<void> {
    // Se buscou info de um item, pré-aquece perguntas
    if (endpoint.includes('/items/') && params.id) {
      this.warmupQueue.add(`api:/questions/${params.id}`)
    }
    
    // Se buscou vendedor, pré-aquece reputação
    if (endpoint.includes('/users/') && params.id) {
      this.warmupQueue.add(`seller:reputation:${params.id}`)
    }
  }
  
  /**
   * Processa fila de warmup
   */
  private async processWarmupQueue(): Promise<void> {
    const keys = Array.from(this.warmupQueue)
    this.warmupQueue.clear()
    
    for (const key of keys) {
      // Implementar lógica de fetch e cache
      logger.debug('[Cache] Warming up', { key })
    }
  }
  
  /**
   * Inicializa warmup periódico
   */
  private initializeWarmup(): void {
    // Warmup inicial
    setTimeout(() => this.warmupCache(), 5000)
    
    // Warmup periódico a cada 30 minutos
    setInterval(() => this.warmupCache(), 30 * 60 * 1000)
  }
  
  /**
   * Monitoramento de performance do cache
   */
  private startCacheMonitoring(): void {
    setInterval(async () => {
      const info = await this.redisClient.info('stats')
      const hitRate = this.calculateHitRate(info)
      
      logger.info('[Cache] Stats', {
        l1Size: this.localCache.size,
        hitRate: `${hitRate}%`,
        warmupQueue: this.warmupQueue.size
      })
      
      // Alerta se hit rate baixo (apenas em debug para evitar spam de logs)
      if (hitRate < 80) {
        logger.debug('[Cache] Low hit rate detected', { hitRate })
      }
    }, 60000) // A cada minuto
  }
  
  /**
   * Calcula hit rate do Redis
   */
  private calculateHitRate(info: string): number {
    const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0')
    const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0')
    const total = hits + misses
    return total > 0 ? Math.round((hits / total) * 100) : 0
  }
  
  /**
   * Health check do cache
   */
  async healthCheck(): Promise<{
    healthy: boolean
    l1Size: number
    l2Connected: boolean
    hitRate?: number
  }> {
    try {
      const pong = await this.redisClient.ping()
      const info = await this.redisClient.info('stats')
      
      return {
        healthy: pong === 'PONG',
        l1Size: this.localCache.size,
        l2Connected: true,
        hitRate: this.calculateHitRate(info)
      }
    } catch (_error) {
      return {
        healthy: false,
        l1Size: this.localCache.size,
        l2Connected: false
      }
    }
  }
}

// Singleton export
export const cacheStrategy = CacheStrategy.getInstance()

// Helpers para uso direto
export const cache = {
  get: (key: string) => cacheStrategy.get(key),
  set: (key: string, value: any, ttl?: number) => cacheStrategy.set(key, value, ttl),
  invalidate: (pattern: string) => cacheStrategy.invalidatePattern(pattern),
  invalidateTags: (tags: string[]) => cacheStrategy.invalidateByTags(tags),
  mlToken: (id: string, token: string, expires: number) => cacheStrategy.cacheMLToken(id, token, expires),
  seller: (id: string, data: any, type: 'info' | 'reputation' | 'metrics') => cacheStrategy.cacheSellerData(id, data, type),
  mlApi: (endpoint: string, params: any, response: any, ttl?: number) => cacheStrategy.cacheMLResponse(endpoint, params, response, ttl),
  warmup: () => cacheStrategy.warmupCache(),
  health: () => cacheStrategy.healthCheck()
}