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