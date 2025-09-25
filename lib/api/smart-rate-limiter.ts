/**
 * Rate Limiter Inteligente com Exponential Backoff
 * Evita delays desnecessários e implementa retry automático
 */

import { logger } from '@/lib/logger'

interface RateLimitState {
  lastRequest: number
  retryCount: number
  lastError?: number
  backoffUntil?: number
}

// Estado global de rate limiting por endpoint
const rateLimitStates = new Map<string, RateLimitState>()

// Configurações por endpoint
const ENDPOINT_CONFIGS = {
  'oauth/token': {
    minInterval: 1000,      // Mínimo 1s entre requests
    maxRetries: 3,
    initialBackoff: 1000,   // Começa com 1s
    maxBackoff: 10000,      // Máximo 10s
    resetAfter: 60000       // Reset estado após 1 minuto
  },
  'users/me': {
    minInterval: 500,
    maxRetries: 3,
    initialBackoff: 500,
    maxBackoff: 5000,
    resetAfter: 30000
  },
  'default': {
    minInterval: 100,
    maxRetries: 3,
    initialBackoff: 1000,
    maxBackoff: 8000,
    resetAfter: 30000
  }
}

/**
 * Calcula delay necessário baseado no estado atual
 */
export function calculateDelay(endpoint: string): number {
  const config = ENDPOINT_CONFIGS[endpoint as keyof typeof ENDPOINT_CONFIGS] || ENDPOINT_CONFIGS.default
  const state = rateLimitStates.get(endpoint)
  
  if (!state) {
    // Primeira request, sem delay
    return 0
  }
  
  const now = Date.now()
  
  // Se está em backoff, retorna tempo restante
  if (state.backoffUntil && state.backoffUntil > now) {
    return state.backoffUntil - now
  }
  
  // Verifica intervalo mínimo entre requests
  const timeSinceLastRequest = now - state.lastRequest
  if (timeSinceLastRequest < config.minInterval) {
    return config.minInterval - timeSinceLastRequest
  }
  
  // Sem delay necessário
  return 0
}

/**
 * Registra uma request bem-sucedida
 */
export function recordSuccess(endpoint: string) {
  const now = Date.now()
  const state = rateLimitStates.get(endpoint)
  
  if (state) {
    // Reset retry count em sucesso
    state.retryCount = 0
    state.lastRequest = now
    delete state.backoffUntil
    delete state.lastError
  } else {
    // Primeira request bem-sucedida
    rateLimitStates.set(endpoint, {
      lastRequest: now,
      retryCount: 0
    })
  }
  
  // Limpar estados antigos
  cleanupOldStates()
}

/**
 * Registra um erro 429 (rate limit)
 */
export function recordRateLimit(endpoint: string, retryAfter?: number) {
  const config = ENDPOINT_CONFIGS[endpoint as keyof typeof ENDPOINT_CONFIGS] || ENDPOINT_CONFIGS.default
  const now = Date.now()
  const state = rateLimitStates.get(endpoint) || { lastRequest: now, retryCount: 0 }
  
  state.retryCount++
  state.lastError = now
  
  // Calcular backoff exponencial
  const backoffTime = retryAfter 
    ? retryAfter * 1000  // Usar header Retry-After se disponível
    : Math.min(
        config.initialBackoff * Math.pow(2, state.retryCount - 1),
        config.maxBackoff
      )
  
  state.backoffUntil = now + backoffTime
  
  rateLimitStates.set(endpoint, state)
  
  logger.info('[RateLimiter] Rate limit hit', {
    endpoint,
    retryCount: state.retryCount,
    backoffMs: backoffTime
  })
  
  return backoffTime
}

/**
 * Verifica se deve fazer retry
 */
export function shouldRetry(endpoint: string): boolean {
  const config = ENDPOINT_CONFIGS[endpoint as keyof typeof ENDPOINT_CONFIGS] || ENDPOINT_CONFIGS.default
  const state = rateLimitStates.get(endpoint)
  
  if (!state) return true
  
  return state.retryCount < config.maxRetries
}

/**
 * Limpa estados antigos para evitar memory leak
 */
function cleanupOldStates() {
  const now = Date.now()
  
  for (const [endpoint, state] of rateLimitStates.entries()) {
    const config = ENDPOINT_CONFIGS[endpoint as keyof typeof ENDPOINT_CONFIGS] || ENDPOINT_CONFIGS.default
    
    // Remove estados sem atividade recente
    if (now - state.lastRequest > config.resetAfter) {
      rateLimitStates.delete(endpoint)
    }
  }
}

/**
 * Wrapper para fazer request com rate limiting inteligente
 */
export async function fetchWithRateLimit(
  url: string,
  options: RequestInit,
  endpoint?: string
): Promise<Response> {
  // Extrair endpoint da URL se não fornecido - garantir que nunca é undefined
  const endpointKey = endpoint || url.replace(/^https?:\/\/[^\/]+\//, '').split('?')[0]

  // TypeScript assertion - endpointKey nunca será undefined aqui
  if (!endpointKey) {
    throw new Error('Failed to extract endpoint from URL')
  }

  // Calcular e aplicar delay se necessário
  const delay = calculateDelay(endpointKey)
  if (delay > 0) {
    logger.debug(`[RateLimiter] Waiting ${delay}ms before request to ${endpointKey}`)
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  let lastError: any = null
  let retryCount = 0
  const config = ENDPOINT_CONFIGS[endpointKey as keyof typeof ENDPOINT_CONFIGS] || ENDPOINT_CONFIGS.default

  while (retryCount <= config.maxRetries) {
    try {
      // Fazer a request
      const response = await fetch(url, options)

      // Log detalhado para debug
      if (!response.ok) {
        const responseText = await response.text()
        let errorData: any
        try {
          errorData = responseText ? JSON.parse(responseText) : {}
        } catch (_e) {
          errorData = { message: responseText }
        }

        logger.error(`[RateLimiter] Request failed for ${endpointKey}`, {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          retryCount,
          url: url.replace(/client_secret=[^&]+/, 'client_secret=***')
        })

        // Processar resposta baseado no status real
        if (response.status === 429) {
          // Rate limit real atingido
          const retryAfter = response.headers.get('Retry-After')
          const backoffTime = recordRateLimit(endpointKey, retryAfter ? parseInt(retryAfter) : undefined)

          if (retryCount < config.maxRetries) {
            logger.info(`[RateLimiter] Rate limit 429 detected. Retrying after ${backoffTime}ms`)
            await new Promise(resolve => setTimeout(resolve, backoffTime))
            retryCount++
            continue
          } else {
            logger.warn(`[RateLimiter] Max retries reached for ${endpointKey}`)
            // Retornar a resposta original com o erro
            return new Response(JSON.stringify(errorData), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            })
          }
        } else {
          // Não é rate limit, retornar erro original
          return new Response(JSON.stringify(errorData), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          })
        }
      }

      // Request bem-sucedida
      recordSuccess(endpointKey)
      return response

    } catch (error) {
      lastError = error
      logger.error(`[RateLimiter] Network error for ${endpointKey}`, {
        error,
        retryCount,
        url: url.replace(/client_secret=[^&]+/, 'client_secret=***')
      })

      if (retryCount < config.maxRetries) {
        const backoffTime = config.initialBackoff * Math.pow(2, retryCount)
        logger.info(`[RateLimiter] Network error. Retrying after ${backoffTime}ms`)
        await new Promise(resolve => setTimeout(resolve, backoffTime))
        retryCount++
        continue
      }
      break
    }
  }

  // Se chegou aqui, esgotou os retries
  throw lastError || new Error(`Failed to complete request to ${endpointKey} after ${retryCount} retries`)
}

/**
 * Reset manual do estado de um endpoint (útil para testes)
 */
export function resetEndpointState(endpoint: string) {
  rateLimitStates.delete(endpoint)
}

/**
 * Obter estado atual de um endpoint (para debug)
 */
export function getEndpointState(endpoint: string): RateLimitState | undefined {
  return rateLimitStates.get(endpoint)
}

// Exportar utilitários
export const SmartRateLimiter = {
  fetch: fetchWithRateLimit,
  calculateDelay,
  recordSuccess,
  recordRateLimit,
  shouldRetry,
  reset: resetEndpointState,
  getState: getEndpointState
}