/**
 * Cliente da API do Mercado Livre com Rate Limiting e Retry Strategy
 * Implementa todas as práticas obrigatórias da documentação ML
 * - Sempre enviar token no header
 * - Tratar erro 429 (rate limiting)
 * - Exponential backoff para retry
 * - Refresh automático de token expirado
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/security/encryption'
import { mlOAuth } from '@/lib/ml-oauth/oauth-client'
import { auditLog } from '@/lib/audit/audit-logger'

interface RateLimitInfo {
  isLimited: boolean
  resetIn: number
  remaining: number
}

interface RequestOptions extends RequestInit {
  mlAccountId: string
  skipAuth?: boolean
  maxRetries?: number
}

export class MLApiClient {
  private readonly baseUrl = 'https://api.mercadolibre.com'
  private rateLimits = new Map<string, RateLimitInfo>()
  
  /**
   * Faz uma requisição para a API do ML com todas as proteções
   * Obrigatório sempre enviar token no header conforme documentação
   */
  async request<T = any>(
    path: string,
    options: RequestOptions
  ): Promise<T> {
    const { mlAccountId, skipAuth = false, maxRetries = 3, ...fetchOptions } = options
    
    // Verifica rate limit antes de fazer a requisição
    const rateLimit = await this.checkRateLimit(mlAccountId)
    if (rateLimit.isLimited) {
      logger.info(`[API] Rate limited for account ${mlAccountId}, waiting ${rateLimit.resetIn}ms`)
      await this.delay(rateLimit.resetIn)
    }
    
    let attempts = 0
    let lastError: Error | null = null
    
    while (attempts < maxRetries) {
      try {
        // Obtém token descriptografado
        const token = skipAuth ? null : await this.getAccessToken(mlAccountId)
        
        // OBRIGATÓRIO: Sempre enviar token no header
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(fetchOptions.headers as Record<string, string> || {})
        }
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        // Adiciona header interno para tracking
        headers['X-ML-Account-ID'] = mlAccountId
        
        const url = `${this.baseUrl}${path}`
        logger.info(`[API] ${fetchOptions.method || 'GET'} ${path}`)
        
        const response = await fetch(url, {
          ...fetchOptions,
          headers
        })
        
        // Log da resposta
        const responseHeaders = {
          status: response.status,
          rateLimitRemaining: response.headers.get('X-Rate-Limit-Remaining'),
          rateLimitReset: response.headers.get('X-Rate-Limit-Reset')
        }
        
        // Trata erro 429 - Rate Limiting (obrigatório tratar)
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const delayMs = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : Math.pow(2, attempts) * 1000 // Exponential backoff
          
          logger.info(`[API] Rate limit hit (429), waiting ${delayMs}ms`)
          
          await this.updateRateLimit(mlAccountId, delayMs)
          await this.delay(delayMs)
          
          attempts++
          continue
        }
        
        // Trata erro 401 - Token expirado
        if (response.status === 401 && !skipAuth) {
          logger.info(`[API] Token expired (401), refreshing...`)
          
          try {
            await mlOAuth.refreshAccessToken(mlAccountId)
            attempts++
            continue // Tenta novamente com novo token
          } catch (refreshError) {
            logger.error('[API] Failed to refresh token:', { error: { error: refreshError } })
            throw new Error('Authentication failed - please reconnect your ML account')
          }
        }
        
        // Trata erro 403 - Forbidden
        if (response.status === 403) {
          const error = await response.text()
          logger.error(`[API] Forbidden (403):`, { error: error })
          
          // Pode ser IP bloqueado ou falta de scopes
          throw new Error('Access forbidden - check app permissions or IP restrictions')
        }
        
        // Atualiza rate limit info dos headers
        if (responseHeaders.rateLimitRemaining) {
          this.rateLimits.set(mlAccountId, {
            isLimited: false,
            remaining: parseInt(responseHeaders.rateLimitRemaining),
            resetIn: responseHeaders.rateLimitReset 
              ? parseInt(responseHeaders.rateLimitReset) * 1000 - Date.now()
              : 0
          })
        }
        
        // Processa resposta bem-sucedida
        if (response.ok) {
          const data = await response.json()
          
          // Atualiza último request da conta
          await prisma.mLAccount.update({
            where: { id: mlAccountId },
            data: { lastRequestAt: new Date() }
          })
          
          return data as T
        }
        
        // Outros erros HTTP
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.message || errorData?.error || `HTTP ${response.status}`
        
        lastError = new Error(errorMessage)
        
        // Se for erro 5xx, tenta novamente com backoff
        if (response.status >= 500) {
          const delayMs = Math.pow(2, attempts) * 1000
          logger.info(`[API] Server error (${response.status}), retrying in ${delayMs}ms`)
          await this.delay(delayMs)
          attempts++
          continue
        }
        
        // Para outros erros, não tenta novamente
        throw lastError
        
      } catch (error) {
        logger.error(`[API] Request error (attempt ${attempts + 1}):`, { error: error })
        lastError = error as Error
        
        attempts++
        if (attempts < maxRetries) {
          const delayMs = Math.pow(2, attempts) * 1000
          logger.info(`[API] Retrying in ${delayMs}ms...`)
          await this.delay(delayMs)
        }
      }
    }
    
    // Se chegou aqui, esgotou as tentativas
    const finalError = lastError || new Error('Request failed after max retries')
    
    // Log no audit para erros persistentes
    await auditLog({
      action: 'api.request_failed',
      entityType: 'ml_account',
      entityId: mlAccountId,
      metadata: {
        path,
        method: fetchOptions.method || 'GET',
        error: finalError.message,
        attempts
      }
    })
    
    throw finalError
  }
  
  /**
   * Obtém o access token descriptografado para uma conta
   */
  private async getAccessToken(mlAccountId: string): Promise<string> {
    const account = await prisma.mLAccount.findUnique({
      where: { id: mlAccountId },
      select: {
        accessToken: true,
        accessTokenIV: true,
        accessTokenTag: true,
        tokenExpiresAt: true,
        isActive: true
      }
    })
    
    if (!account) {
      throw new Error('ML account not found')
    }
    
    if (!account.isActive) {
      throw new Error('ML account is not active')
    }
    
    // Verifica se token está próximo de expirar (5 min buffer)
    const expirationBuffer = new Date(account.tokenExpiresAt.getTime() - 5 * 60 * 1000)
    if (new Date() > expirationBuffer) {
      logger.info(`[API] Token expiring soon, refreshing proactively...`)
      const newToken = await mlOAuth.refreshAccessToken(mlAccountId)
      return newToken
    }
    
    // Descriptografa e retorna token
    return decryptToken({
      encrypted: account.accessToken,
      iv: account.accessTokenIV,
      authTag: account.accessTokenTag
    })
  }
  
  /**
   * Verifica rate limit para uma conta
   */
  private async checkRateLimit(mlAccountId: string): Promise<RateLimitInfo> {
    // Verifica cache em memória
    const cached = this.rateLimits.get(mlAccountId)
    if (cached && cached.resetIn > 0) {
      return cached
    }
    
    // Verifica no banco
    const account = await prisma.mLAccount.findUnique({
      where: { id: mlAccountId },
      select: {
        rateLimitReset: true,
        rateLimitCount: true
      }
    })
    
    if (!account) {
      return { isLimited: false, remaining: 1000, resetIn: 0 }
    }
    
    if (account.rateLimitReset && account.rateLimitReset > new Date()) {
      const resetIn = account.rateLimitReset.getTime() - Date.now()
      return {
        isLimited: true,
        remaining: 0,
        resetIn
      }
    }
    
    return { isLimited: false, remaining: 1000, resetIn: 0 }
  }
  
  /**
   * Atualiza rate limit para uma conta
   */
  private async updateRateLimit(mlAccountId: string, delayMs: number): Promise<void> {
    const resetAt = new Date(Date.now() + delayMs)
    
    await prisma.mLAccount.update({
      where: { id: mlAccountId },
      data: {
        rateLimitReset: resetAt,
        rateLimitCount: 0
      }
    })
    
    this.rateLimits.set(mlAccountId, {
      isLimited: true,
      remaining: 0,
      resetIn: delayMs
    })
  }
  
  /**
   * Delay helper com promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  // ===== MÉTODOS ESPECÍFICOS DA API ML =====
  
  /**
   * Obtém informações do usuário
   */
  async getUserInfo(mlAccountId: string, userId?: string) {
    const path = userId ? `/users/${userId}` : '/users/me'
    return this.request(path, {
      method: 'GET',
      mlAccountId
    })
  }
  
  /**
   * Obtém pedidos
   */
  async getOrders(mlAccountId: string, params?: Record<string, string>) {
    const searchParams = new URLSearchParams(params)
    return this.request(`/orders/search?${searchParams}`, {
      method: 'GET',
      mlAccountId
    })
  }
  
  /**
   * Obtém itens/anúncios
   */
  async getItems(mlAccountId: string, userId: string, status: string = 'active') {
    return this.request(`/users/${userId}/items/search?status=${status}`, {
      method: 'GET',
      mlAccountId
    })
  }
  
  /**
   * Obtém perguntas
   */
  async getQuestions(mlAccountId: string, params?: Record<string, string>) {
    const searchParams = new URLSearchParams(params)
    return this.request(`/questions/search?${searchParams}`, {
      method: 'GET',
      mlAccountId
    })
  }
  
  /**
   * Responde uma pergunta
   */
  async answerQuestion(mlAccountId: string, questionId: string, text: string) {
    return this.request(`/answers`, {
      method: 'POST',
      mlAccountId,
      body: JSON.stringify({
        question_id: questionId,
        text
      })
    })
  }
  
  /**
   * Obtém métricas de vendas
   */
  async getSalesMetrics(mlAccountId: string, userId: string) {
    const [user, orders] = await Promise.all([
      this.getUserInfo(mlAccountId, userId),
      this.getOrders(mlAccountId, { seller: userId, limit: '50' })
    ])
    
    return {
      user,
      orders: orders.results || [],
      metrics: {
        totalOrders: orders.paging?.total || 0,
        reputation: user.seller_reputation
      }
    }
  }
}

// Singleton instance
export const mlApi = new MLApiClient()