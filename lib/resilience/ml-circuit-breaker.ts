/**
 * ML API Circuit Breaker - Proteção específica para API do Mercado Livre
 * Previne cascading failures e respeita rate limits
 * Production-ready Setembro 2025
 */

import { CircuitBreaker, CircuitBreakerOptions } from './circuit-breaker'
import { logger } from '@/lib/logger'
import { SLO } from '@/lib/monitoring/slo-manager'

/**
 * Configurações otimizadas para diferentes endpoints do ML
 */
const ML_CIRCUIT_CONFIGS: Record<string, Partial<CircuitBreakerOptions>> = {
  // OAuth é crítico - mais tolerante
  'oauth/token': {
    name: 'ml-oauth',
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 30000,
    errorThresholdPercentage: 70
  },
  
  // Items API - médio
  'items': {
    name: 'ml-items',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
    errorThresholdPercentage: 50
  },
  
  // Questions - real-time, menos tolerante
  'questions': {
    name: 'ml-questions',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000,
    errorThresholdPercentage: 30
  },
  
  // Orders - crítico para vendas
  'orders': {
    name: 'ml-orders',
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 45000,
    errorThresholdPercentage: 40
  },
  
  // Default para outros endpoints
  'default': {
    name: 'ml-api',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
    errorThresholdPercentage: 50
  }
}

/**
 * Circuit Breaker Manager para ML API
 */
export class MLCircuitBreakerManager {
  private static instance: MLCircuitBreakerManager
  private circuits: Map<string, CircuitBreaker> = new Map()
  private globalCircuit: CircuitBreaker
  
  private constructor() {
    // Circuit global para toda a API ML
    this.globalCircuit = new CircuitBreaker({
      name: 'ml-api-global',
      failureThreshold: 20,
      successThreshold: 5,
      timeout: 120000, // 2 minutos
      errorThresholdPercentage: 60
    })
    
    logger.info('[MLCircuitBreaker] Manager initialized')
  }
  
  static getInstance(): MLCircuitBreakerManager {
    if (!MLCircuitBreakerManager.instance) {
      MLCircuitBreakerManager.instance = new MLCircuitBreakerManager()
    }
    return MLCircuitBreakerManager.instance
  }
  
  /**
   * Obtém circuit breaker para endpoint específico
   */
  getCircuit(endpoint: string): CircuitBreaker {
    // Normaliza endpoint
    const key = this.getEndpointKey(endpoint)
    
    // Retorna circuit existente ou cria novo
    if (!this.circuits.has(key)) {
      const config = ML_CIRCUIT_CONFIGS[key] || ML_CIRCUIT_CONFIGS['default']
      this.circuits.set(key, new CircuitBreaker(config))
    }
    
    return this.circuits.get(key)!
  }
  
  /**
   * Executa chamada com proteção de circuit breaker
   */
  async executeWithProtection<T>(
    endpoint: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()
    
    try {
      // Verifica circuit global primeiro
      await this.globalCircuit.execute(async () => {
        // Verifica circuit específico do endpoint
        const circuit = this.getCircuit(endpoint)
        return circuit.execute(fn)
      })
      
      const result = await fn()
      
      // Registra sucesso
      const latency = Date.now() - startTime
      SLO.recordLatency(`ml:${endpoint}`, latency, 'api')
      
      return result
      
    } catch (error: any) {
      // Analisa tipo de erro para decidir se abre circuit
      const shouldOpen = this.shouldOpenCircuit(error)
      
      if (shouldOpen) {
        logger.error(`[MLCircuitBreaker] Opening circuit for ${endpoint}`, {
          error: error.message,
          statusCode: error.statusCode
        })
      }
      
      // Registra falha
      SLO.recordError(`ml:${endpoint}`, error, 'api')
      
      throw error
    }
  }
  
  /**
   * Decide se deve abrir o circuit baseado no erro
   */
  private shouldOpenCircuit(error: any): boolean {
    // 429 - Rate limit: sempre abre
    if (error.statusCode === 429) {
      return true
    }
    
    // 5xx - Erro no servidor ML: abre
    if (error.statusCode >= 500) {
      return true
    }
    
    // Timeout: abre
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
      return true
    }
    
    // 401/403 - Auth error: não abre (precisa refresh token)
    if (error.statusCode === 401 || error.statusCode === 403) {
      return false
    }
    
    // 400/404 - Client error: não abre
    if (error.statusCode === 400 || error.statusCode === 404) {
      return false
    }
    
    // Default: abre por segurança
    return true
  }
  
  /**
   * Normaliza endpoint para chave do circuit
   */
  private getEndpointKey(endpoint: string): string {
    if (endpoint.includes('oauth/token')) return 'oauth/token'
    if (endpoint.includes('/items/')) return 'items'
    if (endpoint.includes('/questions/')) return 'questions'
    if (endpoint.includes('/orders/')) return 'orders'
    if (endpoint.includes('/users/')) return 'users'
    return 'default'
  }
  
  /**
   * Obtém status de todos os circuits
   */
  getStatus(): Record<string, any> {
    const status: Record<string, any> = {
      global: this.globalCircuit.getStats(),
      endpoints: {}
    }
    
    for (const [key, circuit] of this.circuits) {
      status['endpoints'][key] = circuit.getStats()
    }
    
    return status
  }
  
  /**
   * Reset manual de um circuit (emergência)
   */
  resetCircuit(endpoint?: string): void {
    if (endpoint) {
      const circuit = this.circuits.get(this.getEndpointKey(endpoint))
      if (circuit) {
        circuit.reset()
        logger.info(`[MLCircuitBreaker] Reset circuit for ${endpoint}`)
      }
    } else {
      // Reset todos
      this.globalCircuit.reset()
      for (const circuit of this.circuits.values()) {
        circuit.reset()
      }
      logger.info('[MLCircuitBreaker] Reset all circuits')
    }
  }
  
  /**
   * Health check dos circuits
   */
  async healthCheck(): Promise<{
    healthy: boolean
    openCircuits: string[]
    totalRequests: number
    errorRate: number
  }> {
    const status = this.getStatus()
    const openCircuits: string[] = []
    let totalRequests = 0
    let totalErrors = 0
    
    // Verifica global
    if (status['global'].state === 'OPEN') {
      openCircuits.push('global')
    }
    totalRequests += status['global'].totalRequests || 0
    totalErrors += status['global'].failures || 0
    
    // Verifica endpoints
    for (const [endpoint, stats] of Object.entries(status['endpoints'])) {
      const endpointStats = stats as any
      if (endpointStats.state === 'OPEN') {
        openCircuits.push(endpoint)
      }
      totalRequests += endpointStats.totalRequests || 0
      totalErrors += endpointStats.failures || 0
    }
    
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0
    
    return {
      healthy: openCircuits.length === 0,
      openCircuits,
      totalRequests,
      errorRate
    }
  }
}

// Singleton export
export const mlCircuitBreaker = MLCircuitBreakerManager.getInstance()

// Helpers para uso direto
export const MLCircuit = {
  execute: <T>(endpoint: string, fn: () => Promise<T>) => 
    mlCircuitBreaker.executeWithProtection(endpoint, fn),
  status: () => mlCircuitBreaker.getStatus(),
  reset: (endpoint?: string) => mlCircuitBreaker.resetCircuit(endpoint),
  health: () => mlCircuitBreaker.healthCheck()
}