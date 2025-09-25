/**
 * Métricas do Prometheus para monitoramento
 * Sistema REAL de métricas para produção
 * @version 2.0 - Production Ready
 */

import { logger } from '@/lib/logger'

// Estrutura para armazenar métricas com labels
interface MetricValue {
  value: number
  labels: Record<string, string>
  timestamp: number
}

/**
 * Contador REAL para métricas
 * Funcional para produção
 */
class Counter {
  private metrics: Map<string, MetricValue> = new Map()
  private name: string
  private help: string

  constructor(config: { name: string; help: string; labelNames?: string[] }) {
    this.name = config.name
    this.help = config.help
    // labelNames not used but kept in constructor for compatibility
  }

  inc(labels?: Record<string, string>, value: number = 1): void {
    const key = this.generateKey(labels || {})
    const current = this.metrics.get(key)

    if (current) {
      current.value += value
      current.timestamp = Date.now()
    } else {
      this.metrics.set(key, {
        value,
        labels: labels || {},
        timestamp: Date.now()
      })
    }
  }

  reset(): void {
    this.metrics.clear()
  }

  get(labels?: Record<string, string>): number {
    if (labels) {
      const key = this.generateKey(labels)
      return this.metrics.get(key)?.value || 0
    }

    // Retornar soma total se não especificar labels
    let total = 0
    for (const metric of this.metrics.values()) {
      total += metric.value
    }
    return total
  }

  getAll(): MetricValue[] {
    return Array.from(this.metrics.values())
  }

  private generateKey(labels: Record<string, string>): string {
    return JSON.stringify(labels)
  }

  getName(): string {
    return this.name
  }

  getHelp(): string {
    return this.help
  }
}

/**
 * Histograma REAL para latências
 * Funcional para produção
 */
class Histogram {
  private metrics: Map<string, {
    buckets: Map<number, number>
    sum: number
    count: number
    labels: Record<string, string>
  }> = new Map()
  private name: string
  private help: string
  private bucketValues: number[]

  constructor(config: { name: string; help: string; labelNames?: string[]; buckets?: number[] }) {
    this.name = config.name
    this.help = config.help
    this.bucketValues = config.buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    // labelNames not used but kept in constructor for compatibility
  }

  observe(value: number, labels?: Record<string, string>): void {
    const key = this.generateKey(labels || {})
    let metric = this.metrics.get(key)

    if (!metric) {
      const buckets = new Map<number, number>()
      this.bucketValues.forEach(bucket => buckets.set(bucket, 0))

      metric = {
        buckets,
        sum: 0,
        count: 0,
        labels: labels || {}
      }
      this.metrics.set(key, metric)
    }

    // Incrementar buckets apropriados
    for (const bucketValue of this.bucketValues) {
      if (value <= bucketValue) {
        metric.buckets.set(bucketValue, (metric.buckets.get(bucketValue) || 0) + 1)
      }
    }

    metric.sum += value
    metric.count += 1
  }

  reset(): void {
    this.metrics.clear()
  }

  get(labels?: Record<string, string>): any {
    if (labels) {
      const key = this.generateKey(labels)
      return this.metrics.get(key)
    }
    return Array.from(this.metrics.values())
  }

  private generateKey(labels: Record<string, string>): string {
    return JSON.stringify(labels)
  }

  getName(): string {
    return this.name
  }

  getHelp(): string {
    return this.help
  }

  getAll(): any[] {
    const results = []
    for (const [_key, metric] of this.metrics) {
      results.push({
        labels: metric.labels,
        buckets: Array.from(metric.buckets.entries()),
        sum: metric.sum,
        count: metric.count,
        mean: metric.count > 0 ? metric.sum / metric.count : 0
      })
    }
    return results
  }
}

/**
 * Gauge REAL para métricas de estado
 * Funcional para produção
 */
class Gauge {
  private metrics: Map<string, MetricValue> = new Map()
  private name: string
  private help: string

  constructor(config: { name: string; help: string; labelNames?: string[] }) {
    this.name = config.name
    this.help = config.help
    // labelNames not used but kept in constructor for compatibility
  }

  set(value: number, labels?: Record<string, string>): void {
    const key = this.generateKey(labels || {})
    this.metrics.set(key, {
      value,
      labels: labels || {},
      timestamp: Date.now()
    })
  }

  inc(value: number = 1, labels?: Record<string, string>): void {
    const key = this.generateKey(labels || {})
    const current = this.metrics.get(key)

    if (current) {
      current.value += value
      current.timestamp = Date.now()
    } else {
      this.metrics.set(key, {
        value,
        labels: labels || {},
        timestamp: Date.now()
      })
    }
  }

  dec(value: number = 1, labels?: Record<string, string>): void {
    const key = this.generateKey(labels || {})
    const current = this.metrics.get(key)

    if (current) {
      current.value -= value
      current.timestamp = Date.now()
    } else {
      this.metrics.set(key, {
        value: -value,
        labels: labels || {},
        timestamp: Date.now()
      })
    }
  }

  get(labels?: Record<string, string>): number {
    if (labels) {
      const key = this.generateKey(labels)
      return this.metrics.get(key)?.value || 0
    }

    // Retornar soma total se não especificar labels
    let total = 0
    for (const metric of this.metrics.values()) {
      total += metric.value
    }
    return total
  }

  getAll(): MetricValue[] {
    return Array.from(this.metrics.values())
  }

  private generateKey(labels: Record<string, string>): string {
    return JSON.stringify(labels)
  }

  getName(): string {
    return this.name
  }

  getHelp(): string {
    return this.help
  }
}

// Métricas exportadas para uso no sistema

/**
 * Contador de hits de rate limit por endpoint
 */
export const mlRateLimitHits = new Counter({
  name: 'ml_rate_limit_hits_total',
  help: 'Total de hits de rate limit por endpoint',
  labelNames: ['endpoint', 'method', 'status']
})

/**
 * Contador de erros por tipo
 */
export const errorsByType = new Counter({
  name: 'ml_errors_total',
  help: 'Total de erros por tipo',
  labelNames: ['type', 'code', 'service']
})

/**
 * Histograma de latência de requisições ML API
 */
export const mlApiLatency = new Histogram({
  name: 'ml_api_request_duration_seconds',
  help: 'Latência das requisições para ML API',
  labelNames: ['endpoint', 'method', 'status'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10]
})

/**
 * Gauge de conexões ativas
 */
export const activeConnections = new Gauge({
  name: 'ml_active_connections',
  help: 'Número de conexões ativas',
  labelNames: ['type']
})

/**
 * Contador de requisições totais
 */
export const requestsTotal = new Counter({
  name: 'ml_requests_total',
  help: 'Total de requisições processadas',
  labelNames: ['endpoint', 'method', 'status']
})

/**
 * Gauge de uso de memória
 */
export const memoryUsage = new Gauge({
  name: 'ml_memory_usage_bytes',
  help: 'Uso de memória em bytes',
  labelNames: ['type']
})

/**
 * Registry REAL para coletar todas as métricas
 * Sistema funcional para produção
 */
class Registry {
  private registeredMetrics: Map<string, Counter | Gauge | Histogram> = new Map()

  constructor() {
    // Auto-registrar métricas padrão
    this.registerMetric('ml_rate_limit_hits_total', mlRateLimitHits)
    this.registerMetric('ml_errors_total', errorsByType)
    this.registerMetric('ml_api_request_duration_seconds', mlApiLatency)
    this.registerMetric('ml_active_connections', activeConnections)
    this.registerMetric('ml_requests_total', requestsTotal)
    this.registerMetric('ml_memory_usage_bytes', memoryUsage)
  }

  async metrics(): Promise<string> {
    const lines: string[] = []

    // Processar cada métrica registrada
    for (const [name, metric] of this.registeredMetrics) {
      if (metric instanceof Counter) {
        lines.push(`# HELP ${name} ${metric.getHelp()}`)
        lines.push(`# TYPE ${name} counter`)

        const allMetrics = metric.getAll()
        if (allMetrics.length === 0) {
          lines.push(`${name} 0`)
        } else {
          for (const m of allMetrics) {
            const labels = this.formatLabels(m.labels)
            lines.push(`${name}${labels} ${m.value}`)
          }
        }
      } else if (metric instanceof Gauge) {
        lines.push(`# HELP ${name} ${metric.getHelp()}`)
        lines.push(`# TYPE ${name} gauge`)

        const allMetrics = metric.getAll()
        if (allMetrics.length === 0) {
          lines.push(`${name} 0`)
        } else {
          for (const m of allMetrics) {
            const labels = this.formatLabels(m.labels)
            lines.push(`${name}${labels} ${m.value}`)
          }
        }
      } else if (metric instanceof Histogram) {
        lines.push(`# HELP ${name} ${metric.getHelp()}`)
        lines.push(`# TYPE ${name} histogram`)

        const allMetrics = metric.getAll()
        for (const m of allMetrics) {
          const labels = this.formatLabels(m.labels)

          // Buckets
          for (const [bucket, count] of m.buckets) {
            lines.push(`${name}_bucket{le="${bucket}"${labels ? ',' + labels.slice(1) : ''}} ${count}`)
          }
          lines.push(`${name}_bucket{le="+Inf"${labels ? ',' + labels.slice(1) : ''}} ${m.count}`)

          // Sum and count
          lines.push(`${name}_sum${labels} ${m.sum}`)
          lines.push(`${name}_count${labels} ${m.count}`)
        }
      }

      lines.push('') // Empty line between metrics
    }

    return lines.join('\n')
  }

  registerMetric(name: string, metric: Counter | Gauge | Histogram): void {
    this.registeredMetrics.set(name, metric)
  }

  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels)
    if (entries.length === 0) return ''

    const formatted = entries
      .map(([key, value]) => `${key}="${value}"`)
      .join(',')

    return `{${formatted}}`
  }

  // Obter métricas em formato JSON
  async getMetricsJSON(): Promise<any> {
    const result: any = {}

    for (const [name, metric] of this.registeredMetrics) {
      if (metric instanceof Counter || metric instanceof Gauge) {
        result[name] = metric.getAll().map(m => ({
          value: m.value,
          labels: m.labels,
          timestamp: m.timestamp
        }))
      } else if (metric instanceof Histogram) {
        result[name] = metric.getAll()
      }
    }

    return result
  }
}

export const register = new Registry()

// Sistema de coleta automática de métricas do sistema
class SystemMetricsCollector {
  private interval: NodeJS.Timer | null = null

  start() {
    if (this.interval) return

    // Coletar métricas a cada 10 segundos
    this.interval = setInterval(() => {
      this.collect()
    }, 10000)

    // Coletar imediatamente
    this.collect()
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval as any)
      this.interval = null
    }
  }

  private collect() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()

      // Memória
      memoryUsage.set(usage.heapUsed, { type: 'heap_used' })
      memoryUsage.set(usage.heapTotal, { type: 'heap_total' })
      memoryUsage.set(usage.rss, { type: 'rss' })
      memoryUsage.set(usage.external, { type: 'external' })

      // CPU (se disponível)
      if (process.cpuUsage) {
        const cpu = process.cpuUsage()
        memoryUsage.set(cpu.user, { type: 'cpu_user' })
        memoryUsage.set(cpu.system, { type: 'cpu_system' })
      }

      // Conexões ativas (estimativa baseada em handles)
      if ((process as any)._getActiveHandles) {
        const handles = (process as any)._getActiveHandles().length
        activeConnections.set(handles, { type: 'handles' })
      }
    }
  }
}

const systemCollector = new SystemMetricsCollector()
systemCollector.start()

// Cleanup no shutdown
process.on('SIGTERM', () => systemCollector.stop())
process.on('SIGINT', () => systemCollector.stop())

logger.info('[Prometheus] Production metrics system initialized successfully')

export default {
  mlRateLimitHits,
  errorsByType,
  mlApiLatency,
  activeConnections,
  requestsTotal,
  memoryUsage,
  register
}