/**
 * Performance Monitoring System
 * Tracks API response times, database queries, and system metrics
 */

import { logger } from '@/lib/logger'

interface PerformanceMetric {
  name: string
  duration: number
  timestamp: number
  metadata?: Record<string, any>
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetric[] = []
  private timers: Map<string, number> = new Map()
  private readonly MAX_METRICS = 1000
  private readonly FLUSH_INTERVAL = 60000 // 1 minute

  private constructor() {
    this.startFlushJob()
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  private startFlushJob(): void {
    setInterval(() => {
      this.flush()
    }, this.FLUSH_INTERVAL)
  }

  startTimer(name: string): void {
    this.timers.set(name, Date.now())
  }

  endTimer(name: string, metadata?: Record<string, any>): number {
    const startTime = this.timers.get(name)
    if (!startTime) {
      logger.warn(`Timer ${name} was not started`)
      return 0
    }

    const duration = Date.now() - startTime
    this.timers.delete(name)

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now()
    }
    
    if (metadata) {
      metric.metadata = metadata
    }
    
    this.recordMetric(metric)

    return duration
  }

  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS)
    }

    // Log slow operations
    if (metric.duration > 1000) {
      logger.warn('Slow operation detected', {
        name: metric.name,
        duration: metric.duration,
        metadata: metric.metadata
      })
    }
  }

  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter(m => m.name === name)
    }
    return [...this.metrics]
  }

  getAverageTime(name: string): number {
    const metrics = this.getMetrics(name)
    if (metrics.length === 0) return 0

    const total = metrics.reduce((sum, m) => sum + m.duration, 0)
    return Math.round(total / metrics.length)
  }

  getPercentile(name: string, percentile: number): number {
    const metrics = this.getMetrics(name)
    if (metrics.length === 0) return 0

    const sorted = metrics.map(m => m.duration).sort((a, b) => a - b)
    const index = Math.floor(sorted.length * (percentile / 100))
    return sorted[index] || 0
  }

  private flush(): void {
    if (this.metrics.length === 0) return

    // Group metrics by name
    const grouped = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = []
      }
      const metricArray = acc[metric.name]
      if (metricArray) {
        metricArray.push(metric.duration)
      }
      return acc
    }, {} as Record<string, number[]>)

    // Calculate stats for each metric
    const stats = Object.entries(grouped).map(([name, durations]) => ({
      name,
      count: durations.length,
      avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      min: Math.min(...durations),
      max: Math.max(...durations),
      p50: this.calculatePercentile(durations, 50),
      p95: this.calculatePercentile(durations, 95),
      p99: this.calculatePercentile(durations, 99)
    }))

    logger.info('Performance metrics', { stats })

    // Clear old metrics
    const cutoff = Date.now() - 3600000 // Keep last hour
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff)
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.floor(sorted.length * (percentile / 100))
    return sorted[index] || 0
  }

  reset(): void {
    this.metrics = []
    this.timers.clear()
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance()

// Middleware helper
export function measurePerformance(name: string) {
  return (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const timer = `${name}.${propertyKey}`
      performanceMonitor.startTimer(timer)
      
      try {
        const result = await originalMethod.apply(this, args)
        performanceMonitor.endTimer(timer)
        return result
      } catch (error) {
        performanceMonitor.endTimer(timer, { error: true })
        throw error
      }
    }

    return descriptor
  }
}