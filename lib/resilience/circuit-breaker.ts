/**
 * Circuit Breaker Pattern Implementation
 * Protege o sistema contra cascading failures
 * Essencial para resiliência em produção
 */

import { logger } from '@/lib/logger'
import { errorsByType } from '@/lib/monitoring/prometheus-metrics'

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

export interface CircuitBreakerOptions {
  name: string
  failureThreshold: number      // Number of failures to open circuit
  successThreshold: number      // Number of successes to close circuit
  timeout: number              // Time in ms before trying half-open
  volumeThreshold: number      // Minimum requests before evaluating
  errorThresholdPercentage: number // Error percentage to open circuit
  resetTimeout: number         // Time to reset statistics
}

export interface CircuitBreakerStats {
  state: CircuitState
  failures: number
  successes: number
  rejections: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  totalRequests: number
  errorPercentage: number
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failures: number = 0
  private successes: number = 0
  private rejections: number = 0
  private totalRequests: number = 0
  private requestTimestamps: number[] = []
  private lastFailureTime?: Date
  private lastSuccessTime?: Date
  private nextAttempt?: Date
  private halfOpenTests: number = 0
  
  private readonly options: CircuitBreakerOptions
  
  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      name: options.name || 'default',
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 2,
      timeout: options.timeout || 60000, // 1 minute
      volumeThreshold: options.volumeThreshold || 10,
      errorThresholdPercentage: options.errorThresholdPercentage || 50,
      resetTimeout: options.resetTimeout || 120000 // 2 minutes
    }
    
    // Reset statistics periodically
    setInterval(() => this.resetStatistics(), this.options.resetTimeout)
  }
  
  /**
   * Execute function with circuit breaker protection
   */
  async execute<R>(fn: () => Promise<R>): Promise<R> {
    // Check if circuit should transition
    this.evaluateState()
    
    // Record request
    this.totalRequests++
    this.requestTimestamps.push(Date.now())
    
    // Handle based on current state
    switch (this.state) {
      case CircuitState.OPEN:
        return this.handleOpenState()
      
      case CircuitState.HALF_OPEN:
        return this.handleHalfOpenState(fn)
      
      case CircuitState.CLOSED:
      default:
        return this.handleClosedState(fn)
    }
  }
  
  /**
   * Handle request in OPEN state (failing)
   */
  private handleOpenState<R>(): Promise<R> {
    this.rejections++
    
    logger.warn(`[CircuitBreaker:${this.options.name}] Circuit OPEN - rejecting request`, {
      rejections: this.rejections,
      nextAttempt: this.nextAttempt
    })
    
    // Track metric
    errorsByType.inc({
      error_type: 'circuit_breaker_open',
      severity: 'warning',
      source: this.options.name
    })
    
    throw new Error(`Circuit breaker is OPEN for ${this.options.name}. Service temporarily unavailable.`)
  }
  
  /**
   * Handle request in HALF_OPEN state (testing)
   */
  private async handleHalfOpenState<R>(fn: () => Promise<R>): Promise<R> {
    try {
      logger.info(`[CircuitBreaker:${this.options.name}] Testing in HALF_OPEN state`)
      
      const result = await fn()
      this.onSuccess()
      
      // Check if we should close circuit
      this.halfOpenTests++
      if (this.halfOpenTests >= this.options.successThreshold) {
        this.close()
      }
      
      return result
    } catch (error) {
      this.onFailure(error)
      
      // Single failure in half-open reopens circuit
      this.open()
      throw error
    }
  }
  
  /**
   * Handle request in CLOSED state (normal)
   */
  private async handleClosedState<R>(fn: () => Promise<R>): Promise<R> {
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error)
      
      // Check if we should open circuit
      if (this.shouldOpen()) {
        this.open()
      }
      
      throw error
    }
  }
  
  /**
   * Record successful execution
   */
  private onSuccess(): void {
    this.successes++
    this.lastSuccessTime = new Date()
    
    logger.debug(`[CircuitBreaker:${this.options.name}] Success recorded`, {
      successes: this.successes,
      state: this.state
    })
  }
  
  /**
   * Record failed execution
   */
  private onFailure(error: any): void {
    this.failures++
    this.lastFailureTime = new Date()
    
    logger.warn(`[CircuitBreaker:${this.options.name}] Failure recorded`, {
      failures: this.failures,
      state: this.state,
      error: error?.message
    })
    
    // Track metric
    errorsByType.inc({
      error_type: 'circuit_breaker_failure',
      severity: 'error',
      source: this.options.name
    })
  }
  
  /**
   * Check if circuit should open
   */
  private shouldOpen(): boolean {
    // Not enough requests to evaluate
    if (this.totalRequests < this.options.volumeThreshold) {
      return false
    }
    
    // Check failure threshold
    if (this.failures >= this.options.failureThreshold) {
      return true
    }
    
    // Check error percentage
    const errorPercentage = (this.failures / this.totalRequests) * 100
    return errorPercentage >= this.options.errorThresholdPercentage
  }
  
  /**
   * Open the circuit
   */
  private open(): void {
    this.state = CircuitState.OPEN
    this.nextAttempt = new Date(Date.now() + this.options.timeout)
    
    logger.error(`[CircuitBreaker:${this.options.name}] Circuit OPENED`, {
      failures: this.failures,
      errorPercentage: this.getErrorPercentage(),
      nextAttempt: this.nextAttempt
    })
    
    // Track metric
    errorsByType.inc({
      error_type: 'circuit_opened',
      severity: 'critical',
      source: this.options.name
    })
  }
  
  /**
   * Close the circuit
   */
  private close(): void {
    this.state = CircuitState.CLOSED
    this.failures = 0
    this.halfOpenTests = 0
    
    logger.info(`[CircuitBreaker:${this.options.name}] Circuit CLOSED`, {
      successes: this.successes
    })
  }
  
  /**
   * Move to half-open state
   */
  private halfOpen(): void {
    this.state = CircuitState.HALF_OPEN
    this.halfOpenTests = 0
    
    logger.info(`[CircuitBreaker:${this.options.name}] Circuit HALF_OPEN - testing recovery`)
  }
  
  /**
   * Evaluate if state should change
   */
  private evaluateState(): void {
    if (this.state === CircuitState.OPEN && this.nextAttempt) {
      if (Date.now() >= this.nextAttempt.getTime()) {
        this.halfOpen()
      }
    }
  }
  
  /**
   * Reset statistics periodically
   */
  private resetStatistics(): void {
    const now = Date.now()
    
    // Keep only recent requests
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.options.resetTimeout
    )
    
    // Reset counters if no recent activity
    if (this.requestTimestamps.length === 0) {
      this.failures = 0
      this.successes = 0
      this.totalRequests = 0
      
      if (this.state === CircuitState.OPEN) {
        this.halfOpen()
      }
    }
  }
  
  /**
   * Get error percentage
   */
  private getErrorPercentage(): number {
    if (this.totalRequests === 0) return 0
    return Math.round((this.failures / this.totalRequests) * 100)
  }
  
  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    const stats: CircuitBreakerStats = {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      rejections: this.rejections,
      totalRequests: this.totalRequests,
      errorPercentage: this.getErrorPercentage()
    }
    
    if (this.lastFailureTime) {
      stats.lastFailureTime = this.lastFailureTime
    }
    
    if (this.lastSuccessTime) {
      stats.lastSuccessTime = this.lastSuccessTime
    }
    
    return stats
  }
  
  /**
   * Force circuit to specific state (for testing)
   */
  forceState(state: CircuitState): void {
    this.state = state
    logger.warn(`[CircuitBreaker:${this.options.name}] Forced to state: ${state}`)
  }
  
  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED
    this.failures = 0
    this.successes = 0
    this.rejections = 0
    this.totalRequests = 0
    this.requestTimestamps = []
    this.halfOpenTests = 0
    delete this.nextAttempt
    
    logger.info(`[CircuitBreaker:${this.options.name}] Circuit reset`)
  }
}

/**
 * Circuit breakers for different services
 */
export const circuitBreakers = {
  mlApi: new CircuitBreaker({
    name: 'ml-api',
    failureThreshold: 10,
    successThreshold: 5,
    timeout: 30000, // 30 seconds
    volumeThreshold: 20,
    errorThresholdPercentage: 50
  }),
  
  database: new CircuitBreaker({
    name: 'database',
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 10000, // 10 seconds
    volumeThreshold: 10,
    errorThresholdPercentage: 30
  }),
  
  redis: new CircuitBreaker({
    name: 'redis',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 5000, // 5 seconds
    volumeThreshold: 10,
    errorThresholdPercentage: 40
  }),
  
  webhook: new CircuitBreaker({
    name: 'webhook',
    failureThreshold: 15,
    successThreshold: 5,
    timeout: 60000, // 1 minute
    volumeThreshold: 30,
    errorThresholdPercentage: 60
  }),

  gemini: new CircuitBreaker({
    name: 'gemini',
    failureThreshold: 8,
    successThreshold: 3,
    timeout: 60000, // 60 seconds
    volumeThreshold: 15,
    errorThresholdPercentage: 50
  })
}

/**
 * Helper function to execute with circuit breaker
 */
export async function withCircuitBreaker<T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>
): Promise<T> {
  return breaker.execute(fn)
}

/**
 * Get all circuit breaker stats
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {}
  
  for (const [name, breaker] of Object.entries(circuitBreakers)) {
    stats[name] = breaker.getStats()
  }
  
  return stats
}

/**
 * Monitor circuit breakers health
 */
setInterval(() => {
  const stats = getAllCircuitBreakerStats()
  
  for (const [name, stat] of Object.entries(stats)) {
    if (stat.state === CircuitState.OPEN) {
      logger.error(`[CircuitBreaker] Circuit ${name} is OPEN`, stat)
    } else if (stat.errorPercentage > 30) {
      logger.warn(`[CircuitBreaker] Circuit ${name} has high error rate`, stat)
    }
  }
}, 30000) // Check every 30 seconds

const circuitBreakerModule = {
  CircuitBreaker,
  CircuitState,
  circuitBreakers,
  withCircuitBreaker,
  getAllCircuitBreakerStats
}

export default circuitBreakerModule