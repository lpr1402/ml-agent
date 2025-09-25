/**
 * Base para todas as APIs do Mercado Livre
 * Implementa autenticação, rate limiting e cache
 * Segue 100% as práticas oficiais da documentação ML
 */

import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { getAuthenticatedAccount } from '@/lib/api/session-auth'
import { withRateLimitRetry } from '@/lib/api/rate-limiter'
import { mlApiQueue } from '@/lib/api/sequential-queue'
import { CacheManager } from '@/lib/api/cache-manager'

export interface MLApiConfig {
  endpoint: string
  cache?: {
    enabled: boolean
    ttl?: number
    key?: string
  }
  circuit?: {
    name: string
    config?: any
  }
  rateLimit?: {
    maxRetries?: number
    initialDelay?: number
  }
}

export interface MLApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
  status?: number
  cached?: boolean
  retryAfter?: number
}

/**
 * Executa chamada autenticada para API do ML com todas as proteções
 */
export async function executeMLApiCall<T = any>(
  config: MLApiConfig,
  processData?: (data: any) => T
): Promise<NextResponse> {
  try {
    // 1. Verificar autenticação
    const auth = await getAuthenticatedAccount()
    
    if (!auth) {
      return NextResponse.json(
        { 
          error: 'Not authenticated',
          message: 'Please login with your Mercado Livre account'
        },
        { status: 401 }
      )
    }

    // 2. Preparar cache se configurado
    let cacheKey: string | null = null
    let cacheManager: CacheManager | null = null
    
    if (config.cache?.enabled) {
      cacheKey = config.cache.key || `${config.endpoint}:${auth.mlAccount.mlUserId}`
      cacheManager = new CacheManager(`ML-${config.endpoint}`)
      
      // Verificar cache
      const cached = cacheManager.get<T>(cacheKey)
      if (cached) {
        logger.info(`[MLApi] Cache HIT for ${config.endpoint}`)
        return NextResponse.json({
          ...cached,
          _cached: true,
          _cacheAge: Date.now()
        })
      }
    }

    // 3. Executar chamada com proteções
    const executeCall = async () => {
      // Construir URL completa
      const baseUrl = 'https://api.mercadolibre.com'
      const endpoint = config.endpoint.startsWith('/') ? config.endpoint : `/${config.endpoint}`
      const url = `${baseUrl}${endpoint}`
      
      // SEMPRE adicionar api_version=4 (substituir se já existir versão diferente)
      const urlObj = new URL(url)
      urlObj.searchParams.set('api_version', '4') // Força versão 4 sempre
      const finalUrl = urlObj.toString()

      logger.info(`[MLApi] Calling ${finalUrl}`)

      // Executar com rate limit retry
      const response = await withRateLimitRetry<any>(
        async () => {
          return await fetch(finalUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${auth.accessToken}`,
              'Accept': 'application/json',
              'X-Client-Id': process.env['ML_CLIENT_ID'] || '',
              'X-Request-Id': crypto.randomUUID()
            }
          })
        },
        config.rateLimit
      )

      // Processar dados se fornecido processador
      const result = processData ? processData(response) : response

      // Armazenar no cache se configurado
      if (cacheManager && cacheKey) {
        cacheManager.set(cacheKey, result, config.cache?.ttl)
      }

      return result
    }

    // Execute through sequential queue to avoid 429 errors
    const data = await mlApiQueue.add(executeCall)

    return NextResponse.json(data)

  } catch (error) {
    logger.error(`[MLApi] Error in ${config.endpoint}:`, { error })
    
    // Verificar tipo de erro
    if (error instanceof Error) {
      // Rate limit error
      if (error.message.includes('Rate limited') || error.message.includes('429')) {
        return NextResponse.json(
          {
            error: 'Rate limited',
            message: 'Too many requests. Please try again later.',
            retryAfter: 60
          },
          { status: 429 }
        )
      }
      
      // Circuit breaker open
      if (error.message.includes('Circuit breaker is OPEN')) {
        // Tentar retornar cache stale se disponível
        if (config.cache?.enabled && config.cache.key) {
          const cacheManager = new CacheManager(`ML-${config.endpoint}`)
          const stale = cacheManager.get(config.cache.key)
          if (stale) {
            return NextResponse.json({
              ...stale,
              _stale: true,
              _warning: 'Using stale data due to service unavailability'
            })
          }
        }
        
        return NextResponse.json(
          {
            error: 'Service unavailable',
            message: 'Service temporarily unavailable. Please try again later.',
            retryAfter: 60
          },
          { status: 503 }
        )
      }
      
      // Authentication error
      if (error.message.includes('Not authenticated') || error.message.includes('401')) {
        return NextResponse.json(
          {
            error: 'Authentication failed',
            message: 'Your session has expired. Please login again.'
          },
          { status: 401 }
        )
      }
      
      // Token expired
      if (error.message.includes('token') || error.message.includes('expired')) {
        return NextResponse.json(
          {
            error: 'Token expired',
            message: 'Your access token has expired. Please login again.'
          },
          { status: 401 }
        )
      }
    }
    
    // Generic error
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}

/**
 * Batch execute múltiplas chamadas em paralelo
 */
export async function batchMLApiCalls<T = any>(
  calls: Array<{
    config: MLApiConfig
    processor?: (data: any) => any
  }>,
  options?: {
    maxConcurrent?: number
    failFast?: boolean
  }
): Promise<Array<T | Error>> {
  // IMPORTANT: Limit to 1 concurrent request to avoid ML rate limiting
  const maxConcurrent = options?.maxConcurrent || 1
  const failFast = options?.failFast || false
  
  const results: Array<T | Error> = []
  const queue = [...calls]
  
  // Execute one by one with proper delays
  while (queue.length > 0) {
    const batch = queue.splice(0, maxConcurrent)
    
    // Process each call sequentially with delay
    for (const call of batch) {
      try {
        // Minimal delay to prevent hammering (removed artificial 500ms delay)
        // Rate limiting is handled by middleware and circuit breakers
        if (results.length > 0) {
          // Small 50ms delay just to be polite to ML API
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        
        const response = await executeMLApiCall(call.config, call.processor)
        const data = await response.json()
        results.push(data)
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        results.push(err)
        
        if (failFast) {
          throw err
        }
        
        // If rate limited, wait longer before next request
        if (err.message.includes('429') || err.message.includes('Rate limited')) {
          logger.info('[BatchML] Rate limited, waiting 2s before next request')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    }
    
    // Longer delay between batches
    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  return results
}

/**
 * Helper para construir query strings
 */
export function buildQueryString(params: Record<string, any>): string {
  const validParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  
  return validParams.length > 0 ? `?${validParams.join('&')}` : ''
}

/**
 * Helper para validar resposta da API
 */
export function validateMLResponse(response: any): boolean {
  if (!response) return false
  
  // Verificar se é erro conhecido do ML
  if (response.error || response.message?.includes('error')) {
    return false
  }
  
  // Verificar se tem estrutura válida
  if (response.status && response.status >= 400) {
    return false
  }
  
  return true
}

/**
 * Helper para extrair erro da resposta
 */
export function extractMLError(response: any): string {
  if (response.message) return response.message
  if (response.error) return response.error
  if (response.cause) return response.cause
  if (response.status === 429) return 'Rate limit exceeded'
  if (response.status === 401) return 'Authentication required'
  if (response.status === 403) return 'Access denied'
  if (response.status === 404) return 'Resource not found'
  if (response.status >= 500) return 'Service unavailable'
  return 'Unknown error occurred'
}