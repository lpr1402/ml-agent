/**
 * Rate Limiter Especializado para OAuth Token Exchange
 * Controle global usando Redis para evitar erro 429
 */

import { logger } from '@/lib/logger'
import Redis from 'ioredis'

// Configuração Redis
const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379'
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) return null
    return Math.min(times * 100, 3000)
  }
})

// Configurações específicas para OAuth
const OAUTH_CONFIG = {
  GLOBAL_WINDOW_MS: 60000,      // Janela de 1 minuto
  MAX_REQUESTS_PER_WINDOW: 10,  // Máximo 10 requests por minuto (muito conservador)
  MIN_INTERVAL_MS: 6000,        // Mínimo 6 segundos entre requests
  BACKOFF_MS: 30000,            // Backoff de 30 segundos após 429
  LOCK_TTL_MS: 10000,            // Lock expira em 10 segundos
  CACHE_PREFIX: 'ml:oauth:',
}

/**
 * Adquire um lock exclusivo para fazer token exchange
 */
async function acquireLock(key: string): Promise<boolean> {
  try {
    const lockKey = `${OAUTH_CONFIG.CACHE_PREFIX}lock:${key}`
    const result = await redis.set(
      lockKey,
      '1',
      'PX',
      OAUTH_CONFIG.LOCK_TTL_MS,
      'NX'
    )
    return result === 'OK'
  } catch (error) {
    logger.error('[OAuthRateLimiter] Failed to acquire lock', { error })
    return false
  }
}

/**
 * Libera o lock
 */
async function releaseLock(key: string): Promise<void> {
  try {
    const lockKey = `${OAUTH_CONFIG.CACHE_PREFIX}lock:${key}`
    await redis.del(lockKey)
  } catch (error) {
    logger.error('[OAuthRateLimiter] Failed to release lock', { error })
  }
}

/**
 * Verifica se está em período de backoff após erro 429
 */
async function isInBackoff(): Promise<boolean> {
  try {
    const backoffKey = `${OAUTH_CONFIG.CACHE_PREFIX}backoff`
    const backoffUntil = await redis.get(backoffKey)

    if (backoffUntil) {
      const now = Date.now()
      const backoffTime = parseInt(backoffUntil)

      if (backoffTime > now) {
        logger.info('[OAuthRateLimiter] Still in backoff period', {
          remainingMs: backoffTime - now
        })
        return true
      }
    }

    return false
  } catch (error) {
    logger.error('[OAuthRateLimiter] Failed to check backoff', { error })
    return false
  }
}

/**
 * Define período de backoff após erro 429
 */
async function setBackoff(durationMs: number = OAUTH_CONFIG.BACKOFF_MS): Promise<void> {
  try {
    const backoffKey = `${OAUTH_CONFIG.CACHE_PREFIX}backoff`
    const backoffUntil = Date.now() + durationMs

    await redis.set(
      backoffKey,
      backoffUntil.toString(),
      'PX',
      durationMs
    )

    logger.info('[OAuthRateLimiter] Backoff period set', {
      durationMs,
      until: new Date(backoffUntil).toISOString()
    })
  } catch (error) {
    logger.error('[OAuthRateLimiter] Failed to set backoff', { error })
  }
}

/**
 * Verifica e atualiza contador de requisições
 */
async function checkAndUpdateRateLimit(): Promise<{ allowed: boolean; waitMs?: number }> {
  try {
    const now = Date.now()
    const windowStart = Math.floor(now / OAUTH_CONFIG.GLOBAL_WINDOW_MS) * OAUTH_CONFIG.GLOBAL_WINDOW_MS
    const windowKey = `${OAUTH_CONFIG.CACHE_PREFIX}window:${windowStart}`
    const lastRequestKey = `${OAUTH_CONFIG.CACHE_PREFIX}last_request`

    // Verificar último request
    const lastRequest = await redis.get(lastRequestKey)
    if (lastRequest) {
      const timeSinceLastRequest = now - parseInt(lastRequest)
      if (timeSinceLastRequest < OAUTH_CONFIG.MIN_INTERVAL_MS) {
        const waitMs = OAUTH_CONFIG.MIN_INTERVAL_MS - timeSinceLastRequest
        logger.info('[OAuthRateLimiter] Too soon since last request', {
          waitMs,
          timeSinceLastRequest
        })
        return { allowed: false, waitMs }
      }
    }

    // Verificar contador da janela
    const count = await redis.incr(windowKey)

    // Definir expiração na primeira requisição da janela
    if (count === 1) {
      await redis.pexpire(windowKey, OAUTH_CONFIG.GLOBAL_WINDOW_MS)
    }

    if (count > OAUTH_CONFIG.MAX_REQUESTS_PER_WINDOW) {
      const waitMs = windowStart + OAUTH_CONFIG.GLOBAL_WINDOW_MS - now
      logger.warn('[OAuthRateLimiter] Rate limit exceeded', {
        count,
        max: OAUTH_CONFIG.MAX_REQUESTS_PER_WINDOW,
        waitMs
      })

      // Decrementar contador já que não vamos fazer a request
      await redis.decr(windowKey)

      return { allowed: false, waitMs }
    }

    // Atualizar último request
    await redis.set(lastRequestKey, now.toString(), 'PX', OAUTH_CONFIG.MIN_INTERVAL_MS)

    logger.info('[OAuthRateLimiter] Request allowed', {
      count,
      max: OAUTH_CONFIG.MAX_REQUESTS_PER_WINDOW
    })

    return { allowed: true }
  } catch (error) {
    logger.error('[OAuthRateLimiter] Failed to check rate limit', { error })
    // Em caso de erro do Redis, permite a request mas com delay
    return { allowed: true, waitMs: OAUTH_CONFIG.MIN_INTERVAL_MS }
  }
}

/**
 * Wrapper para fazer token exchange com rate limiting global
 */
export async function oauthTokenExchange(
  url: string,
  options: RequestInit
): Promise<Response> {
  const lockKey = 'token_exchange'
  let lockAcquired = false

  try {
    // 1. Verificar se está em backoff
    if (await isInBackoff()) {
      const backoffKey = `${OAUTH_CONFIG.CACHE_PREFIX}backoff`
      const backoffUntil = await redis.get(backoffKey)
      const remainingMs = backoffUntil ? parseInt(backoffUntil) - Date.now() : OAUTH_CONFIG.BACKOFF_MS

      return new Response(
        JSON.stringify({
          error: 'rate_limit',
          error_description: `Rate limited. Please wait ${Math.ceil(remainingMs / 1000)} seconds before trying again.`,
          retry_after: Math.ceil(remainingMs / 1000)
        }),
        {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            'Retry-After': Math.ceil(remainingMs / 1000).toString()
          }
        }
      )
    }

    // 2. Adquirir lock exclusivo
    lockAcquired = await acquireLock(lockKey)
    if (!lockAcquired) {
      logger.info('[OAuthRateLimiter] Failed to acquire lock, another request in progress')

      // Aguardar um pouco e retornar erro para cliente tentar novamente
      await new Promise(resolve => setTimeout(resolve, 2000))

      return new Response(
        JSON.stringify({
          error: 'temporarily_unavailable',
          error_description: 'Another authentication in progress. Please try again in a moment.'
        }),
        { status: 503, statusText: 'Service Temporarily Unavailable' }
      )
    }

    // 3. Verificar rate limit
    const { allowed, waitMs } = await checkAndUpdateRateLimit()

    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: 'rate_limit',
          error_description: `Rate limited. Please wait ${Math.ceil((waitMs || 0) / 1000)} seconds.`,
          retry_after: Math.ceil((waitMs || 0) / 1000)
        }),
        {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            'Retry-After': Math.ceil((waitMs || 0) / 1000).toString()
          }
        }
      )
    }

    // 4. Fazer a request real
    logger.info('[OAuthRateLimiter] Making token exchange request')
    const response = await fetch(url, options)

    // 5. Processar resposta
    if (response.status === 429) {
      // ML retornou 429, aplicar backoff longo
      const retryAfter = response.headers.get('Retry-After')
      const backoffMs = retryAfter
        ? parseInt(retryAfter) * 1000
        : OAUTH_CONFIG.BACKOFF_MS

      await setBackoff(backoffMs)

      logger.error('[OAuthRateLimiter] ML API returned 429', {
        backoffMs,
        retryAfter
      })
    } else if (response.ok) {
      logger.info('[OAuthRateLimiter] Token exchange successful')
    }

    return response

  } catch (error) {
    logger.error('[OAuthRateLimiter] Unexpected error', { error })

    // Retornar erro genérico
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        error_description: 'An unexpected error occurred. Please try again.'
      }),
      { status: 500, statusText: 'Internal Server Error' }
    )

  } finally {
    // Sempre liberar o lock
    if (lockAcquired) {
      await releaseLock(lockKey)
    }
  }
}

/**
 * Limpa o estado de rate limiting (útil para testes)
 */
export async function clearOAuthRateLimit(): Promise<void> {
  try {
    const keys = await redis.keys(`${OAUTH_CONFIG.CACHE_PREFIX}*`)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    logger.info('[OAuthRateLimiter] Rate limit state cleared')
  } catch (error) {
    logger.error('[OAuthRateLimiter] Failed to clear rate limit', { error })
  }
}

/**
 * Obtém status atual do rate limiting
 */
export async function getOAuthRateLimitStatus(): Promise<{
  inBackoff: boolean
  backoffRemainingMs?: number
  requestsInWindow?: number
  windowRemainingMs?: number
}> {
  try {
    const now = Date.now()
    const windowStart = Math.floor(now / OAUTH_CONFIG.GLOBAL_WINDOW_MS) * OAUTH_CONFIG.GLOBAL_WINDOW_MS
    const windowKey = `${OAUTH_CONFIG.CACHE_PREFIX}window:${windowStart}`
    const backoffKey = `${OAUTH_CONFIG.CACHE_PREFIX}backoff`

    const [backoffUntil, windowCount] = await Promise.all([
      redis.get(backoffKey),
      redis.get(windowKey)
    ])

    const status: any = {
      inBackoff: false
    }

    if (backoffUntil) {
      const backoffTime = parseInt(backoffUntil)
      if (backoffTime > now) {
        status.inBackoff = true
        status.backoffRemainingMs = backoffTime - now
      }
    }

    if (windowCount) {
      status.requestsInWindow = parseInt(windowCount)
      status.windowRemainingMs = windowStart + OAUTH_CONFIG.GLOBAL_WINDOW_MS - now
    }

    return status
  } catch (error) {
    logger.error('[OAuthRateLimiter] Failed to get status', { error })
    return { inBackoff: false }
  }
}

// Exportar configuração para referência
export { OAUTH_CONFIG }