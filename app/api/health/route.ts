/**
 * Comprehensive Health Check Endpoint
 * Critical for production monitoring and auto-scaling
 * September 2025 Production Ready
 */

import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { checkDatabaseHealth, prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { getAllCircuitBreakerStats } from '@/lib/resilience/circuit-breaker'
import Bull from 'bull'

const startTime = Date.now()

export async function GET() {
  const checkStartTime = Date.now()
  
  const health = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] || '1.0.0',
    environment: process.env['NODE_ENV'],
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {} as Record<string, any>,
    metrics: {} as Record<string, any>
  }

  // 1. Database Health
  try {
    const dbStart = Date.now()
    const isHealthy = await checkDatabaseHealth()
    
    // Additional connection pool check
    const poolStats = await prisma.$queryRaw<any[]>`
      SELECT count(*) as connections, state
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state
    `.catch(() => [])
    
    const activeConnections = poolStats
      .filter(s => s.state === 'active')
      .reduce((sum, s) => sum + Number(s.connections), 0)
    
    health.checks['database'] = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTimeMs: Date.now() - dbStart,
      activeConnections,
      poolStats: poolStats.map(s => ({
        connections: Number(s.connections),
        state: s.state
      }))
    }
    
    if (!isHealthy) health.status = 'unhealthy'
    if (activeConnections > 400) health.status = 'degraded'
    
  } catch (error: any) {
    health.checks['database'] = {
      status: 'unhealthy',
      error: error.message
    }
    health.status = 'unhealthy'
  }

  // 2. Redis Health
  try {
    const redisStart = Date.now()
    const pong = await redis.ping()
    
    health.checks['redis'] = {
      status: pong === 'PONG' ? 'healthy' : 'unhealthy',
      responseTimeMs: Date.now() - redisStart
    }
    
    if (pong !== 'PONG') health.status = 'degraded'
    
  } catch (error: any) {
    health.checks['redis'] = {
      status: 'unhealthy',
      error: error.message
    }
    health.status = 'degraded' // Redis failure is degraded, not unhealthy
  }

  // 3. Circuit Breakers
  try {
    const circuits = getAllCircuitBreakerStats()
    let hasOpenCircuits = false
    
    for (const [, stats] of Object.entries(circuits)) {
      if (stats.state === 'OPEN') {
        hasOpenCircuits = true
      }
    }
    
    health.checks['circuitBreakers'] = {
      status: hasOpenCircuits ? 'degraded' : 'healthy',
      circuits
    }
    
    if (hasOpenCircuits) health.status = 'degraded'
    
  } catch (error: any) {
    logger.error('[Health] Circuit breaker check failed', { error })
  }

  // 4. Memory Health
  const memUsage = process.memoryUsage()
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
  
  health.checks['memory'] = {
    status: heapUsedMB < 4000 ? 'healthy' : 'degraded',
    heapUsedMB,
    heapTotalMB,
    rssMB: Math.round(memUsage.rss / 1024 / 1024),
    heapUsagePercent: Math.round((heapUsedMB / heapTotalMB) * 100)
  }
  
  if (heapUsedMB > 4000) health.status = 'degraded'

  // 5. Queue Health (Bull Queues)
  try {
    const redisConfig: any = {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379')
    }

    if (process.env['REDIS_PASSWORD']) {
      redisConfig.password = process.env['REDIS_PASSWORD']
    }

    const questionQueue = new Bull('ml-questions-realtime', { redis: redisConfig })
    const webhookQueue = new Bull('ml-webhooks-realtime', { redis: redisConfig })
    const tokenQueue = new Bull('ml-tokens', { redis: redisConfig })

    const [queueStats, webhookStats, tokenStats] = await Promise.all([
      questionQueue.getJobCounts(),
      webhookQueue.getJobCounts(),
      tokenQueue.getJobCounts()
    ])

    health.checks['queues'] = {
      status: 'healthy',
      questions: {
        active: queueStats.active || 0,
        waiting: queueStats.waiting || 0,
        completed: queueStats.completed || 0,
        failed: queueStats.failed || 0
      },
      webhooks: {
        active: webhookStats.active || 0,
        waiting: webhookStats.waiting || 0,
        completed: webhookStats.completed || 0,
        failed: webhookStats.failed || 0
      },
      tokens: {
        active: tokenStats.active || 0,
        waiting: tokenStats.waiting || 0,
        completed: tokenStats.completed || 0,
        failed: tokenStats.failed || 0
      }
    }

    // Check for too many failures
    const totalFailed = (queueStats.failed || 0) + (webhookStats.failed || 0) + (tokenStats.failed || 0)
    const totalWaiting = (queueStats.waiting || 0) + (webhookStats.waiting || 0)

    if (totalFailed > 100) {
      health.checks['queues'].status = 'degraded'
      health.status = 'degraded'
    }

    if (totalWaiting > 500) {
      health.checks['queues'].status = 'degraded'
      health.status = 'degraded'
    }

    // Close queue connections
    await Promise.all([
      questionQueue.close(),
      webhookQueue.close(),
      tokenQueue.close()
    ])
  } catch (error: any) {
    health.checks['queues'] = {
      status: 'unhealthy',
      error: error.message
    }
  }

  // 6. ML Accounts Health
  try {
    const activeAccounts = await prisma.mLAccount.count({ where: { isActive: true } })
    const validTokens = await prisma.mLAccount.count({
      where: {
        isActive: true,
        tokenExpiresAt: { gt: new Date() }
      }
    })

    // Questions metrics
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [pendingQuestions, processedToday, failedToday] = await Promise.all([
      prisma.question.count({
        where: { status: { in: ['PENDING', 'PROCESSING', 'AWAITING_APPROVAL', 'APPROVED'] } }
      }),
      prisma.question.count({
        where: {
          status: { in: ['SENT_TO_ML', 'COMPLETED'] },
          sentToMLAt: { gte: todayStart }
        }
      }),
      prisma.question.count({
        where: {
          status: 'FAILED',
          failedAt: { gte: todayStart }
        }
      })
    ])

    health.checks['mlAccounts'] = {
      status: validTokens > 0 ? 'healthy' : 'unhealthy',
      activeAccounts,
      validTokens,
      pendingQuestions,
      processedToday,
      failedToday
    }

    if (validTokens === 0 && activeAccounts > 0) {
      health.status = 'degraded'
    }

  } catch (error: any) {
    health.checks['mlAccounts'] = {
      status: 'unhealthy',
      error: error.message
    }
  }

  // Overall metrics
  health.metrics = {
    responseTimeMs: Date.now() - checkStartTime,
    processUptime: process.uptime(),
    nodeVersion: process.version
  }

  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503

  return NextResponse.json(health, { status: statusCode })
}