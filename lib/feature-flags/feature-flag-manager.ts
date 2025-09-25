/**
 * Feature Flag Manager - Controle de funcionalidades em produção
 * Permite rollout gradual e rollback instantâneo
 * Production-ready Setembro 2025
 */

import { logger } from '@/lib/logger'
import { redis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache/cache-strategy'

/**
 * Definição de todas as feature flags do sistema
 */
export const FEATURE_FLAGS = {
  // Security
  RLS_ENABLED: 'rls_enabled',
  WEBHOOK_SIGNATURE_VALIDATION: 'webhook_signature_validation',
  KEY_ROTATION_ENABLED: 'key_rotation_enabled',
  
  // Performance
  CACHE_STRATEGY_V2: 'cache_strategy_v2',
  QUERY_OPTIMIZER_ENABLED: 'query_optimizer_enabled',
  CONNECTION_POOLING_V2: 'connection_pooling_v2',
  
  // ML API
  ML_API_V4_FORCED: 'ml_api_v4_forced',
  CIRCUIT_BREAKER_ENABLED: 'circuit_breaker_enabled',
  SMART_RATE_LIMITING: 'smart_rate_limiting',
  
  // Features
  MULTI_ACCOUNT_ENABLED: 'multi_account_enabled',
  AI_AGENT_V2: 'ai_agent_v2',
  WHATSAPP_INTEGRATION: 'whatsapp_integration',
  
  // Monitoring
  SLO_MONITORING: 'slo_monitoring',
  ADVANCED_METRICS: 'advanced_metrics',
  REAL_TIME_ALERTS: 'real_time_alerts',
  
  // Experimental
  BETA_FEATURES: 'beta_features',
  A_B_TESTING: 'a_b_testing',
  CANARY_DEPLOYMENT: 'canary_deployment'
} as const

export type FeatureFlagKey = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS]

/**
 * Configuração de uma feature flag
 */
interface FeatureFlagConfig {
  key: FeatureFlagKey
  enabled: boolean
  description: string
  rolloutPercentage?: number // 0-100 para rollout gradual
  enabledForOrgs?: string[] // Lista de organizações específicas
  enabledForUsers?: string[] // Lista de usuários específicos
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  expiresAt?: Date // Para flags temporárias
}

/**
 * Gerenciador de Feature Flags
 */
export class FeatureFlagManager {
  private static instance: FeatureFlagManager
  private flags: Map<FeatureFlagKey, FeatureFlagConfig> = new Map()
  private initialized = false
  
  private constructor() {}
  
  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager()
    }
    return FeatureFlagManager.instance
  }
  
  /**
   * Inicializa feature flags do banco/Redis
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    
    try {
      // Carrega configuração padrão
      await this.loadDefaultFlags()
      
      // Carrega overrides do banco
      await this.loadFlagsFromDatabase()
      
      // Sincroniza com Redis para acesso rápido
      await this.syncWithRedis()
      
      // Inicia monitoramento de mudanças
      this.startFlagMonitoring()
      
      this.initialized = true
      logger.info('[FeatureFlags] Manager initialized', {
        totalFlags: this.flags.size
      })
      
    } catch (_error) {
      logger.error('[FeatureFlags] Initialization failed', { error: _error })
      // Usa configuração segura em caso de falha
      this.loadSafeDefaults()
    }
  }
  
  /**
   * Verifica se uma feature está habilitada
   */
  async isEnabled(
    key: FeatureFlagKey,
    context?: {
      organizationId?: string
      userId?: string
      percentage?: number
    }
  ): Promise<boolean> {
    try {
      // Busca flag do cache primeiro
      const cacheKey = `flag:${key}`
      const cached = await cache.get(cacheKey)
      if (cached !== null) {
        return this.evaluateFlag(cached as boolean, context)
      }
      
      // Busca da memória local
      const flag = this.flags.get(key)
      if (!flag) {
        logger.warn(`[FeatureFlags] Unknown flag: ${key}`)
        return false
      }
      
      // Verifica expiração
      if (flag.expiresAt && flag.expiresAt < new Date()) {
        return false
      }
      
      // Verifica se está globalmente desabilitada
      if (!flag.enabled) {
        return false
      }
      
      // Verifica organizações específicas
      if (flag.enabledForOrgs && context?.organizationId) {
        if (!flag.enabledForOrgs.includes(context.organizationId)) {
          return false
        }
      }
      
      // Verifica usuários específicos
      if (flag.enabledForUsers && context?.userId) {
        if (!flag.enabledForUsers.includes(context.userId)) {
          return false
        }
      }
      
      // Verifica rollout percentual
      if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
        const hash = this.hashContext(context)
        const threshold = flag.rolloutPercentage
        return (hash % 100) < threshold
      }
      
      // Cache resultado
      await cache.set(cacheKey, flag.enabled, 60) // 1 minuto
      
      return flag.enabled
      
    } catch (_error) {
      logger.error(`[FeatureFlags] Error checking flag ${key}`, { error: _error })
      // Retorna configuração segura em caso de erro
      return this.getSafeDefault(key)
    }
  }
  
  /**
   * Habilita uma feature flag
   */
  async enable(
    key: FeatureFlagKey,
    options?: {
      rolloutPercentage?: number
      organizations?: string[]
      users?: string[]
      expires?: Date
    }
  ): Promise<void> {
    const flag = this.flags.get(key) || this.createDefaultFlag(key)
    
    flag.enabled = true
    if (options?.rolloutPercentage !== undefined) {
      flag.rolloutPercentage = options.rolloutPercentage
    }
    if (options?.organizations !== undefined) {
      flag.enabledForOrgs = options.organizations
    }
    if (options?.users !== undefined) {
      flag.enabledForUsers = options.users
    }
    if (options?.expires !== undefined) {
      flag.expiresAt = options.expires
    }
    flag.updatedAt = new Date()
    
    this.flags.set(key, flag)
    
    // Persiste no banco
    await this.persistFlag(flag)
    
    // Invalida cache
    await cache.invalidate(`flag:${key}`)
    
    logger.info(`[FeatureFlags] Enabled flag: ${key}`, {
      rollout: options?.rolloutPercentage,
      orgs: options?.organizations?.length,
      users: options?.users?.length
    })
  }
  
  /**
   * Desabilita uma feature flag
   */
  async disable(key: FeatureFlagKey): Promise<void> {
    const flag = this.flags.get(key)
    if (!flag) return
    
    flag.enabled = false
    flag.updatedAt = new Date()
    
    this.flags.set(key, flag)
    
    // Persiste no banco
    await this.persistFlag(flag)
    
    // Invalida cache
    await cache.invalidate(`flag:${key}`)
    
    logger.info(`[FeatureFlags] Disabled flag: ${key}`)
  }
  
  /**
   * Configuração padrão das flags
   */
  private async loadDefaultFlags(): Promise<void> {
    const defaults: Record<FeatureFlagKey, Partial<FeatureFlagConfig>> = {
      // Security - SEMPRE habilitado em produção
      [FEATURE_FLAGS.RLS_ENABLED]: {
        enabled: true,
        description: 'Row-Level Security for multi-tenant isolation'
      },
      [FEATURE_FLAGS.WEBHOOK_SIGNATURE_VALIDATION]: {
        enabled: true,
        description: 'Validate webhook signatures from ML'
      },
      [FEATURE_FLAGS.KEY_ROTATION_ENABLED]: {
        enabled: true,
        description: 'Automatic encryption key rotation'
      },
      
      // Performance - habilitado por padrão
      [FEATURE_FLAGS.CACHE_STRATEGY_V2]: {
        enabled: true,
        description: 'Multi-layer caching strategy'
      },
      [FEATURE_FLAGS.QUERY_OPTIMIZER_ENABLED]: {
        enabled: true,
        description: 'Database query optimization'
      },
      [FEATURE_FLAGS.CONNECTION_POOLING_V2]: {
        enabled: true,
        description: 'Optimized connection pooling'
      },
      
      // ML API - habilitado
      [FEATURE_FLAGS.ML_API_V4_FORCED]: {
        enabled: true,
        description: 'Force API version 4 for all ML calls'
      },
      [FEATURE_FLAGS.CIRCUIT_BREAKER_ENABLED]: {
        enabled: true,
        description: 'Circuit breaker protection for ML API'
      },
      [FEATURE_FLAGS.SMART_RATE_LIMITING]: {
        enabled: true,
        description: 'Intelligent rate limiting with backoff'
      },
      
      // Features - rollout gradual
      [FEATURE_FLAGS.MULTI_ACCOUNT_ENABLED]: {
        enabled: true,
        rolloutPercentage: 100,
        description: 'Multiple ML accounts per organization'
      },
      [FEATURE_FLAGS.AI_AGENT_V2]: {
        enabled: true,
        rolloutPercentage: 80,
        description: 'New AI agent with improved responses'
      },
      [FEATURE_FLAGS.WHATSAPP_INTEGRATION]: {
        enabled: false,
        rolloutPercentage: 0,
        description: 'WhatsApp notification integration'
      },
      
      // Monitoring
      [FEATURE_FLAGS.SLO_MONITORING]: {
        enabled: true,
        description: 'Service Level Objective monitoring'
      },
      [FEATURE_FLAGS.ADVANCED_METRICS]: {
        enabled: true,
        description: 'Advanced business metrics'
      },
      [FEATURE_FLAGS.REAL_TIME_ALERTS]: {
        enabled: true,
        description: 'Real-time alert system'
      },
      
      // Experimental
      [FEATURE_FLAGS.BETA_FEATURES]: {
        enabled: false,
        description: 'Beta features for testing'
      },
      [FEATURE_FLAGS.A_B_TESTING]: {
        enabled: false,
        description: 'A/B testing framework'
      },
      [FEATURE_FLAGS.CANARY_DEPLOYMENT]: {
        enabled: false,
        description: 'Canary deployment support'
      }
    }
    
    for (const [key, config] of Object.entries(defaults)) {
      const flag: FeatureFlagConfig = {
        key: key as FeatureFlagKey,
        enabled: config.enabled ?? false,
        description: config.description ?? '',
        ...(config.rolloutPercentage !== undefined && { rolloutPercentage: config.rolloutPercentage }),
        ...(config.enabledForOrgs !== undefined && { enabledForOrgs: config.enabledForOrgs }),
        ...(config.enabledForUsers !== undefined && { enabledForUsers: config.enabledForUsers }),
        ...(config.metadata !== undefined && { metadata: config.metadata }),
        ...(config.expiresAt !== undefined && { expiresAt: config.expiresAt }),
        createdAt: new Date(),
        updatedAt: new Date()
      }
      this.flags.set(key as FeatureFlagKey, flag)
    }
  }
  
  /**
   * Carrega flags do banco de dados
   */
  private async loadFlagsFromDatabase(): Promise<void> {
    try {
      const dbFlags = await prisma.$queryRaw<any[]>`
        SELECT * FROM "FeatureFlag" WHERE "active" = true
      `.catch(() => []) // Tabela pode não existir
      
      for (const dbFlag of dbFlags) {
        const flag: FeatureFlagConfig = {
          key: dbFlag.key,
          enabled: dbFlag.enabled,
          description: dbFlag.description,
          rolloutPercentage: dbFlag.rolloutPercentage,
          enabledForOrgs: dbFlag.enabledForOrgs,
          enabledForUsers: dbFlag.enabledForUsers,
          metadata: dbFlag.metadata,
          createdAt: dbFlag.createdAt,
          updatedAt: dbFlag.updatedAt,
          expiresAt: dbFlag.expiresAt
        }
        this.flags.set(dbFlag.key, flag)
      }
    } catch (_error) {
      logger.warn('[FeatureFlags] Could not load from database', { error: _error })
    }
  }
  
  /**
   * Sincroniza com Redis
   */
  private async syncWithRedis(): Promise<void> {
    for (const [key, flag] of this.flags) {
      await redis.setex(
        `feature:${key}`,
        3600, // 1 hora
        JSON.stringify(flag)
      ).catch(err => logger.error('[FeatureFlags] Redis sync error', { error: err }))
    }
  }
  
  /**
   * Persiste flag no banco
   */
  private async persistFlag(flag: FeatureFlagConfig): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO "FeatureFlag" (
          key, enabled, description, "rolloutPercentage",
          "enabledForOrgs", "enabledForUsers", metadata,
          "createdAt", "updatedAt", "expiresAt", active
        ) VALUES (
          ${flag.key}, ${flag.enabled}, ${flag.description},
          ${flag.rolloutPercentage}, ${flag.enabledForOrgs},
          ${flag.enabledForUsers}, ${flag.metadata},
          ${flag.createdAt}, ${flag.updatedAt}, ${flag.expiresAt}, true
        )
        ON CONFLICT (key) DO UPDATE SET
          enabled = ${flag.enabled},
          "rolloutPercentage" = ${flag.rolloutPercentage},
          "updatedAt" = ${flag.updatedAt}
      `
    } catch (_error) {
      logger.error('[FeatureFlags] Failed to persist flag', { error: _error })
    }
  }
  
  /**
   * Hash para rollout percentual determinístico
   */
  private hashContext(context?: any): number {
    const str = JSON.stringify(context || {})
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
  
  /**
   * Avalia flag com contexto
   */
  private evaluateFlag(enabled: boolean, _context?: any): boolean {
    if (!enabled) return false
    // Adicionar lógica adicional de avaliação se necessário
    return enabled
  }
  
  /**
   * Configuração segura em caso de falha
   */
  private loadSafeDefaults(): void {
    // Em caso de falha, habilita apenas features essenciais
    const safeFlags = [
      FEATURE_FLAGS.RLS_ENABLED,
      FEATURE_FLAGS.WEBHOOK_SIGNATURE_VALIDATION,
      FEATURE_FLAGS.KEY_ROTATION_ENABLED,
      FEATURE_FLAGS.CIRCUIT_BREAKER_ENABLED
    ]
    
    for (const key of Object.values(FEATURE_FLAGS)) {
      const flag = this.createDefaultFlag(key)
      flag.enabled = safeFlags.includes(key as any)
      this.flags.set(key, flag)
    }
  }
  
  /**
   * Retorna configuração segura para flag
   */
  private getSafeDefault(key: FeatureFlagKey): boolean {
    const criticalFlags = [
      FEATURE_FLAGS.RLS_ENABLED,
      FEATURE_FLAGS.WEBHOOK_SIGNATURE_VALIDATION,
      FEATURE_FLAGS.CIRCUIT_BREAKER_ENABLED
    ]
    return criticalFlags.includes(key as any)
  }
  
  /**
   * Cria flag padrão
   */
  private createDefaultFlag(key: FeatureFlagKey): FeatureFlagConfig {
    return {
      key,
      enabled: false,
      description: `Feature flag: ${key}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
  
  /**
   * Monitora mudanças em tempo real
   */
  private startFlagMonitoring(): void {
    // Poll para mudanças a cada 30 segundos
    setInterval(async () => {
      await this.loadFlagsFromDatabase()
    }, 30000)
  }
  
  /**
   * Status de todas as flags
   */
  getStatus(): Record<string, any> {
    const status: Record<string, any> = {}
    
    for (const [key, flag] of this.flags) {
      status[key] = {
        enabled: flag.enabled,
        rollout: flag.rolloutPercentage,
        expires: flag.expiresAt
      }
    }
    
    return status
  }
}

// Singleton export
export const featureFlagManager = FeatureFlagManager.getInstance()

// Helpers para uso direto
export const FeatureFlag = {
  isEnabled: async (key: FeatureFlagKey, context?: any) => 
    featureFlagManager.isEnabled(key, context),
  enable: async (key: FeatureFlagKey, options?: any) =>
    featureFlagManager.enable(key, options),
  disable: async (key: FeatureFlagKey) =>
    featureFlagManager.disable(key),
  status: () => featureFlagManager.getStatus()
}

// Inicialização automática
if (typeof window === 'undefined') {
  featureFlagManager.initialize().catch(err => {
    logger.error('[FeatureFlags] Auto-init failed', { error: err })
  })
}