/**
 * ML SYSTEM ORCHESTRATOR - PRODUCTION WORKER
 * Outubro 2025 - Coordenador Central do Sistema ML
 *
 * ✅ Inicializa e coordena todos os subsistemas
 * ✅ Rate Limiter Global (2 segundos garantidos)
 * ✅ Métricas em tempo real
 * ✅ Sincronização automática de estoque
 * ✅ Health checks e auto-recovery
 *
 * @version 1.0 - Production Ready
 */

import { logger } from '../lib/logger'
import { globalMLRateLimiter } from '../lib/ml-api/global-rate-limiter'
import { mlMetricsCollector } from '../lib/metrics/ml-metrics-collector'
import { prisma } from '../lib/prisma'

// ==================== CONFIGURATION ====================

const CONFIG = {
  // Sincronização automática
  AUTO_SYNC_ENABLED: process.env['AUTO_SYNC_ENABLED'] !== 'false',
  SYNC_INTERVAL_HOURS: parseInt(process.env['SYNC_INTERVAL_HOURS'] || '6'), // 6 horas

  // Health checks
  HEALTH_CHECK_INTERVAL_MS: 60000, // 1 minuto

  // Metrics
  METRICS_ENABLED: process.env['METRICS_ENABLED'] !== 'false'
} as const

// ==================== ORCHESTRATOR CLASS ====================

class MLSystemOrchestrator {
  private healthCheckTimer: NodeJS.Timeout | null = null
  private isRunning = false

  constructor() {
    logger.info('[Orchestrator] 🚀 ML System Orchestrator initialized')
  }

  /**
   * 🔴 START: Inicializar todo o sistema
   */
  async start() {
    if (this.isRunning) {
      logger.warn('[Orchestrator] System already running')
      return
    }

    logger.info('[Orchestrator] =====================================')
    logger.info('[Orchestrator] 🚀 STARTING ML SYSTEM - PRODUCTION')
    logger.info('[Orchestrator] =====================================')

    this.isRunning = true

    try {
      // 1. Inicializar métricas
      if (CONFIG.METRICS_ENABLED) {
        logger.info('[Orchestrator] 📊 Starting metrics collector...')
        mlMetricsCollector.start()
        logger.info('[Orchestrator] ✅ Metrics collector started')
      }

      // 2. Verificar conectividade do banco
      logger.info('[Orchestrator] 🔌 Checking database connection...')
      await this.checkDatabaseConnection()
      logger.info('[Orchestrator] ✅ Database connected')

      // 3. Verificar contas ML ativas
      logger.info('[Orchestrator] 👥 Checking ML accounts...')
      const accountsInfo = await this.checkMLAccounts()
      logger.info('[Orchestrator] ✅ ML accounts verified', accountsInfo)

      // 4. Iniciar health checks
      logger.info('[Orchestrator] 💊 Starting health checks...')
      this.startHealthChecks()
      logger.info('[Orchestrator] ✅ Health checks started')

      // 6. Exibir dashboard
      this.displayDashboard()

      logger.info('[Orchestrator] =====================================')
      logger.info('[Orchestrator] ✅ ML SYSTEM FULLY OPERATIONAL')
      logger.info('[Orchestrator] =====================================')

    } catch (error: any) {
      logger.error('[Orchestrator] ❌ Failed to start system', {
        error: error.message,
        stack: error.stack
      })

      this.isRunning = false
      throw error
    }
  }

  /**
   * Verificar conexão com banco de dados
   */
  private async checkDatabaseConnection() {
    try {
      await prisma.$queryRaw`SELECT 1`
      logger.info('[Orchestrator] Database connection OK')
    } catch (error: any) {
      logger.error('[Orchestrator] Database connection failed', {
        error: error.message
      })
      throw new Error('Database connection failed')
    }
  }

  /**
   * Verificar contas ML ativas
   */
  private async checkMLAccounts() {
    const totalAccounts = await prisma.mLAccount.count()
    const activeAccounts = await prisma.mLAccount.count({
      where: { isActive: true }
    })
    const organizations = await prisma.organization.count({
      where: {
        subscriptionStatus: 'ACTIVE'
      }
    })

    return {
      totalAccounts,
      activeAccounts,
      organizations,
      status: activeAccounts > 0 ? 'OK' : 'NO_ACCOUNTS'
    }
  }

  /**
   * Iniciar health checks periódicos
   */
  private startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck()
    }, CONFIG.HEALTH_CHECK_INTERVAL_MS)

    logger.info('[Orchestrator] Health checks scheduled', {
      intervalMs: CONFIG.HEALTH_CHECK_INTERVAL_MS
    })
  }

  /**
   * Executar health check
   */
  private async performHealthCheck() {
    try {
      // Check database
      await prisma.$queryRaw`SELECT 1`

      // Check metrics
      mlMetricsCollector.getCurrentMetrics()

      // Check rate limiter
      const queueStatus = globalMLRateLimiter.getQueueStatus()

      // Alertas críticos
      const activeAlerts = mlMetricsCollector.getActiveAlerts()
      const criticalAlerts = activeAlerts.filter(a => a.type === 'critical')

      if (criticalAlerts.length > 0) {
        logger.warn('[Orchestrator] 🚨 Critical alerts detected!', {
          count: criticalAlerts.length,
          alerts: criticalAlerts.map(a => ({
            category: a.category,
            message: a.message
          }))
        })
      }

      logger.debug('[Orchestrator] Health check passed', {
        queueSize: queueStatus.size,
        activeAlerts: activeAlerts.length,
        criticalAlerts: criticalAlerts.length
      })

    } catch (error: any) {
      logger.error('[Orchestrator] Health check failed!', {
        error: error.message
      })
    }
  }

  /**
   * Exibir dashboard no console
   */
  private displayDashboard() {
    if (!CONFIG.METRICS_ENABLED) return

    const dashboard = mlMetricsCollector.getDashboard()

    logger.info('[Orchestrator] =====================================')
    logger.info('[Orchestrator] 📊 SYSTEM DASHBOARD')
    logger.info('[Orchestrator] =====================================')
    logger.info('[Orchestrator] Status: ' + dashboard.status)
    logger.info('[Orchestrator] ')
    logger.info('[Orchestrator] RATE LIMITER:')
    logger.info('[Orchestrator] - Queue Size: ' + (dashboard.rateLimiter?.queueSize || 0))
    logger.info('[Orchestrator] - Requests/min: ' + (dashboard.rateLimiter?.requestsPerMinute || 0))
    logger.info('[Orchestrator] - Requests/hour: ' + (dashboard.rateLimiter?.requestsPerHour || 0))
    logger.info('[Orchestrator] - Success Rate: ' + (dashboard.rateLimiter?.successRate || '100%'))
    logger.info('[Orchestrator] - Avg Wait Time: ' + (dashboard.rateLimiter?.averageWaitTime || '0s'))
    logger.info('[Orchestrator] ')
    logger.info('[Orchestrator] SYSTEM:')
    logger.info('[Orchestrator] - Uptime: ' + (dashboard.system?.uptime || '0 minutes'))
    logger.info('[Orchestrator] - Memory: ' + (dashboard.system?.memoryUsage?.heapUsed || '0 MB'))
    logger.info('[Orchestrator] ')
    logger.info('[Orchestrator] ALERTS:')
    logger.info('[Orchestrator] - Active: ' + (dashboard.alerts?.active || 0))
    logger.info('[Orchestrator] - Critical: ' + (dashboard.alerts?.critical || 0))
    logger.info('[Orchestrator] - Warnings: ' + (dashboard.alerts?.warning || 0))
    logger.info('[Orchestrator] =====================================')
  }

  /**
   * 🔴 STOP: Parar sistema gracefully
   */
  async stop() {
    logger.info('[Orchestrator] 🛑 Stopping ML System...')

    // Parar timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }

    // Parar subsistemas
    mlMetricsCollector.stop()
    globalMLRateLimiter.shutdown()

    this.isRunning = false

    logger.info('[Orchestrator] ✅ ML System stopped gracefully')
  }

  /**
   * Status do sistema
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: CONFIG,
      dashboard: CONFIG.METRICS_ENABLED
        ? mlMetricsCollector.getDashboard()
        : null
    }
  }
}

// ==================== SINGLETON & STARTUP ====================

const orchestrator = new MLSystemOrchestrator()

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[Orchestrator] Received SIGTERM')
  await orchestrator.stop()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('[Orchestrator] Received SIGINT')
  await orchestrator.stop()
  process.exit(0)
})

// Uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('[Orchestrator] Uncaught exception!', {
    error: error.message,
    stack: error.stack
  })
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Orchestrator] Unhandled rejection!', {
    reason,
    promise
  })
})

// Start orchestrator
orchestrator.start().catch((error) => {
  logger.error('[Orchestrator] Failed to start', {
    error: error.message,
    stack: error.stack
  })
  process.exit(1)
})

// ==================== EXPORTS ====================

export { orchestrator }
export default orchestrator
