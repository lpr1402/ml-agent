/**
 * ML Agent Service Manager - Multi-tenant Instance Management
 * Mantém instâncias isoladas do MLAgentService por organização
 *
 * ARQUITETURA:
 * - 1 Gemini API Key compartilhada (rate limit agregado)
 * - N instâncias MLAgentService (1 por org)
 * - Isolamento completo de memória, contexto e configurações
 *
 * @author ML Agent Team
 * @date 2025-11-21
 */

import { logger } from '@/lib/logger'
import { MLAgentService, createMLAgentService } from './ml-agent-service'
import type { AgentConfig } from '../types/agent-types'

/**
 * Configuração específica por organização
 */
export interface OrganizationAgentConfig {
  organizationId: string

  // Customizações opcionais por org
  temperature?: number
  maxOutputTokens?: number
  thinkingLevel?: 'low' | 'high' | 'default'
  autoApprove?: boolean
  confidenceThresholdAuto?: number

  // Feature flags
  enableStreaming?: boolean
  enableLearning?: boolean

  // Metadata
  createdAt: Date
  lastUsedAt: Date
}

/**
 * Manager singleton que gerencia instâncias por organização
 */
export class MLAgentServiceManager {
  private static instance: MLAgentServiceManager | null = null

  // Cache de instâncias por organizationId
  private instances: Map<string, MLAgentService> = new Map()

  // Configurações por org
  private orgConfigs: Map<string, OrganizationAgentConfig> = new Map()

  // Base config (compartilhado entre todas orgs)
  private baseConfig: AgentConfig

  // Stats para monitoring
  private stats = {
    totalOrgs: 0,
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
  }

  private constructor() {
    // Base config (compartilhado)
    this.baseConfig = {
      geminiApiKey: process.env['GEMINI_API_KEY'] || '',
      model: process.env['GEMINI_MODEL'] || 'gemini-3-pro-preview-11-2025',
      temperature: 1.0, // ⚠️ CRÍTICO: Gemini 3 requer 1.0
      maxOutputTokens: parseInt(process.env['GEMINI_MAX_OUTPUT_TOKENS'] || '8192'),
      thinkingLevel: 'high', // ✅ High para reasoning complexo
      mediaResolution: 'media_resolution_high',

      autoApprove: process.env['AGENT_AUTO_APPROVE'] === 'true',
      confidenceThresholdAuto: parseFloat(process.env['AGENT_CONFIDENCE_THRESHOLD_AUTO'] || '0.95'),
      confidenceThresholdReview: parseFloat(process.env['AGENT_CONFIDENCE_THRESHOLD_REVIEW'] || '0.60'),
      maxRetries: parseInt(process.env['AGENT_MAX_RETRIES'] || '3'),

      enableStreaming: true, // ✅ Sempre ativo para UX
      enableLearning: true, // ✅ Sempre ativo para melhoria contínua

      langsmithApiKey: process.env['LANGSMITH_API_KEY'] || '',
      langsmithProject: process.env['LANGSMITH_PROJECT'] || 'ml-agent-production',
    }

    logger.info('[MLAgentServiceManager] Manager initialized', {
      model: this.baseConfig.model,
      temperature: this.baseConfig.temperature,
      thinkingLevel: this.baseConfig.thinkingLevel,
    })
  }

  /**
   * Retorna singleton instance
   */
  public static getInstance(): MLAgentServiceManager {
    if (!MLAgentServiceManager.instance) {
      MLAgentServiceManager.instance = new MLAgentServiceManager()
    }
    return MLAgentServiceManager.instance
  }

  /**
   * Obtém ou cria instância para uma organização
   */
  public getServiceForOrganization(organizationId: string): MLAgentService {
    this.stats.totalRequests++

    // Cache hit
    if (this.instances.has(organizationId)) {
      this.stats.cacheHits++

      // Atualizar lastUsedAt
      const orgConfig = this.orgConfigs.get(organizationId)
      if (orgConfig) {
        orgConfig.lastUsedAt = new Date()
      }

      logger.debug('[MLAgentServiceManager] Cache hit', {
        organizationId,
        cacheHitRate: (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(2) + '%',
      })

      return this.instances.get(organizationId)!
    }

    // Cache miss - criar nova instância
    this.stats.cacheMisses++
    logger.info('[MLAgentServiceManager] Creating new instance', {
      organizationId,
      totalOrgs: this.instances.size + 1,
    })

    // Buscar config customizado (se existir)
    const orgConfig = this.orgConfigs.get(organizationId)

    // Merge base config com org config
    const config: AgentConfig = {
      ...this.baseConfig,
      temperature: orgConfig?.temperature ?? this.baseConfig.temperature,
      maxOutputTokens: orgConfig?.maxOutputTokens ?? this.baseConfig.maxOutputTokens,
      thinkingLevel: orgConfig?.thinkingLevel ?? this.baseConfig.thinkingLevel,
      autoApprove: orgConfig?.autoApprove ?? this.baseConfig.autoApprove,
      confidenceThresholdAuto: orgConfig?.confidenceThresholdAuto ?? this.baseConfig.confidenceThresholdAuto,
      enableStreaming: orgConfig?.enableStreaming ?? this.baseConfig.enableStreaming,
      enableLearning: orgConfig?.enableLearning ?? this.baseConfig.enableLearning,
    }

    // Criar instância
    const service = createMLAgentService(config)

    // Cachear
    this.instances.set(organizationId, service)
    this.stats.totalOrgs = this.instances.size

    // Salvar config se não existir
    if (!orgConfig) {
      this.orgConfigs.set(organizationId, {
        organizationId,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      })
    }

    logger.info('[MLAgentServiceManager] Instance created and cached', {
      organizationId,
      totalInstances: this.instances.size,
      config: {
        temperature: config.temperature,
        thinkingLevel: config.thinkingLevel,
        enableStreaming: config.enableStreaming,
      },
    })

    return service
  }

  /**
   * Atualiza configuração de uma organização
   */
  public updateOrganizationConfig(
    organizationId: string,
    config: Partial<OrganizationAgentConfig>
  ): void {
    logger.info('[MLAgentServiceManager] Updating org config', {
      organizationId,
      changes: Object.keys(config),
    })

    // Atualizar config
    const existingConfig = this.orgConfigs.get(organizationId)
    this.orgConfigs.set(organizationId, {
      organizationId,
      createdAt: existingConfig?.createdAt || new Date(),
      lastUsedAt: new Date(),
      ...config,
    })

    // Invalidar cache (forçar recriação na próxima chamada)
    if (this.instances.has(organizationId)) {
      this.instances.delete(organizationId)
      logger.info('[MLAgentServiceManager] Instance invalidated, will recreate on next use', {
        organizationId,
      })
    }
  }

  /**
   * Remove instância de uma organização (cleanup)
   */
  public removeOrganization(organizationId: string): void {
    if (this.instances.has(organizationId)) {
      this.instances.delete(organizationId)
      this.orgConfigs.delete(organizationId)
      this.stats.totalOrgs = this.instances.size

      logger.info('[MLAgentServiceManager] Organization removed', {
        organizationId,
        remainingOrgs: this.instances.size,
      })
    }
  }

  /**
   * Cleanup de instâncias não usadas recentemente
   */
  public async cleanupStaleInstances(maxAgeMinutes: number = 60): Promise<number> {
    const now = Date.now()
    const maxAgeMs = maxAgeMinutes * 60 * 1000
    let removed = 0

    for (const [orgId, config] of this.orgConfigs.entries()) {
      const age = now - config.lastUsedAt.getTime()

      if (age > maxAgeMs) {
        this.removeOrganization(orgId)
        removed++
      }
    }

    if (removed > 0) {
      logger.info('[MLAgentServiceManager] Cleanup completed', {
        removed,
        remaining: this.instances.size,
        maxAgeMinutes,
      })
    }

    return removed
  }

  /**
   * Retorna estatísticas do manager
   */
  public getStats() {
    return {
      ...this.stats,
      activeInstances: this.instances.size,
      cacheHitRate: this.stats.totalRequests > 0
        ? (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%',
    }
  }

  /**
   * Lista todas as organizações ativas
   */
  public listActiveOrganizations(): Array<{
    organizationId: string
    createdAt: Date
    lastUsedAt: Date
    hasCachedInstance: boolean
  }> {
    return Array.from(this.orgConfigs.entries()).map(([orgId, config]) => ({
      organizationId: orgId,
      createdAt: config.createdAt,
      lastUsedAt: config.lastUsedAt,
      hasCachedInstance: this.instances.has(orgId),
    }))
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    healthy: boolean
    activeOrganizations: number
    totalRequests: number
    cacheHitRate: string
  }> {
    return {
      healthy: this.instances.size >= 0, // Sempre healthy se inicializado
      activeOrganizations: this.instances.size,
      totalRequests: this.stats.totalRequests,
      cacheHitRate: this.getStats().cacheHitRate,
    }
  }
}

/**
 * Export singleton getter (convenience)
 */
export function getMLAgentServiceManager(): MLAgentServiceManager {
  return MLAgentServiceManager.getInstance()
}

/**
 * Export convenience function
 */
export function getMLAgentServiceForOrganization(organizationId: string): MLAgentService {
  return getMLAgentServiceManager().getServiceForOrganization(organizationId)
}
