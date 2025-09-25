/**
 * Prometheus Metrics Endpoint
 * Exposes application metrics for monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { apmManager } from '@/lib/monitoring/apm-manager'
import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * GET /api/metrics
 * Returns Prometheus-formatted metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Check authorization (optional - for production security)
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env['METRICS_AUTH_TOKEN']
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get metrics from APM manager
    const prometheusMetrics = apmManager.getPrometheusMetrics()
    
    // Add custom application metrics
    const customMetrics = await getCustomMetrics()
    
    // Combine all metrics
    const allMetrics = `${prometheusMetrics}\n\n${customMetrics}`
    
    // Return metrics in Prometheus format
    return new NextResponse(allMetrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
  } catch (_error) {
    logger.error('[Metrics] Failed to generate metrics', { error: _error })
    
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    )
  }
}

/**
 * Get custom application metrics
 */
async function getCustomMetrics(): Promise<string> {
  const lines: string[] = []
  
  try {
    // Get queue metrics from Redis
    const queueHealth = await redis.get('webhook-queue:health')
    if (queueHealth) {
      const health = JSON.parse(queueHealth)
      
      lines.push('# TYPE webhook_queue_waiting gauge')
      lines.push(`webhook_queue_waiting ${health.waiting || 0}`)
      
      lines.push('# TYPE webhook_queue_active gauge')
      lines.push(`webhook_queue_active ${health.active || 0}`)
      
      lines.push('# TYPE webhook_queue_completed counter')
      lines.push(`webhook_queue_completed ${health.completed || 0}`)
      
      lines.push('# TYPE webhook_queue_failed counter')
      lines.push(`webhook_queue_failed ${health.failed || 0}`)
    }
    
    // Get WebSocket metrics
    const wsStats = await redis.get('websocket:stats')
    if (wsStats) {
      const stats = JSON.parse(wsStats)
      
      lines.push('# TYPE websocket_connections_active gauge')
      lines.push(`websocket_connections_active ${stats.connections || 0}`)
      
      lines.push('# TYPE websocket_rooms_active gauge')
      lines.push(`websocket_rooms_active ${stats.rooms || 0}`)
    }
    
    // Get SSE metrics
    const sseStats = await redis.get('sse:stats')
    if (sseStats) {
      const stats = JSON.parse(sseStats)
      
      lines.push('# TYPE sse_connections_active gauge')
      lines.push(`sse_connections_active ${stats.connections || 0}`)
    }
    
    // Get circuit breaker metrics
    const circuitStats = await redis.get('circuit-breaker:stats')
    if (circuitStats) {
      const stats = JSON.parse(circuitStats)
      
      for (const [endpoint, data] of Object.entries(stats)) {
        const state = (data as any).state || 'closed'
        const failures = (data as any).failures || 0
        const successes = (data as any).successes || 0
        
        lines.push(`# TYPE circuit_breaker_state gauge`)
        lines.push(`circuit_breaker_state{endpoint="${endpoint}",state="${state}"} ${state === 'open' ? 1 : 0}`)
        
        lines.push(`# TYPE circuit_breaker_failures counter`)
        lines.push(`circuit_breaker_failures{endpoint="${endpoint}"} ${failures}`)
        
        lines.push(`# TYPE circuit_breaker_successes counter`)
        lines.push(`circuit_breaker_successes{endpoint="${endpoint}"} ${successes}`)
      }
    }
    
    // Get cache metrics
    const cacheStats = await redis.get('cache:stats')
    if (cacheStats) {
      const stats = JSON.parse(cacheStats)
      
      lines.push('# TYPE cache_hits_total counter')
      lines.push(`cache_hits_total ${stats.hits || 0}`)
      
      lines.push('# TYPE cache_misses_total counter')
      lines.push(`cache_misses_total ${stats.misses || 0}`)
      
      const hitRate = stats.hits && stats.misses 
        ? (stats.hits / (stats.hits + stats.misses)) * 100 
        : 0
      
      lines.push('# TYPE cache_hit_rate gauge')
      lines.push(`cache_hit_rate ${hitRate.toFixed(2)}`)
    }
    
    // Add application info
    lines.push('# TYPE app_info gauge')
    lines.push(`app_info{version="${process.env['npm_package_version'] || '1.0.0'}",node_version="${process.version}",env="${process.env['NODE_ENV']}"} 1`)
    
  } catch (_error) {
    logger.error('[Metrics] Failed to get custom metrics', { error: _error })
  }
  
  return lines.join('\n')
}

// Removed unused getMetricsJson function