/**
 * SLO Manager - Service Level Objectives
 * Define e monitora objetivos de disponibilidade e performance
 * Target: 99.9% uptime para produção
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import * as Sentry from '@sentry/nextjs'

// SLOs definidos para o sistema
export const SLO_TARGETS = {
  // Disponibilidade
  UPTIME: 99.9,                    // 99.9% = 43.2 min downtime/mês
  
  // Latência (P95)
  API_LATENCY_P95: 500,            // 500ms para APIs
  WEBHOOK_LATENCY_P95: 200,        // 200ms para webhooks (ML exige < 500ms)
  DASHBOARD_LATENCY_P95: 1000,     // 1s para dashboard
  
  // Taxa de erro
  ERROR_RATE: 0.1,                 // < 0.1% de erros
  
  // Business metrics
  QUESTION_RESPONSE_TIME: 60,       // 60s para responder perguntas
  TOKEN_REFRESH_SUCCESS: 99.5,      // 99.5% de refresh bem-sucedidos
  CACHE_HIT_RATE: 80,              // 80% de cache hit
  
  // Database
  DB_CONNECTION_SUCCESS: 99.9,      // 99.9% de conexões bem-sucedidas
  QUERY_TIMEOUT_RATE: 0.01,        // < 0.01% de timeouts
} as const

export class SLOManager {
  private static instance: SLOManager
  private metrics: Map<string, number[]> = new Map()
  private alerts: Set<string> = new Set()
  
  private constructor() {
    this.startMonitoring()
  }
  
  static getInstance(): SLOManager {
    if (!SLOManager.instance) {
      SLOManager.instance = new SLOManager()
    }
    return SLOManager.instance
  }
  
  /**
   * Registra métrica de latência
   */
  recordLatency(
    endpoint: string,
    latency: number,
    type: 'api' | 'webhook' | 'dashboard' = 'api'
  ): void {
    const key = `latency:${type}:${endpoint}`
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    
    const values = this.metrics.get(key)!
    values.push(latency)
    
    // Mantém apenas últimas 1000 medições
    if (values.length > 1000) {
      values.shift()
    }
    
    // Verifica SLO
    const p95 = this.calculateP95(values)
    const target = type === 'webhook' ? SLO_TARGETS.WEBHOOK_LATENCY_P95 :
                  type === 'dashboard' ? SLO_TARGETS.DASHBOARD_LATENCY_P95 :
                  SLO_TARGETS.API_LATENCY_P95
    
    if (p95 > target) {
      this.triggerAlert('latency', {
        endpoint,
        type,
        p95,
        target,
        message: `P95 latency ${p95}ms exceeds SLO ${target}ms`
      })
    }
    
    // Envia para Redis para agregação
    redis.zadd(
      `metrics:latency:${type}`,
      Date.now(),
      JSON.stringify({ endpoint, latency, timestamp: Date.now() })
    ).catch(err => logger.error('[SLO] Redis error', { error: err }))
  }
  
  /**
   * Registra erro
   */
  recordError(
    endpoint: string,
    error: any,
    type: 'api' | 'webhook' | 'database' = 'api'
  ): void {
    const key = `errors:${type}:${endpoint}`
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    
    const values = this.metrics.get(key)!
    values.push(1) // Registra erro
    
    // Calcula taxa de erro das últimas 1000 requests
    const errorRate = (values.length / 1000) * 100
    
    if (errorRate > SLO_TARGETS.ERROR_RATE) {
      this.triggerAlert('error_rate', {
        endpoint,
        type,
        errorRate,
        target: SLO_TARGETS.ERROR_RATE,
        message: `Error rate ${errorRate.toFixed(2)}% exceeds SLO ${SLO_TARGETS.ERROR_RATE}%`
      })
    }
    
    // Envia para Sentry
    Sentry.captureException(error, {
      tags: {
        slo_violation: errorRate > SLO_TARGETS.ERROR_RATE,
        endpoint,
        type
      },
      extra: {
        errorRate,
        sloTarget: SLO_TARGETS.ERROR_RATE
      }
    })
  }
  
  /**
   * Registra métrica de negócio
   */
  recordBusinessMetric(
    metric: string,
    value: number,
    metadata?: any
  ): void {
    const key = `business:${metric}`
    
    // Salva no Redis para histórico
    redis.zadd(
      key,
      Date.now(),
      JSON.stringify({ value, metadata, timestamp: Date.now() })
    ).catch(err => logger.error('[SLO] Redis error', { error: err }))
    
    // Verifica SLOs específicos
    switch (metric) {
      case 'question_response_time':
        if (value > SLO_TARGETS.QUESTION_RESPONSE_TIME) {
          this.triggerAlert('business', {
            metric,
            value,
            target: SLO_TARGETS.QUESTION_RESPONSE_TIME,
            message: `Question response time ${value}s exceeds SLO ${SLO_TARGETS.QUESTION_RESPONSE_TIME}s`
          })
        }
        break
        
      case 'token_refresh_success_rate':
        if (value < SLO_TARGETS.TOKEN_REFRESH_SUCCESS) {
          this.triggerAlert('business', {
            metric,
            value,
            target: SLO_TARGETS.TOKEN_REFRESH_SUCCESS,
            message: `Token refresh success ${value}% below SLO ${SLO_TARGETS.TOKEN_REFRESH_SUCCESS}%`
          })
        }
        break
        
      case 'cache_hit_rate':
        if (value < SLO_TARGETS.CACHE_HIT_RATE) {
          logger.warn('[SLO] Cache hit rate below target', {
            value,
            target: SLO_TARGETS.CACHE_HIT_RATE
          })
        }
        break
    }
  }
  
  /**
   * Calcula disponibilidade
   */
  async calculateUptime(): Promise<number> {
    try {
      // Busca health checks das últimas 24h
      const checks = await redis.zrangebyscore(
        'health:checks',
        Date.now() - 24 * 60 * 60 * 1000,
        Date.now()
      )
      
      const total = checks.length
      const successful = checks.filter(c => {
        const data = JSON.parse(c)
        return data.healthy
      }).length
      
      const uptime = total > 0 ? (successful / total) * 100 : 100
      
      if (uptime < SLO_TARGETS.UPTIME) {
        this.triggerAlert('uptime', {
          uptime,
          target: SLO_TARGETS.UPTIME,
          message: `Uptime ${uptime.toFixed(2)}% below SLO ${SLO_TARGETS.UPTIME}%`
        })
      }
      
      return uptime
    } catch (_error) {
      logger.error('[SLO] Failed to calculate uptime', { error: _error })
      return 0
    }
  }
  
  /**
   * Dispara alerta
   */
  private triggerAlert(type: string, data: any): void {
    const alertKey = `${type}:${JSON.stringify(data)}`
    
    // Evita alertas duplicados em 5 minutos
    if (this.alerts.has(alertKey)) {
      return
    }
    
    this.alerts.add(alertKey)
    setTimeout(() => this.alerts.delete(alertKey), 5 * 60 * 1000)
    
    // Log crítico
    logger.error(`[SLO VIOLATION] ${type}`, data)
    
    // Sentry alert
    Sentry.captureMessage(`SLO Violation: ${type}`, {
      level: 'error',
      tags: {
        slo_type: type,
        ...data
      }
    })
    
    // Salva violação no banco
    this.recordViolation(type, data).catch(err => 
      logger.error('[SLO] Failed to record violation', { error: err })
    )
    
    // TODO: Integrar com PagerDuty/Slack para alertas em produção
  }
  
  /**
   * Registra violação de SLO no banco
   */
  private async recordViolation(type: string, data: any): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO "SLOViolation" (type, data, "createdAt")
        VALUES (${type}, ${JSON.stringify(data)}, ${new Date()})
      `
    } catch {
      // Tabela pode não existir ainda
    }
  }
  
  /**
   * Calcula percentil 95
   */
  private calculateP95(values: number[]): number {
    if (values.length === 0) return 0
    
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil(0.95 * sorted.length) - 1
    return sorted[index] ?? 0
  }
  
  /**
   * Inicia monitoramento contínuo
   */
  private startMonitoring(): void {
    // Calcula uptime a cada minuto
    setInterval(async () => {
      const uptime = await this.calculateUptime()
      logger.info('[SLO] Current uptime', { uptime: `${uptime.toFixed(2)}%` })
    }, 60 * 1000)
    
    // Limpa métricas antigas a cada hora
    setInterval(() => {
      for (const [key, values] of this.metrics.entries()) {
        if (values.length > 10000) {
          // Mantém apenas últimas 10k medições
          this.metrics.set(key, values.slice(-10000))
        }
      }
    }, 60 * 60 * 1000)
    
    logger.info('[SLO] Monitoring started', { targets: SLO_TARGETS })
  }
  
  /**
   * Dashboard de SLOs
   */
  async getSLODashboard(): Promise<{
    uptime: number
    latency: { api: number; webhook: number; dashboard: number }
    errorRate: number
    businessMetrics: any
    violations: number
  }> {
    const uptime = await this.calculateUptime()
    
    // Calcula P95 de latências
    const apiLatencies = this.metrics.get('latency:api:*') || []
    const webhookLatencies = this.metrics.get('latency:webhook:*') || []
    const dashboardLatencies = this.metrics.get('latency:dashboard:*') || []
    
    return {
      uptime,
      latency: {
        api: this.calculateP95(apiLatencies),
        webhook: this.calculateP95(webhookLatencies),
        dashboard: this.calculateP95(dashboardLatencies)
      },
      errorRate: 0, // TODO: Calcular taxa de erro real
      businessMetrics: {
        questionResponseTime: 0,
        tokenRefreshSuccess: 0,
        cacheHitRate: 0
      },
      violations: this.alerts.size
    }
  }
}

// Singleton export
export const sloManager = SLOManager.getInstance()

// Helpers para uso direto
export const SLO = {
  recordLatency: (endpoint: string, latency: number, type?: 'api' | 'webhook' | 'dashboard') => 
    sloManager.recordLatency(endpoint, latency, type),
  recordError: (endpoint: string, error: any, type?: 'api' | 'webhook' | 'database') =>
    sloManager.recordError(endpoint, error, type),
  recordBusinessMetric: (metric: string, value: number, metadata?: any) =>
    sloManager.recordBusinessMetric(metric, value, metadata),
  dashboard: () => sloManager.getSLODashboard()
}