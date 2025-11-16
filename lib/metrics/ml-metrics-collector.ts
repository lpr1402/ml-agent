/**
 * ML METRICS COLLECTOR - REAL-TIME MONITORING
 * Outubro 2025 - Sistema de Métricas em Tempo Real
 *
 * ✅ Coleta métricas de todas as chamadas ML API
 * ✅ Monitora sincronização de estoque em tempo real
 * ✅ Dashboard de performance
 * ✅ Alertas automáticos
 * ✅ Exportação de métricas para análise
 *
 * @version 1.0 - Production Ready
 */

import { logger } from '@/lib/logger'
import { globalMLRateLimiter } from '@/lib/ml-api/global-rate-limiter'
import { EventEmitter } from 'events'

// ==================== INTERFACES ====================

interface MLAPIMetrics {
  // Rate Limiter
  rateLimiter: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    queueSize: number
    averageWaitTime: number
    requestsPerMinute: number
    requestsPerHour: number
    lastRequestAt: number | null
    nextAvailableAt: number | null
    requestsByAccount: Map<string, number>
  }

  // System Health
  system: {
    uptime: number
    memoryUsage: NodeJS.MemoryUsage
    timestamp: Date
  }
}

interface MetricsSnapshot {
  timestamp: Date
  metrics: MLAPIMetrics
}

interface Alert {
  id: string
  type: 'warning' | 'error' | 'critical'
  category: 'rate_limit' | 'sync' | 'performance' | 'system'
  message: string
  details: any
  timestamp: Date
  resolved: boolean
}

// ==================== COLLECTOR CLASS ====================

class MLMetricsCollector extends EventEmitter {
  private snapshots: MetricsSnapshot[] = []
  private alerts: Alert[] = []
  private collectionInterval: NodeJS.Timeout | null = null
  private startTime: number = Date.now()

  // Configurações
  private readonly COLLECTION_INTERVAL_MS = 5000 // 5 segundos
  private readonly SNAPSHOT_RETENTION = 1000 // Manter últimos 1000 snapshots
  private readonly ALERT_RETENTION = 500 // Manter últimos 500 alertas

  // Thresholds para alertas
  private readonly THRESHOLDS = {
    queueSizeWarning: 100,
    queueSizeCritical: 500,
    waitTimeWarning: 30000, // 30s
    waitTimeCritical: 60000, // 1min
    failureRateWarning: 0.05, // 5%
    failureRateCritical: 0.15, // 15%
    memoryWarning: 1024 * 1024 * 1024, // 1GB
    memoryCritical: 1536 * 1024 * 1024 // 1.5GB
  }

  // Estado da sincronização

  constructor() {
    super()
    logger.info('[MetricsCollector] 🚀 Initialized')
    this.setupListeners()
  }

  /**
   * Setup event listeners
   */
  private setupListeners() {
    // Rate Limiter events
    globalMLRateLimiter.on('request:queued', (data) => {
      this.emit('metric:request:queued', data)
    })

    globalMLRateLimiter.on('request:success', (data) => {
      this.emit('metric:request:success', data)
    })

    globalMLRateLimiter.on('request:failed', (data) => {
      this.emit('metric:request:failed', data)
      this.createAlert('error', 'rate_limit', 'API request failed', data)
    })

    globalMLRateLimiter.on('circuit:open', (data) => {
      this.createAlert('critical', 'rate_limit', 'Circuit breaker opened!', data)
    })

    globalMLRateLimiter.on('circuit:closed', (data) => {
      this.emit('metric:circuit:closed', data)
    })

    logger.info('[MetricsCollector] Event listeners configured')
  }

  /**
   * Iniciar coleta de métricas
   */
  start() {
    if (this.collectionInterval) {
      logger.warn('[MetricsCollector] Already running')
      return
    }

    logger.info('[MetricsCollector] ✅ Starting metrics collection', {
      intervalMs: this.COLLECTION_INTERVAL_MS
    })

    this.collectionInterval = setInterval(() => {
      this.collectMetrics()
    }, this.COLLECTION_INTERVAL_MS)

    // Coletar imediatamente
    this.collectMetrics()
  }

  /**
   * Parar coleta de métricas
   */
  stop() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval)
      this.collectionInterval = null
      logger.info('[MetricsCollector] ⏸️ Stopped')
    }
  }

  /**
   * 🔴 CORE: Coletar métricas atuais
   */
  private collectMetrics() {
    try {
      const rateLimiterMetrics = globalMLRateLimiter.getMetrics()

      const metrics: MLAPIMetrics = {
        rateLimiter: {
          totalRequests: rateLimiterMetrics.totalRequests,
          successfulRequests: rateLimiterMetrics.successfulRequests,
          failedRequests: rateLimiterMetrics.failedRequests,
          queueSize: rateLimiterMetrics.queueSize,
          averageWaitTime: rateLimiterMetrics.averageWaitTime,
          requestsPerMinute: rateLimiterMetrics.requestsPerMinute,
          requestsPerHour: rateLimiterMetrics.requestsPerHour,
          lastRequestAt: rateLimiterMetrics.lastRequestAt,
          nextAvailableAt: rateLimiterMetrics.nextAvailableAt,
          requestsByAccount: rateLimiterMetrics.requestsPerAccount
        },
        system: {
          uptime: Date.now() - this.startTime,
          memoryUsage: process.memoryUsage(),
          timestamp: new Date()
        }
      }

      // Salvar snapshot
      const snapshot: MetricsSnapshot = {
        timestamp: new Date(),
        metrics
      }

      this.snapshots.push(snapshot)

      // Limitar tamanho do histórico
      if (this.snapshots.length > this.SNAPSHOT_RETENTION) {
        this.snapshots.shift()
      }

      // Verificar thresholds e criar alertas
      this.checkThresholds(metrics)

      // Emitir evento
      this.emit('metrics:collected', metrics)

    } catch (error: any) {
      logger.error('[MetricsCollector] Failed to collect metrics', {
        error: error.message
      })
    }
  }

  /**
   * Verificar thresholds e criar alertas
   */
  private checkThresholds(_metrics: MLAPIMetrics) {
    const metrics = _metrics
    // Queue size
    if (metrics.rateLimiter.queueSize >= this.THRESHOLDS.queueSizeCritical) {
      this.createAlert('critical', 'rate_limit', 'Queue size critical!', {
        queueSize: metrics.rateLimiter.queueSize,
        threshold: this.THRESHOLDS.queueSizeCritical
      })
    } else if (metrics.rateLimiter.queueSize >= this.THRESHOLDS.queueSizeWarning) {
      this.createAlert('warning', 'rate_limit', 'Queue size high', {
        queueSize: metrics.rateLimiter.queueSize,
        threshold: this.THRESHOLDS.queueSizeWarning
      })
    }

    // Wait time
    if (metrics.rateLimiter.averageWaitTime >= this.THRESHOLDS.waitTimeCritical) {
      this.createAlert('critical', 'performance', 'Average wait time critical!', {
        averageWaitTime: metrics.rateLimiter.averageWaitTime,
        threshold: this.THRESHOLDS.waitTimeCritical
      })
    } else if (metrics.rateLimiter.averageWaitTime >= this.THRESHOLDS.waitTimeWarning) {
      this.createAlert('warning', 'performance', 'Average wait time high', {
        averageWaitTime: metrics.rateLimiter.averageWaitTime,
        threshold: this.THRESHOLDS.waitTimeWarning
      })
    }

    // Failure rate
    if (metrics.rateLimiter.totalRequests > 0) {
      const failureRate = metrics.rateLimiter.failedRequests / metrics.rateLimiter.totalRequests

      if (failureRate >= this.THRESHOLDS.failureRateCritical) {
        this.createAlert('critical', 'rate_limit', 'Failure rate critical!', {
          failureRate: (failureRate * 100).toFixed(2) + '%',
          threshold: (this.THRESHOLDS.failureRateCritical * 100).toFixed(2) + '%'
        })
      } else if (failureRate >= this.THRESHOLDS.failureRateWarning) {
        this.createAlert('warning', 'rate_limit', 'Failure rate elevated', {
          failureRate: (failureRate * 100).toFixed(2) + '%',
          threshold: (this.THRESHOLDS.failureRateWarning * 100).toFixed(2) + '%'
        })
      }
    }

    // Memory usage
    const memoryUsed = metrics.system.memoryUsage.heapUsed

    if (memoryUsed >= this.THRESHOLDS.memoryCritical) {
      this.createAlert('critical', 'system', 'Memory usage critical!', {
        memoryUsed: (memoryUsed / 1024 / 1024).toFixed(2) + ' MB',
        threshold: (this.THRESHOLDS.memoryCritical / 1024 / 1024).toFixed(2) + ' MB'
      })
    } else if (memoryUsed >= this.THRESHOLDS.memoryWarning) {
      this.createAlert('warning', 'system', 'Memory usage high', {
        memoryUsed: (memoryUsed / 1024 / 1024).toFixed(2) + ' MB',
        threshold: (this.THRESHOLDS.memoryWarning / 1024 / 1024).toFixed(2) + ' MB'
      })
    }
  }

  /**
   * Criar alerta
   */
  private createAlert(
    type: Alert['type'],
    category: Alert['category'],
    message: string,
    details: any
  ) {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      category,
      message,
      details,
      timestamp: new Date(),
      resolved: false
    }

    this.alerts.push(alert)

    // Limitar tamanho
    if (this.alerts.length > this.ALERT_RETENTION) {
      this.alerts.shift()
    }

    logger.warn('[MetricsCollector] 🚨 Alert created', {
      type,
      category,
      message,
      details
    })

    this.emit('alert:created', alert)
  }

  /**
   * Calcular success rate da sincronização
   */

  /**
   * Obter métricas atuais
   */
  getCurrentMetrics(): MLAPIMetrics | null {
    if (this.snapshots.length === 0) return null
    return this.snapshots[this.snapshots.length - 1]!.metrics
  }

  /**
   * Obter histórico de métricas
   */
  getMetricsHistory(limit: number = 100): MetricsSnapshot[] {
    return this.snapshots.slice(-limit)
  }

  /**
   * Obter alertas ativos
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved)
  }

  /**
   * Obter todos os alertas
   */
  getAllAlerts(limit: number = 100): Alert[] {
    return this.alerts.slice(-limit)
  }

  /**
   * Resolver alerta
   */
  resolveAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      this.emit('alert:resolved', alert)
    }
  }

  /**
   * Obter dashboard summary
   */
  getDashboard() {
    const current = this.getCurrentMetrics()

    if (!current) {
      return {
        status: 'initializing',
        message: 'Collecting initial metrics...'
      }
    }

    return {
      status: this.getSystemStatus(current),
      rateLimiter: {
        queueSize: current.rateLimiter.queueSize,
        requestsPerMinute: current.rateLimiter.requestsPerMinute,
        requestsPerHour: current.rateLimiter.requestsPerHour,
        averageWaitTime: `${(current.rateLimiter.averageWaitTime / 1000).toFixed(2)}s`,
        successRate: current.rateLimiter.totalRequests > 0
          ? ((current.rateLimiter.successfulRequests / current.rateLimiter.totalRequests) * 100).toFixed(2) + '%'
          : '100%',
        nextAvailableIn: current.rateLimiter.nextAvailableAt
          ? Math.max(0, current.rateLimiter.nextAvailableAt - Date.now()) + 'ms'
          : '0ms'
      },
      system: {
        uptime: `${(current.system.uptime / 1000 / 60).toFixed(2)} minutes`,
        memoryUsage: {
          heapUsed: `${(current.system.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(current.system.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          rss: `${(current.system.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`
        }
      },
      alerts: {
        active: this.getActiveAlerts().length,
        critical: this.getActiveAlerts().filter(a => a.type === 'critical').length,
        warning: this.getActiveAlerts().filter(a => a.type === 'warning').length
      }
    }
  }

  /**
   * Determinar status do sistema
   */
  private getSystemStatus(_metrics: MLAPIMetrics): 'healthy' | 'warning' | 'critical' {
    const activeAlerts = this.getActiveAlerts()

    if (activeAlerts.some(a => a.type === 'critical')) {
      return 'critical'
    }

    if (activeAlerts.some(a => a.type === 'warning' || a.type === 'error')) {
      return 'warning'
    }

    return 'healthy'
  }

  /**
   * Exportar métricas para análise
   */
  exportMetrics(format: 'json' | 'csv' = 'json') {
    if (format === 'json') {
      return {
        snapshots: this.snapshots,
        alerts: this.alerts,
        exportedAt: new Date()
      }
    }

    // CSV format
    const csvLines = [
      'timestamp,totalRequests,successfulRequests,failedRequests,queueSize,averageWaitTime,requestsPerMinute',
      ...this.snapshots.map(s => {
        const m = s.metrics.rateLimiter
        return `${s.timestamp.toISOString()},${m.totalRequests},${m.successfulRequests},${m.failedRequests},${m.queueSize},${m.averageWaitTime},${m.requestsPerMinute}`
      })
    ]

    return csvLines.join('\n')
  }

  /**
   * Reset métricas
   */
  reset() {
    this.snapshots = []
    this.alerts = []
    this.startTime = Date.now()

    logger.info('[MetricsCollector] Metrics reset')
  }

  /**
   * Shutdown
   */
  shutdown() {
    this.stop()
    this.removeAllListeners()
    logger.info('[MetricsCollector] Shutdown complete')
  }
}

// ==================== SINGLETON ====================

export const mlMetricsCollector = new MLMetricsCollector()

// Graceful shutdown
process.on('SIGTERM', () => {
  mlMetricsCollector.shutdown()
})

process.on('SIGINT', () => {
  mlMetricsCollector.shutdown()
})

// ==================== EXPORTS ====================

export default mlMetricsCollector
export type { MLAPIMetrics, MetricsSnapshot, Alert }
