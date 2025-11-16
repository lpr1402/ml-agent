/**
 * OAuth Manager - Sistema Robusto de Autenticação
 * Gerencia tokens, estados e rate limiting de forma inteligente
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { getRedisClient } from '@/lib/redis'
import crypto from 'crypto'

// ✅ FIX: Usar singleton Redis (evita duplicação de conexões)
const redis = getRedisClient()

// Configurações
const CONFIG = {
  // OAuth State
  STATE_TTL_SECONDS: 1800, // 30 minutos para completar OAuth (aumentado para evitar InvalidState)
  STATE_CLEANUP_INTERVAL_MS: 60000, // Limpar a cada minuto

  // Token Cache
  TOKEN_CACHE_TTL_SECONDS: 300, // Cache tokens por 5 minutos

  // Rate Limiting
  MIN_REQUEST_INTERVAL_MS: 5000, // Mínimo 5 segundos entre requests (aumentado para evitar rate limit)
  MAX_RETRIES: 5, // Mais tentativas com backoff maior
  RETRY_DELAY_MS: [5000, 10000, 20000, 40000, 60000], // Backoff exponencial mais conservador

  // Prefixes
  CACHE_PREFIX: 'oauth:',
  STATE_PREFIX: 'state:',
  TOKEN_PREFIX: 'token:',
  LOCK_PREFIX: 'lock:',
}

export class OAuthManager {
  private static instance: OAuthManager
  private cleanupInterval: NodeJS.Timeout | null = null

  private constructor() {
    this.startCleanupJob()
  }

  public static getInstance(): OAuthManager {
    if (!OAuthManager.instance) {
      OAuthManager.instance = new OAuthManager()
    }
    return OAuthManager.instance
  }

  /**
   * Cria um novo OAuth state com proteção contra duplicatas
   */
  async createOAuthState(organizationId?: string, isPrimaryLogin: boolean = true): Promise<{
    state: string
    codeVerifier: string
  }> {
    // Limpar states antigos primeiro
    await this.cleanupExpiredStates()

    // Gerar PKCE
    const state = crypto.randomBytes(32).toString('base64url')
    const codeVerifier = crypto.randomBytes(32).toString('base64url')

    // Salvar no banco com expiração
    const expiresAt = new Date(Date.now() + CONFIG.STATE_TTL_SECONDS * 1000)

    try {
      await prisma.oAuthState.create({
        data: {
          state,
          codeVerifier,
          organizationId: organizationId || null,
          isPrimaryLogin,
          expiresAt,
          createdAt: new Date()
        }
      })

      // Cache no Redis também para acesso rápido
      await redis.setex(
        `${CONFIG.CACHE_PREFIX}${CONFIG.STATE_PREFIX}${state}`,
        CONFIG.STATE_TTL_SECONDS,
        JSON.stringify({ codeVerifier, organizationId, isPrimaryLogin })
      )

      logger.info('[OAuthManager] Created OAuth state', {
        isPrimaryLogin,
        organizationId,
        expiresAt
      })

      return { state, codeVerifier }
    } catch (error) {
      logger.error('[OAuthManager] Failed to create OAuth state', { error })
      throw error
    }
  }

  /**
   * Valida e consome OAuth state (uso único)
   */
  async validateAndConsumeState(state: string): Promise<{
    codeVerifier: string
    organizationId?: string | undefined
    isPrimaryLogin: boolean
  } | null> {
    // Tentar do cache primeiro
    const cacheKey = `${CONFIG.CACHE_PREFIX}${CONFIG.STATE_PREFIX}${state}`
    const cached = await redis.get(cacheKey)

    if (cached) {
      // Deletar do cache imediatamente (uso único)
      await redis.del(cacheKey)

      // Deletar do banco também
      await prisma.oAuthState.delete({
        where: { state }
      }).catch(() => {})

      return JSON.parse(cached)
    }

    // Se não está no cache, buscar do banco
    const oauthState = await prisma.oAuthState.findUnique({
      where: { state }
    })

    if (!oauthState) {
      logger.warn('[OAuthManager] Invalid OAuth state', { state })
      return null
    }

    // Validar expiração
    if (oauthState.expiresAt < new Date()) {
      logger.warn('[OAuthManager] Expired OAuth state', {
        state,
        expiresAt: oauthState.expiresAt
      })

      // Limpar state expirado
      await prisma.oAuthState.delete({
        where: { state }
      }).catch(() => {})

      return null
    }

    // Deletar imediatamente (uso único)
    await prisma.oAuthState.delete({
      where: { state }
    }).catch(() => {})

    const result: any = {
      codeVerifier: oauthState.codeVerifier,
      isPrimaryLogin: oauthState.isPrimaryLogin
    }

    if (oauthState.organizationId) {
      result.organizationId = oauthState.organizationId
    }

    return result
  }

  /**
   * Tenta fazer token exchange com retry inteligente
   */
  async exchangeCodeForToken(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<any> {
    const APP_ID = process.env['ML_CLIENT_ID']!
    const SECRET = process.env['ML_CLIENT_SECRET']!

    // Check rate limit
    const canProceed = await this.checkRateLimit('token_exchange')
    if (!canProceed) {
      logger.warn('[OAuthManager] Rate limit hit, waiting...')
      await this.delay(CONFIG.MIN_REQUEST_INTERVAL_MS)
    }

    let lastError: any = null

    for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = CONFIG.RETRY_DELAY_MS[attempt - 1] || 12000
        logger.info(`[OAuthManager] Retry attempt ${attempt + 1} after ${delay}ms`)
        await this.delay(delay)
      }

      try {
        // Marcar tentativa no rate limiter
        await this.markRequest('token_exchange')

        const tokenParams = {
          grant_type: "authorization_code",
          client_id: APP_ID,
          client_secret: SECRET,
          code: code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier
        }

        const response = await fetch(
          "https://api.mercadolibre.com/oauth/token",
          {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams(tokenParams),
          }
        )

        const responseText = await response.text()
        const responseData = responseText ? JSON.parse(responseText) : {}

        if (response.ok) {
          logger.info('[OAuthManager] Token exchange successful')

          // Cache do token para evitar exchanges desnecessários
          if (responseData.access_token) {
            await this.cacheToken(code, responseData)
          }

          return responseData
        }

        // Se for 429, aplicar backoff maior
        if (response.status === 429) {
          logger.warn('[OAuthManager] Rate limited by ML API')
          await this.applyRateLimitBackoff()
          lastError = { status: 429, message: 'Rate limited' }
          continue
        }

        // Se for invalid_grant, não retry (código já usado)
        if (responseData.error === 'invalid_grant') {
          logger.error('[OAuthManager] Invalid grant - code already used')
          throw new Error('Authorization code invalid or expired')
        }

        lastError = responseData

        // Para outros erros 4xx, não fazer retry
        if (response.status >= 400 && response.status < 500) {
          throw new Error(responseData.error_description || responseData.message || 'OAuth error')
        }

      } catch (error) {
        lastError = error
        logger.error(`[OAuthManager] Token exchange attempt ${attempt + 1} failed`, { error })

        if (attempt === CONFIG.MAX_RETRIES - 1) {
          throw error
        }
      }
    }

    throw lastError || new Error('Token exchange failed after retries')
  }

  /**
   * Verifica se pode fazer request (rate limiting)
   */
  private async checkRateLimit(action: string): Promise<boolean> {
    const key = `${CONFIG.CACHE_PREFIX}ratelimit:${action}`
    const backoffKey = `${CONFIG.CACHE_PREFIX}backoff:global`

    // Verificar se está em backoff global
    const inBackoff = await redis.exists(backoffKey)
    if (inBackoff) {
      logger.warn('[OAuthManager] Request blocked - global backoff active')
      return false
    }

    const lastRequest = await redis.get(key)
    if (!lastRequest) return true

    const elapsed = Date.now() - parseInt(lastRequest, 10)
    const canProceed = elapsed >= CONFIG.MIN_REQUEST_INTERVAL_MS

    if (!canProceed) {
      logger.info(`[OAuthManager] Rate limit: must wait ${CONFIG.MIN_REQUEST_INTERVAL_MS - elapsed}ms`)
    }

    return canProceed
  }

  /**
   * Marca uma request no rate limiter
   */
  private async markRequest(action: string): Promise<void> {
    const key = `${CONFIG.CACHE_PREFIX}ratelimit:${action}`
    await redis.setex(key, 60, Date.now().toString())
  }

  /**
   * Aplica backoff após rate limit com backoff progressivo
   */
  private async applyRateLimitBackoff(): Promise<void> {
    const backoffKey = `${CONFIG.CACHE_PREFIX}backoff:global`
    const countKey = `${CONFIG.CACHE_PREFIX}backoff:count`

    // Incrementar contador de rate limits
    const count = await redis.incr(countKey)
    await redis.expire(countKey, 3600) // Reset contador após 1 hora

    // Backoff progressivo baseado no número de rate limits
    const backoffSeconds = Math.min(30 * count, 300) // Máximo 5 minutos

    await redis.setex(backoffKey, backoffSeconds, count.toString())

    logger.info(`[OAuthManager] Applying rate limit backoff: ${backoffSeconds}s (attempt ${count})`)

    await this.delay(backoffSeconds * 1000)
  }

  /**
   * Cache de token para evitar exchanges desnecessários
   */
  private async cacheToken(code: string, tokenData: any): Promise<void> {
    const key = `${CONFIG.CACHE_PREFIX}${CONFIG.TOKEN_PREFIX}${code}`
    await redis.setex(
      key,
      CONFIG.TOKEN_CACHE_TTL_SECONDS,
      JSON.stringify(tokenData)
    )
  }

  /**
   * Busca token do cache
   */
  async getCachedToken(code: string): Promise<any | null> {
    const key = `${CONFIG.CACHE_PREFIX}${CONFIG.TOKEN_PREFIX}${code}`
    const cached = await redis.get(key)
    return cached ? JSON.parse(cached) : null
  }

  /**
   * Limpa OAuth states expirados e sessões órfãs
   */
  private async cleanupExpiredStates(): Promise<void> {
    try {
      // Limpar OAuth states expirados
      const statesResult = await prisma.oAuthState.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { createdAt: { lt: new Date(Date.now() - 3600 * 1000) } } // Mais de 1 hora
          ]
        }
      })

      if (statesResult.count > 0) {
        logger.info(`[OAuthManager] Cleaned ${statesResult.count} expired OAuth states`)
      }

      // Limpar sessões expiradas
      const sessionsResult = await prisma.session.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      })

      if (sessionsResult.count > 0) {
        logger.info(`[OAuthManager] Cleaned ${sessionsResult.count} expired sessions`)
      }

      // Limpar cache Redis de keys expiradas
      const expiredKeys = await redis.keys(`${CONFIG.CACHE_PREFIX}*`)
      for (const key of expiredKeys) {
        const ttl = await redis.ttl(key)
        if (ttl === -1) { // Sem TTL definido
          await redis.expire(key, 3600) // Define TTL de 1 hora
        }
      }
    } catch (error) {
      logger.error('[OAuthManager] Failed to cleanup expired states/sessions', { error })
    }
  }

  /**
   * Inicia job de limpeza periódica
   */
  private startCleanupJob(): void {
    if (this.cleanupInterval) return

    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredStates(),
      CONFIG.STATE_CLEANUP_INTERVAL_MS
    )

    logger.info('[OAuthManager] Started cleanup job')
  }

  /**
   * Para o job de limpeza
   */
  public stopCleanupJob(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      logger.info('[OAuthManager] Stopped cleanup job')
    }
  }

  /**
   * Helper para delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Limpa todo o cache de rate limiting e backoffs
   */
  async clearRateLimits(): Promise<void> {
    const patterns = [
      `${CONFIG.CACHE_PREFIX}ratelimit:*`,
      `${CONFIG.CACHE_PREFIX}backoff:*`,
      `${CONFIG.CACHE_PREFIX}lock:*`
    ]

    let totalCleared = 0
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
        totalCleared += keys.length
      }
    }

    if (totalCleared > 0) {
      logger.info(`[OAuthManager] Cleared ${totalCleared} rate limit/backoff entries`)
    }
  }

  /**
   * Verifica status do rate limiting
   */
  async getRateLimitStatus(): Promise<{
    isBlocked: boolean
    backoffRemaining?: number
    requestsInLastMinute?: number
  }> {
    const backoffKey = `${CONFIG.CACHE_PREFIX}backoff:global`
    const ttl = await redis.ttl(backoffKey)

    if (ttl > 0) {
      return {
        isBlocked: true,
        backoffRemaining: ttl
      }
    }

    return {
      isBlocked: false,
      requestsInLastMinute: 0
    }
  }
}

// Exportar instância singleton
export const oauthManager = OAuthManager.getInstance()

// Cleanup on shutdown
process.on('SIGTERM', () => {
  oauthManager.stopCleanupJob()
})

process.on('SIGINT', () => {
  oauthManager.stopCleanupJob()
})