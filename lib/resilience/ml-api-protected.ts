/**
 * ML API Client with Circuit Breaker Protection
 * Production-ready wrapper for Mercado Livre API calls
 * Garante resiliência e alta disponibilidade
 */

import { circuitBreakers, withCircuitBreaker } from './circuit-breaker'
import { logger } from '@/lib/logger'
import { cache } from '@/lib/redis'
import { decryptToken } from '@/lib/security/encryption'
import { prisma } from '@/lib/prisma'

// Tipos de resposta da API
interface MLApiResponse<T = any> {
  data?: T
  error?: string
  status: number
  cached?: boolean
  fallback?: boolean
}

// Configuração de retry
interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  factor: number
}

// Opções de request
interface MLApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: any
  headers?: Record<string, string>
  timeout?: number
  useCache?: boolean
  cacheTTL?: number
  fallbackData?: any
  retryConfig?: Partial<RetryConfig>
  accountId?: string // Para requests multi-conta
}

/**
 * ML API Client com proteção Circuit Breaker
 */
export class MLApiProtected {
  private readonly baseUrl = 'https://api.mercadolibre.com'
  private readonly defaultTimeout = 10000 // 10 segundos
  private readonly defaultCacheTTL = 300 // 5 minutos

  private readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    factor: 2
  }

  /**
   * Fazer request protegido à API do ML
   */
  async request<T = any>(
    endpoint: string,
    mlUserId: string,
    options: MLApiRequestOptions = {}
  ): Promise<MLApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers = {},
      timeout = this.defaultTimeout,
      useCache = true,
      cacheTTL = this.defaultCacheTTL,
      fallbackData,
      retryConfig = {},
      accountId
    } = options

    const finalRetryConfig = { ...this.defaultRetryConfig, ...retryConfig }
    const url = `${this.baseUrl}${endpoint}`
    const cacheKey = `ml:api:${mlUserId}:${endpoint}:${JSON.stringify(body || {})}`

    try {
      // Tentar cache primeiro para GET
      if (method === 'GET' && useCache) {
        const cached = await this.getCached<T>(cacheKey)
        if (cached) {
          logger.debug('[MLApiProtected] Cache hit', { endpoint, mlUserId })
          return { data: cached, status: 200, cached: true }
        }
      }

      // Buscar token do usuário/conta
      const token = await this.getToken(mlUserId, accountId)
      if (!token) {
        throw new Error(`No valid token for user ${mlUserId}`)
      }

      // Executar com Circuit Breaker
      const result = await withCircuitBreaker(
        circuitBreakers.mlApi,
        () => this.executeRequest<T>(url, token, {
          method,
          body,
          headers,
          timeout,
          retryConfig: finalRetryConfig
        })
      )

      // Cachear resultado bem-sucedido
      if (method === 'GET' && useCache && result.data) {
        await this.setCache(cacheKey, result.data, cacheTTL)
      }

      return result

    } catch (error: any) {
      logger.error('[MLApiProtected] Request failed', {
        endpoint,
        mlUserId,
        error: error.message
      })

      // Tentar fallback
      if (fallbackData) {
        logger.info('[MLApiProtected] Using fallback data', { endpoint })
        return { data: fallbackData, status: 200, fallback: true }
      }

      // Tentar cache expirado como último recurso
      if (method === 'GET' && useCache) {
        const staleCache = await this.getCached<T>(cacheKey, true)
        if (staleCache) {
          logger.warn('[MLApiProtected] Using stale cache', { endpoint })
          return { data: staleCache, status: 200, cached: true, fallback: true }
        }
      }

      return { error: error.message, status: error.status || 500 }
    }
  }

  /**
   * Executar request com retry exponencial
   */
  private async executeRequest<T>(
    url: string,
    token: string,
    options: {
      method: string
      body?: any
      headers: Record<string, string>
      timeout: number
      retryConfig: RetryConfig
    }
  ): Promise<MLApiResponse<T>> {
    const { method, body, headers, timeout, retryConfig } = options
    let lastError: any

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        // Criar AbortController para timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...headers
          },
          body: body ? JSON.stringify(body) : null,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        // Verificar rate limit
        if (response.status === 429) {
          const retryAfter = response.headers.get('X-Rate-Limit-Reset') || '60'
          const delay = parseInt(retryAfter) * 1000

          logger.warn('[MLApiProtected] Rate limited', {
            url,
            retryAfter: delay,
            attempt
          })

          // Esperar e tentar novamente se não for última tentativa
          if (attempt < retryConfig.maxAttempts) {
            await this.delay(Math.min(delay, retryConfig.maxDelay))
            continue
          }
        }

        // Verificar token expirado
        if (response.status === 401) {
          logger.error('[MLApiProtected] Token expired', { url })
          throw new Error('ML token expired')
        }

        // Parse response
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || `HTTP ${response.status}`)
        }

        return { data, status: response.status }

      } catch (error: any) {
        lastError = error

        // Se for erro de abort (timeout), não retry
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeout}ms`)
        }

        // Calcular delay para retry
        if (attempt < retryConfig.maxAttempts) {
          const delay = Math.min(
            retryConfig.baseDelay * Math.pow(retryConfig.factor, attempt - 1),
            retryConfig.maxDelay
          )

          logger.warn('[MLApiProtected] Retrying request', {
            url,
            attempt,
            delay,
            error: error.message
          })

          await this.delay(delay)
        }
      }
    }

    throw lastError
  }

  /**
   * Batch requests com proteção individual
   */
  async batchRequest<T = any>(
    requests: Array<{
      endpoint: string
      mlUserId: string
      options?: MLApiRequestOptions
    }>,
    options: {
      concurrency?: number
      continueOnError?: boolean
    } = {}
  ): Promise<Array<MLApiResponse<T>>> {
    const { concurrency = 5, continueOnError = true } = options
    const results: Array<MLApiResponse<T>> = []

    // Processar em lotes
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency)

      const promises = batch.map(async (req) => {
        try {
          return await this.request<T>(req.endpoint, req.mlUserId, req.options)
        } catch (error: any) {
          if (!continueOnError) throw error
          return { error: error.message, status: 500 }
        }
      })

      const batchResults = await Promise.all(promises)
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Buscar token descriptografado
   */
  private async getToken(mlUserId: string, accountId?: string): Promise<string | null> {
    try {
      // Buscar conta ML
      const account = await prisma.mLAccount.findFirst({
        where: accountId ? { id: accountId } : { mlUserId },
        select: {
          accessToken: true,
          accessTokenIV: true,
          accessTokenTag: true,
          tokenExpiresAt: true
        }
      })

      if (!account) {
        logger.error('[MLApiProtected] ML account not found', { mlUserId, accountId })
        return null
      }

      // Verificar expiração
      if (new Date() >= account.tokenExpiresAt) {
        logger.warn('[MLApiProtected] Token expired', { mlUserId })
        // TODO: Implementar refresh automático
        return null
      }

      // Descriptografar token
      return decryptToken({
        encrypted: account.accessToken,
        iv: account.accessTokenIV!,
        authTag: account.accessTokenTag!
      })

    } catch (error: any) {
      logger.error('[MLApiProtected] Failed to get token', {
        mlUserId,
        error: error.message
      })
      return null
    }
  }

  /**
   * Buscar do cache
   */
  private async getCached<T>(key: string, allowStale = false): Promise<T | null> {
    try {
      const cached = await cache.get<T>(key)
      if (!cached) return null

      // Se for um objeto com expires, verificar TTL
      if (typeof cached === 'object' && 'expires' in cached && !allowStale) {
        const data = cached as any
        if (data.expires && Date.now() > data.expires) {
          return null
        }
        return data.value as T
      }

      return cached

    } catch (_error) {
      logger.debug('[MLApiProtected] Cache miss', { key })
      return null
    }
  }

  /**
   * Salvar no cache
   */
  private async setCache<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      const data = {
        value,
        expires: Date.now() + (ttl * 1000),
        cached: true
      }

      await cache.set(key, data, ttl)

    } catch (_error) {
      logger.debug('[MLApiProtected] Failed to cache', { key })
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Health check para ML API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/MLB`, {
        method: 'GET',
        timeout: 5000
      } as any)

      return response.ok
    } catch {
      return false
    }
  }
}

// Singleton instance
export const mlApiProtected = new MLApiProtected()

// Helper functions para endpoints comuns
export const mlApiHelpers = {
  /**
   * Buscar dados do usuário
   */
  async getUser(mlUserId: string): Promise<MLApiResponse> {
    return mlApiProtected.request(
      `/users/${mlUserId}`,
      mlUserId,
      { useCache: true, cacheTTL: 3600 } // Cache 1 hora
    )
  },

  /**
   * Buscar perguntas
   */
  async getQuestions(mlUserId: string, status = 'UNANSWERED'): Promise<MLApiResponse> {
    return mlApiProtected.request(
      `/questions/search?seller_id=${mlUserId}&status=${status}`,
      mlUserId,
      { useCache: true, cacheTTL: 60 } // Cache 1 minuto
    )
  },

  /**
   * Responder pergunta
   */
  async answerQuestion(
    mlUserId: string,
    questionId: string,
    answer: string
  ): Promise<MLApiResponse> {
    return mlApiProtected.request(
      '/answers',
      mlUserId,
      {
        method: 'POST',
        body: { question_id: questionId, text: answer },
        useCache: false
      }
    )
  },

  /**
   * Buscar itens do vendedor
   */
  async getItems(mlUserId: string): Promise<MLApiResponse> {
    return mlApiProtected.request(
      `/users/${mlUserId}/items/search`,
      mlUserId,
      { useCache: true, cacheTTL: 300 } // Cache 5 minutos
    )
  },

  /**
   * Buscar métricas de vendas
   */
  async getSalesMetrics(mlUserId: string, period = '30days'): Promise<MLApiResponse> {
    return mlApiProtected.request(
      `/users/${mlUserId}/sales/metrics?period=${period}`,
      mlUserId,
      {
        useCache: true,
        cacheTTL: 1800, // Cache 30 minutos
        fallbackData: { // Dados de fallback se API falhar
          total_sales: 0,
          pending_sales: 0,
          completed_sales: 0
        }
      }
    )
  },

  /**
   * Buscar reputação
   */
  async getReputation(mlUserId: string): Promise<MLApiResponse> {
    return mlApiProtected.request(
      `/users/${mlUserId}/reputation`,
      mlUserId,
      {
        useCache: true,
        cacheTTL: 3600, // Cache 1 hora
        fallbackData: {
          level_id: 'green',
          power_seller_status: null
        }
      }
    )
  }
}

export default mlApiProtected