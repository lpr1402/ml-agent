/**
 * Gerenciador de Rate Limiting Global
 * Controle preciso de 2000 req/hora por conta ML
 * Setembro 2025 - Production Ready
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

// Estrutura para controle de rate limit por conta
interface RateLimitData {
  count: number
  resetAt: Date
  mlUserId: string
  organizationId: string
}

// Cache de rate limits por mlAccountId
const rateLimitCache = new Map<string, RateLimitData>()

// Configurações
const MAX_REQUESTS_PER_HOUR = 1800 // 90% do limite ML (2000) para margem de segurança
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hora em ms

/**
 * Verifica e atualiza rate limit para uma conta ML
 */
export async function checkRateLimit(
  mlAccountId: string,
  organizationId: string,
  mlUserId: string
): Promise<{
  allowed: boolean
  remaining: number
  resetAt: Date
  waitTime?: number
}> {
  const now = new Date()
  const cacheKey = mlAccountId
  
  // Buscar dados do cache
  let rateLimitData = rateLimitCache.get(cacheKey)
  
  // Se não existe ou expirou, criar novo
  if (!rateLimitData || rateLimitData.resetAt <= now) {
    rateLimitData = {
      count: 0,
      resetAt: new Date(now.getTime() + RATE_LIMIT_WINDOW),
      mlUserId,
      organizationId
    }
    rateLimitCache.set(cacheKey, rateLimitData)
  }
  
  // Verificar se ainda tem quota
  const remaining = MAX_REQUESTS_PER_HOUR - rateLimitData.count
  
  if (remaining <= 0) {
    // Calcular tempo de espera
    const waitTime = rateLimitData.resetAt.getTime() - now.getTime()
    
    logger.warn(`[RateLimit] Limit reached for ${mlUserId}: ${rateLimitData.count}/${MAX_REQUESTS_PER_HOUR} requests`)
    
    // Registrar no audit log
    await prisma.auditLog.create({
      data: {
        action: 'rate_limit.exceeded',
        entityType: 'ml_account',
        entityId: mlAccountId,
        organizationId,
        metadata: {
          mlUserId,
          count: rateLimitData.count,
          limit: MAX_REQUESTS_PER_HOUR,
          resetAt: rateLimitData.resetAt
        }
      }
    }).catch(error => logger.error('Rate limit cleanup error', { error }))
    
    return {
      allowed: false,
      remaining: 0,
      resetAt: rateLimitData.resetAt,
      waitTime
    }
  }
  
  // Incrementar contador
  rateLimitData.count++
  
  // Log a cada 100 requests
  if (rateLimitData.count % 100 === 0) {
    logger.info(`[RateLimit] ${mlUserId}: ${rateLimitData.count}/${MAX_REQUESTS_PER_HOUR} requests used`)
  }
  
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_HOUR - rateLimitData.count,
    resetAt: rateLimitData.resetAt
  }
}

/**
 * Reseta rate limit para uma conta (usar com cuidado)
 */
export function resetRateLimit(mlAccountId: string): void {
  rateLimitCache.delete(mlAccountId)
  logger.info(`[RateLimit] Reset for account ${mlAccountId}`)
}

/**
 * Obtém estatísticas de rate limit
 */
export function getRateLimitStats(): {
  totalAccounts: number
  totalRequests: number
  accountsNearLimit: string[]
  accountsOverLimit: string[]
} {
  const now = new Date()
  const accountsNearLimit: string[] = []
  const accountsOverLimit: string[] = []
  let totalRequests = 0
  
  for (const [_accountId, data] of rateLimitCache.entries()) {
    // Ignorar expirados
    if (data.resetAt <= now) continue
    
    totalRequests += data.count
    
    const percentUsed = (data.count / MAX_REQUESTS_PER_HOUR) * 100
    
    if (percentUsed >= 100) {
      accountsOverLimit.push(data.mlUserId)
    } else if (percentUsed >= 80) {
      accountsNearLimit.push(data.mlUserId)
    }
  }
  
  return {
    totalAccounts: rateLimitCache.size,
    totalRequests,
    accountsNearLimit,
    accountsOverLimit
  }
}

/**
 * Limpa rate limits expirados
 */
export function cleanupExpiredRateLimits(): void {
  const now = new Date()
  let cleaned = 0
  
  for (const [key, data] of rateLimitCache.entries()) {
    if (data.resetAt <= now) {
      rateLimitCache.delete(key)
      cleaned++
    }
  }
  
  if (cleaned > 0) {
    logger.info(`[RateLimit] Cleaned ${cleaned} expired rate limits`)
  }
}

/**
 * Middleware para aplicar rate limiting
 */
export async function withRateLimit<T>(
  mlAccountId: string,
  organizationId: string,
  mlUserId: string,
  fn: () => Promise<T>
): Promise<T> {
  const rateLimit = await checkRateLimit(mlAccountId, organizationId, mlUserId)
  
  if (!rateLimit.allowed) {
    throw new Error(`Rate limit exceeded. Try again at ${rateLimit.resetAt.toISOString()}`)
  }
  
  try {
    return await fn()
  } catch (error) {
    // Se erro 429 do ML, ajustar nosso contador
    if (error instanceof Error && error.message.includes('429')) {
      // Forçar ao limite para evitar mais requests
      const data = rateLimitCache.get(mlAccountId)
      if (data) {
        data.count = MAX_REQUESTS_PER_HOUR
        logger.warn(`[RateLimit] ML returned 429, forcing limit for ${mlUserId}`)
      }
    }
    throw error
  }
}

// Limpeza automática a cada 5 minutos
setInterval(() => {
  cleanupExpiredRateLimits()
  
  // Log de estatísticas
  const stats = getRateLimitStats()
  if (stats.totalAccounts > 0) {
    logger.info(`[RateLimit] Stats: ${stats.totalAccounts} accounts, ${stats.totalRequests} total requests`)
    
    if (stats.accountsOverLimit.length > 0) {
      logger.warn(`[RateLimit] Accounts over limit: ${stats.accountsOverLimit.join(', ')}`)
    }
    
    if (stats.accountsNearLimit.length > 0) {
      logger.info(`[RateLimit] Accounts near limit (>80%): ${stats.accountsNearLimit.join(', ')}`)
    }
  }
}, 5 * 60 * 1000)

export default {
  checkRateLimit,
  resetRateLimit,
  getRateLimitStats,
  cleanupExpiredRateLimits,
  withRateLimit,
  MAX_REQUESTS_PER_HOUR,
  RATE_LIMIT_WINDOW
}