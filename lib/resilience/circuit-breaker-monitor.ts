/**
 * Circuit Breaker Monitoring & Metrics System
 * Sistema centralizado de monitoramento e alertas
 * Production-ready com dashboard em tempo real
 */

import { EventEmitter } from 'events'
import { getAllCircuitBreakerStats, CircuitState } from './circuit-breaker'
import { multiAccountProcessor } from './multi-account-processor'
import { webhookProcessor } from './webhook-processor-protected'
import { logger } from '@/lib/logger'
import { redis } from '@/lib/redis'

// Tipos de alertas
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

// Estrutura de alerta
interface Alert {
  id: string
  timestamp: Date
  severity: AlertSeverity
  component: string
  message: string
  metadata?: any
  acknowledged: boolean
}

// Métricas agregadas
interface SystemMetrics {
  timestamp: Date
  circuitBreakers: {
    total: number
    open: number
    halfOpen: number
    closed: number
    errorRate: number
  }
  accounts: {
    total: number
    healthy: number
    degraded: number
    failed: number
  }
  webhooks: {
    received: number
    processed: number
    duplicates: number
    avgResponseTime: number
    emergencyMode: number
  }
  performance: {
    cpuUsage: number
    memoryUsage: number
    uptime: number
  }
  alerts: {
    active: number
    critical: number
    acknowledged: number
  }
}

/**
 * Monitor Central de Circuit Breakers
 */
export class CircuitBreakerMonitor extends EventEmitter {
  private alerts: Map<string, Alert> = new Map()
  private metricsHistory: SystemMetrics[] = []
  private monitoringInterval?: NodeJS.Timer
  private alertCheckInterval?: NodeJS.Timer
  private readonly maxHistorySize = 1000

  // Thresholds de alerta
  private readonly thresholds = {
    circuitBreakerOpenCount: 2, // Alerta se mais de 2 CBs abertos
    accountFailureRate: 30, // Alerta se mais de 30% das contas falhando
    webhookResponseTime: 500, // Alerta se tempo médio > 500ms
    emergencyModeRate: 10, // Alerta se mais de 10% em modo emergência
    errorRate: 50 // Alerta se taxa de erro > 50%
  }

  constructor() {
    super()
    this.setMaxListeners(50) // Prevent memory leak warnings
    this.startMonitoring()
  }

  /**
   * Iniciar monitoramento
   */
  private startMonitoring(): void {
    // Coletar métricas a cada 10 segundos
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, 10000)

    // Verificar alertas a cada 30 segundos
    this.alertCheckInterval = setInterval(() => {
      this.checkAlerts()
    }, 30000)

    logger.info('[CircuitBreakerMonitor] Monitoring started')
  }

  /**
   * Coletar métricas do sistema
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Métricas dos Circuit Breakers
      const cbStats = getAllCircuitBreakerStats()
      const cbMetrics = {
        total: Object.keys(cbStats).length,
        open: Object.values(cbStats).filter(s => s.state === CircuitState.OPEN).length,
        halfOpen: Object.values(cbStats).filter(s => s.state === CircuitState.HALF_OPEN).length,
        closed: Object.values(cbStats).filter(s => s.state === CircuitState.CLOSED).length,
        errorRate: this.calculateAverageErrorRate(cbStats)
      }

      // Métricas das contas
      const accountStats = multiAccountProcessor.getStatistics()

      // Métricas dos webhooks
      const webhookStats = webhookProcessor.getMetrics()

      // Métricas de performance
      const perfMetrics = this.getPerformanceMetrics()

      // Métricas de alertas
      const alertMetrics = this.getAlertMetrics()

      // Criar snapshot de métricas
      const metrics: SystemMetrics = {
        timestamp: new Date(),
        circuitBreakers: cbMetrics,
        accounts: accountStats,
        webhooks: {
          received: webhookStats.received,
          processed: webhookStats.processed,
          duplicates: webhookStats.duplicates,
          avgResponseTime: webhookStats.avgResponseTime,
          emergencyMode: webhookStats.emergencyMode
        },
        performance: perfMetrics,
        alerts: alertMetrics
      }

      // Adicionar ao histórico
      this.metricsHistory.push(metrics)
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift()
      }

      // Salvar no Redis para persistência
      await this.saveMetricsToRedis(metrics)

      // Emitir evento de métricas
      this.emit('metrics', metrics)

    } catch (error) {
      logger.error('[CircuitBreakerMonitor] Failed to collect metrics', { error })
    }
  }

  /**
   * Verificar condições de alerta
   */
  private checkAlerts(): void {
    const currentMetrics = this.getCurrentMetrics()
    if (!currentMetrics) return

    // Verificar Circuit Breakers abertos
    if (currentMetrics.circuitBreakers.open >= this.thresholds.circuitBreakerOpenCount) {
      this.createAlert(
        AlertSeverity.CRITICAL,
        'circuit-breakers',
        `${currentMetrics.circuitBreakers.open} Circuit Breakers estão OPEN`,
        { openCount: currentMetrics.circuitBreakers.open }
      )
    }

    // Verificar taxa de falha das contas
    const accountFailureRate = currentMetrics.accounts.total > 0
      ? (currentMetrics.accounts.failed / currentMetrics.accounts.total) * 100
      : 0

    if (accountFailureRate > this.thresholds.accountFailureRate) {
      this.createAlert(
        AlertSeverity.WARNING,
        'accounts',
        `${accountFailureRate.toFixed(1)}% das contas estão falhando`,
        {
          failed: currentMetrics.accounts.failed,
          total: currentMetrics.accounts.total
        }
      )
    }

    // Verificar tempo de resposta dos webhooks
    if (currentMetrics.webhooks.avgResponseTime > this.thresholds.webhookResponseTime) {
      this.createAlert(
        AlertSeverity.WARNING,
        'webhooks',
        `Tempo médio de resposta dos webhooks: ${currentMetrics.webhooks.avgResponseTime}ms`,
        { avgResponseTime: currentMetrics.webhooks.avgResponseTime }
      )
    }

    // Verificar modo emergência
    const emergencyRate = currentMetrics.webhooks.received > 0
      ? (currentMetrics.webhooks.emergencyMode / currentMetrics.webhooks.received) * 100
      : 0

    if (emergencyRate > this.thresholds.emergencyModeRate) {
      this.createAlert(
        AlertSeverity.CRITICAL,
        'webhooks',
        `${emergencyRate.toFixed(1)}% dos webhooks em modo emergência`,
        {
          emergencyMode: currentMetrics.webhooks.emergencyMode,
          received: currentMetrics.webhooks.received
        }
      )
    }

    // Verificar taxa de erro geral
    if (currentMetrics.circuitBreakers.errorRate > this.thresholds.errorRate) {
      this.createAlert(
        AlertSeverity.EMERGENCY,
        'system',
        `Taxa de erro do sistema: ${currentMetrics.circuitBreakers.errorRate.toFixed(1)}%`,
        { errorRate: currentMetrics.circuitBreakers.errorRate }
      )
    }
  }

  /**
   * Criar alerta
   */
  private createAlert(
    severity: AlertSeverity,
    component: string,
    message: string,
    metadata?: any
  ): void {
    const alertId = `${component}-${severity}-${Date.now()}`

    // Verificar se já existe alerta similar recente
    for (const [_id, alert] of this.alerts) {
      if (
        alert.component === component &&
        alert.severity === severity &&
        !alert.acknowledged &&
        Date.now() - alert.timestamp.getTime() < 300000 // 5 minutos
      ) {
        // Alerta similar já existe, não criar duplicado
        return
      }
    }

    const alert: Alert = {
      id: alertId,
      timestamp: new Date(),
      severity,
      component,
      message,
      metadata,
      acknowledged: false
    }

    this.alerts.set(alertId, alert)

    // Log baseado na severidade
    switch (severity) {
      case AlertSeverity.EMERGENCY:
        logger.error(`[EMERGENCY ALERT] ${message}`, metadata)
        break
      case AlertSeverity.CRITICAL:
        logger.error(`[CRITICAL ALERT] ${message}`, metadata)
        break
      case AlertSeverity.WARNING:
        logger.warn(`[WARNING ALERT] ${message}`, metadata)
        break
      default:
        logger.info(`[INFO ALERT] ${message}`, metadata)
    }

    // Emitir evento de alerta
    this.emit('alert', alert)

    // Notificar via webhook/email para alertas críticos
    if (severity === AlertSeverity.CRITICAL || severity === AlertSeverity.EMERGENCY) {
      this.sendCriticalAlert(alert)
    }
  }

  /**
   * Enviar alerta crítico
   */
  private async sendCriticalAlert(alert: Alert): Promise<void> {
    // TODO: Implementar envio de alertas críticos via:
    // - WhatsApp
    // - Email
    // - Slack
    // - Discord

    logger.error('[CircuitBreakerMonitor] Critical alert triggered', {
      alert
    })
  }

  /**
   * Calcular taxa de erro média
   */
  private calculateAverageErrorRate(stats: any): number {
    const rates = Object.values(stats).map((s: any) => s.errorPercentage || 0)
    if (rates.length === 0) return 0
    return rates.reduce((a, b) => a + b, 0) / rates.length
  }

  /**
   * Obter métricas de performance
   */
  private getPerformanceMetrics(): any {
    const usage = process.memoryUsage()
    return {
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      memoryUsage: Math.round(usage.heapUsed / 1024 / 1024), // MB
      uptime: process.uptime()
    }
  }

  /**
   * Obter métricas de alertas
   */
  private getAlertMetrics(): any {
    const activeAlerts = Array.from(this.alerts.values()).filter(a => !a.acknowledged)
    return {
      active: activeAlerts.length,
      critical: activeAlerts.filter(a =>
        a.severity === AlertSeverity.CRITICAL ||
        a.severity === AlertSeverity.EMERGENCY
      ).length,
      acknowledged: this.alerts.size - activeAlerts.length
    }
  }

  /**
   * Obter métricas atuais
   */
  getCurrentMetrics(): SystemMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null
  }

  /**
   * Obter histórico de métricas
   */
  getMetricsHistory(limit = 100): SystemMetrics[] {
    return this.metricsHistory.slice(-limit)
  }

  /**
   * Obter alertas ativos
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.acknowledged)
  }

  /**
   * Reconhecer alerta
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId)
    if (alert) {
      alert.acknowledged = true
      return true
    }
    return false
  }

  /**
   * Salvar métricas no Redis
   */
  private async saveMetricsToRedis(metrics: SystemMetrics): Promise<void> {
    try {
      // Verificar se Redis está disponível e conectado
      if (!redis?.client) {
        // Redis não disponível, mas sistema continua funcionando
        return
      }

      // Verificar se cliente está pronto
      if ((redis.client as any).status !== 'ready') {
        // Redis não está pronto, pular salvamento
        return
      }

      // Salvar última métrica
      await (redis.client as any).setex(
        'circuit:monitor:latest',
        3600,
        JSON.stringify(metrics)
      )

      // Adicionar ao histórico (lista circular)
      await (redis.client as any).lpush(
        'circuit:monitor:history',
        JSON.stringify(metrics)
      )

      // Limitar tamanho do histórico
      await (redis.client as any).ltrim('circuit:monitor:history', 0, 999)

    } catch (error: any) {
      // Sistema continua funcionando mesmo sem Redis
      logger.debug('[CircuitBreakerMonitor] Redis not available for metrics storage', {
        error: error.message
      })
    }
  }

  /**
   * Gerar relatório de saúde
   */
  generateHealthReport(): {
    status: 'healthy' | 'degraded' | 'critical'
    summary: string
    details: any
    recommendations: string[]
  } {
    const metrics = this.getCurrentMetrics()
    const alerts = this.getActiveAlerts()

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy'
    const recommendations: string[] = []

    if (!metrics) {
      // Sistema recém iniciado, ainda sem métricas coletadas - normal em startup
      return {
        status: 'healthy',
        summary: 'System starting up - no metrics collected yet',
        details: { startupMode: true },
        recommendations: []
      }
    }

    // Determinar status
    if (alerts.some(a => a.severity === AlertSeverity.EMERGENCY)) {
      status = 'critical'
    } else if (alerts.some(a => a.severity === AlertSeverity.CRITICAL)) {
      status = 'critical'
    } else if (alerts.length > 0) {
      status = 'degraded'
    }

    // Gerar recomendações
    if (metrics.circuitBreakers.open > 0) {
      recommendations.push('Investigate services causing circuit breakers to open')
    }

    if (metrics.accounts.failed > 0) {
      recommendations.push(`Check ${metrics.accounts.failed} failed accounts`)
    }

    if (metrics.webhooks.avgResponseTime > 300) {
      recommendations.push('Optimize webhook processing to reduce response time')
    }

    const summary = `System is ${status}. ` +
      `${metrics.circuitBreakers.open} CBs open, ` +
      `${metrics.accounts.failed} accounts failed, ` +
      `${alerts.length} active alerts`

    return {
      status,
      summary,
      details: {
        metrics,
        alerts: alerts.map(a => ({
          severity: a.severity,
          message: a.message,
          timestamp: a.timestamp
        }))
      },
      recommendations
    }
  }

  /**
   * Destruir monitor
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval as any)
    }
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval as any)
    }
    this.removeAllListeners()
  }
}

// Singleton instance
export const circuitBreakerMonitor = new CircuitBreakerMonitor()

// API endpoints helpers
export const monitoringAPI = {
  /**
   * Obter dashboard data
   */
  getDashboardData() {
    return {
      currentMetrics: circuitBreakerMonitor.getCurrentMetrics(),
      history: circuitBreakerMonitor.getMetricsHistory(50),
      alerts: circuitBreakerMonitor.getActiveAlerts(),
      health: circuitBreakerMonitor.generateHealthReport()
    }
  },

  /**
   * Obter status resumido
   */
  getStatus() {
    const report = circuitBreakerMonitor.generateHealthReport()
    return {
      status: report.status,
      message: report.summary
    }
  }
}

// Auto-cleanup
process.on('SIGTERM', () => {
  circuitBreakerMonitor.destroy()
})

export default circuitBreakerMonitor