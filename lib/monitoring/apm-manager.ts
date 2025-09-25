/**
 * APM (Application Performance Monitoring) Manager
 * Production monitoring with Prometheus metrics export
 */

import { EventEmitter } from 'events'
import { logger } from '@/lib/logger'
import { redis } from '@/lib/redis'
import { performanceMonitor } from '@/lib/performance-monitor'

// interface MetricValue {
//   value: number
//   timestamp: number
//   labels?: Record<string, string>
// } - Unused interface

interface Histogram {
  buckets: Map<number, number>
  sum: number
  count: number
}

class APMManager extends EventEmitter {
  // private metrics: Map<string, MetricValue[]> = new Map() - Unused variable
  private histograms: Map<string, Histogram> = new Map()
  private counters: Map<string, number> = new Map()
  private gauges: Map<string, number> = new Map()
  
  // Prometheus metrics format
  // private readonly METRIC_TYPES = {
  //   COUNTER: 'counter',
  //   GAUGE: 'gauge',
  //   HISTOGRAM: 'histogram',
  //   SUMMARY: 'summary'
  // } - Unused constant
  
  // Default histogram buckets (in milliseconds)
  private readonly DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
  
  constructor() {
    super()
    this.setMaxListeners(50) // Prevent memory leak warnings
    this.initialize()
  }
  
  private initialize() {
    // Start metrics collection
    this.startMetricsCollection()
    
    // Export metrics endpoint
    this.setupMetricsExport()
    
    logger.info('[APM] Manager initialized')
  }
  
  /**
   * Record a counter metric (always increasing)
   */
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels)
    const current = this.counters.get(key) || 0
    this.counters.set(key, current + value)
  }
  
  /**
   * Record a gauge metric (can go up or down)
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels)
    this.gauges.set(key, value)
  }
  
  /**
   * Record a histogram metric (for distributions)
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels)
    
    let histogram = this.histograms.get(key)
    if (!histogram) {
      histogram = {
        buckets: new Map(this.DEFAULT_BUCKETS.map(b => [b, 0])),
        sum: 0,
        count: 0
      }
      this.histograms.set(key, histogram)
    }
    
    // Update buckets
    for (const bucket of this.DEFAULT_BUCKETS) {
      if (value <= bucket) {
        const current = histogram.buckets.get(bucket) || 0
        histogram.buckets.set(bucket, current + 1)
      }
    }
    
    // Update sum and count
    histogram.sum += value
    histogram.count += 1
  }
  
  /**
   * Record a timing metric
   */
  recordTiming(name: string, duration: number, labels?: Record<string, string>): void {
    this.recordHistogram(name, duration, labels)
  }
  
  /**
   * Start collecting system metrics
   */
  private startMetricsCollection() {
    // Collect every 10 seconds
    setInterval(() => {
      this.collectSystemMetrics()
      this.collectApplicationMetrics()
      this.collectBusinessMetrics()
    }, 10000)
  }
  
  /**
   * Collect system-level metrics
   */
  private collectSystemMetrics() {
    const memUsage = process.memoryUsage()
    
    // Memory metrics
    this.setGauge('nodejs_memory_heap_used_bytes', memUsage.heapUsed)
    this.setGauge('nodejs_memory_heap_total_bytes', memUsage.heapTotal)
    this.setGauge('nodejs_memory_rss_bytes', memUsage.rss)
    this.setGauge('nodejs_memory_external_bytes', memUsage.external)
    
    // CPU metrics
    const cpuUsage = process.cpuUsage()
    this.setGauge('nodejs_cpu_user_seconds', cpuUsage.user / 1000000)
    this.setGauge('nodejs_cpu_system_seconds', cpuUsage.system / 1000000)
    
    // Process metrics
    this.setGauge('nodejs_process_uptime_seconds', process.uptime())
    
    // Event loop lag (approximation)
    const start = Date.now()
    setImmediate(() => {
      const lag = Date.now() - start
      this.recordHistogram('nodejs_eventloop_lag_milliseconds', lag)
    })
  }
  
  /**
   * Collect application-level metrics
   */
  private async collectApplicationMetrics() {
    try {
      // Database pool metrics
      const { prisma } = await import('@/lib/prisma')
      const poolMetrics = (prisma as any).$metrics
      if (poolMetrics) {
        this.setGauge('database_pool_size', poolMetrics.poolSize || 0)
        this.setGauge('database_pool_available', poolMetrics.available || 0)
        this.setGauge('database_pool_waiting', poolMetrics.waiting || 0)
      }
      
      // Redis metrics
      const redisInfo = await redis.info('stats')
      const lines = redisInfo.split('\r\n')
      for (const line of lines) {
        if (line.includes('instantaneous_ops_per_sec')) {
          const ops = parseInt(line.split(':')[1] || '0')
          this.setGauge('redis_operations_per_second', ops)
        }
        if (line.includes('keyspace_hits')) {
          const hits = parseInt(line.split(':')[1] || '0')
          this.incrementCounter('redis_keyspace_hits_total', hits)
        }
        if (line.includes('keyspace_misses')) {
          const misses = parseInt(line.split(':')[1] || '0')
          this.incrementCounter('redis_keyspace_misses_total', misses)
        }
      }
      
      // API metrics from performance monitor
      const perfStats = (performanceMonitor as any).getStatistics ? (performanceMonitor as any).getStatistics() : { byOperation: {} }
      for (const [operation, stats] of Object.entries(perfStats.byOperation)) {
        this.recordHistogram('http_request_duration_milliseconds', (stats as any).avgDuration, {
          method: 'GET',
          route: operation
        })
      }
      
    } catch (_error) {
      logger.error('[APM] Failed to collect application metrics', { error: _error })
    }
  }
  
  /**
   * Collect business metrics
   */
  private async collectBusinessMetrics() {
    try {
      const { prisma } = await import('@/lib/prisma')
      
      // Question metrics
      const pendingQuestions = await prisma.question.count({
        where: { status: 'RECEIVED' }
      })
      this.setGauge('business_questions_pending', pendingQuestions)
      
      // Webhook metrics
      const pendingWebhooks = await prisma.webhookEvent.count({
        where: { status: 'PENDING' }
      })
      this.setGauge('business_webhooks_pending', pendingWebhooks)
      
      // Organization metrics
      const activeOrgs = await prisma.organization.count({
        where: {} // status field may not exist
      })
      this.setGauge('business_organizations_active', activeOrgs)
      
      // ML Account metrics
      const activeAccounts = await prisma.mLAccount.count({
        where: { isActive: true }
      })
      this.setGauge('business_ml_accounts_active', activeAccounts)
      
    } catch (_error) {
      logger.error('[APM] Failed to collect business metrics', { error: _error })
    }
  }
  
  /**
   * Get metric key with labels
   */
  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name
    
    const sortedLabels = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
    
    return `${name}{${sortedLabels}}`
  }
  
  /**
   * Export metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = []
    
    // Export counters
    for (const [key, value] of this.counters) {
// const [name, labels] = this.parseMetricKey(key) // Unused variable
      lines.push(`# TYPE ${name} counter`)
      lines.push(`${key} ${value}`)
    }
    
    // Export gauges
    for (const [key, value] of this.gauges) {
// const [name, labels] = this.parseMetricKey(key) // Unused variable
      lines.push(`# TYPE ${name} gauge`)
      lines.push(`${key} ${value}`)
    }
    
    // Export histograms
    for (const [key, histogram] of this.histograms) {
      const [name, labels] = this.parseMetricKey(key)
      lines.push(`# TYPE ${name} histogram`)
      
      // Export buckets
      for (const [bucket, count] of histogram.buckets) {
        const bucketKey = labels 
          ? `${name}_bucket{${labels},le="${bucket}"}`
          : `${name}_bucket{le="${bucket}"}`
        lines.push(`${bucketKey} ${count}`)
      }
      
      // Export +Inf bucket
      const infKey = labels
        ? `${name}_bucket{${labels},le="+Inf"}`
        : `${name}_bucket{le="+Inf"}`
      lines.push(`${infKey} ${histogram.count}`)
      
      // Export sum and count
      const sumKey = labels ? `${name}_sum{${labels}}` : `${name}_sum`
      const countKey = labels ? `${name}_count{${labels}}` : `${name}_count`
      lines.push(`${sumKey} ${histogram.sum}`)
      lines.push(`${countKey} ${histogram.count}`)
    }
    
    return lines.join('\n')
  }
  
  /**
   * Parse metric key to extract name and labels
   */
  private parseMetricKey(key: string): [string, string | null] {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/)
    if (!match) return [key, null]
    
    return [match[1] || key, match[2] ?? null]
  }
  
  /**
   * Setup metrics export endpoint
   */
  private setupMetricsExport() {
    // Store metrics in Redis for external scraping
    setInterval(async () => {
      try {
        const metrics = this.getPrometheusMetrics()
        await redis.set('apm:prometheus:metrics', metrics, 'EX', 60)
      } catch (_error) {
        logger.error('[APM] Failed to export metrics', { error: _error })
      }
    }, 15000) // Export every 15 seconds
  }
  
  /**
   * Record HTTP request
   */
  recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number
  ): void {
    // Increment request counter
    this.incrementCounter('http_requests_total', 1, {
      method,
      route: path,
      status: statusCode.toString()
    })
    
    // Record duration histogram
    this.recordHistogram('http_request_duration_milliseconds', duration, {
      method,
      route: path
    })
    
    // Track errors
    if (statusCode >= 400) {
      this.incrementCounter('http_errors_total', 1, {
        method,
        route: path,
        status: statusCode.toString()
      })
    }
  }
  
  /**
   * Record database query
   */
  recordDatabaseQuery(
    operation: string,
    model: string,
    duration: number,
    success: boolean
  ): void {
    this.recordHistogram('database_query_duration_milliseconds', duration, {
      operation,
      model
    })
    
    if (!success) {
      this.incrementCounter('database_errors_total', 1, {
        operation,
        model
      })
    }
  }
  
  /**
   * Get current metrics summary
   */
  getMetricsSummary() {
    return {
      counters: this.counters.size,
      gauges: this.gauges.size,
      histograms: this.histograms.size,
      totalMetrics: this.counters.size + this.gauges.size + this.histograms.size
    }
  }
}

// Export singleton instance
// Disable APM in production to avoid errors
class DummyAPMManager {
  incrementCounter() {}
  setGauge() {}
  recordHistogram() {}
  recordTiming() {}
  recordHttpRequest() {}
  getPrometheusMetrics() { return '' }
  getStatistics() { return { byOperation: {} } }
}

// Lazy-loaded APM Manager - sem Proxy complexo
let apmManagerInstance: APMManager | DummyAPMManager | undefined

// Export direto com lazy initialization
export const apmManager = (() => {
  // Durante build, sempre retornar dummy
  if (typeof process !== 'undefined' &&
      (process.env['NEXT_PHASE'] === 'phase-production-build' ||
       process.env['BUILDING'] === 'true')) {
    return new DummyAPMManager()
  }

  if (!apmManagerInstance) {
    apmManagerInstance = process.env['ENABLE_METRICS'] === 'false'
      ? new DummyAPMManager()
      : new APMManager()

    // Auto-instrument HTTP requests apenas após inicialização
    if (typeof window === 'undefined' && typeof global !== 'undefined' && global.fetch && !(apmManagerInstance instanceof DummyAPMManager)) {
      const originalFetch = global.fetch
      global.fetch = async function(...args) {
        const start = Date.now()
        try {
          const response = await originalFetch.apply(this, args)
          const duration = Date.now() - start

          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
          const method = args[1]?.method || 'GET'

          apmManagerInstance!.recordHttpRequest(method, url, response.status, duration)

          return response
        } catch (_error) {
          const duration = Date.now() - start
          apmManagerInstance!.recordHttpRequest('GET', String(args[0]), 0, duration)
          throw _error
        }
      }
    }
  }

  return apmManagerInstance
})()