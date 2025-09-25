/**
 * Gerenciador de Cache de Tokens com Isolamento por Organização
 * Sistema Production-Ready - Setembro 2025
 */

import { logger } from '@/lib/logger'

// Cache estruturado por organização para isolamento total
type OrganizationCache = Map<string, {
  token: string
  expiresAt: Date
  mlUserId: string
  nickname: string
}>

// Cache principal: organizationId -> mlAccountId -> TokenData
const tokenCache = new Map<string, OrganizationCache>()

// Configurações de cache
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutos
const TOKEN_REFRESH_MARGIN = 5 * 60 * 1000 // 5 minutos antes de expirar

// Interface para dados de token
export interface CachedToken {
  token: string
  expiresAt: Date
  mlUserId: string
  nickname: string
  needsRefresh: boolean
}

/**
 * Obtém token do cache com isolamento por organização
 */
export function getCachedToken(
  organizationId: string,
  mlAccountId: string
): CachedToken | null {
  const orgCache = tokenCache.get(organizationId)
  if (!orgCache) return null
  
  const cached = orgCache.get(mlAccountId)
  if (!cached) return null
  
  // Verificar se token ainda é válido
  const now = new Date()
  if (cached.expiresAt <= now) {
    // Token expirado, remover do cache
    orgCache.delete(mlAccountId)
    return null
  }
  
  // Verificar se precisa refresh
  const needsRefresh = cached.expiresAt.getTime() - now.getTime() < TOKEN_REFRESH_MARGIN
  
  return {
    ...cached,
    needsRefresh
  }
}

/**
 * Armazena token no cache com isolamento
 */
export function setCachedToken(
  organizationId: string,
  mlAccountId: string,
  tokenData: {
    token: string
    expiresAt: Date
    mlUserId: string
    nickname: string
  }
): void {
  let orgCache = tokenCache.get(organizationId)
  
  if (!orgCache) {
    orgCache = new Map()
    tokenCache.set(organizationId, orgCache)
  }
  
  orgCache.set(mlAccountId, tokenData)
  
  logger.info(`[TokenCache] Token cached for ${tokenData.nickname} in org ${organizationId}`)
}

/**
 * Invalida token específico no cache
 */
export function invalidateCachedToken(
  organizationId: string,
  mlAccountId: string
): void {
  const orgCache = tokenCache.get(organizationId)
  if (orgCache) {
    orgCache.delete(mlAccountId)
    logger.info(`[TokenCache] Invalidated token for account ${mlAccountId} in org ${organizationId}`)
  }
}

/**
 * Invalida todos os tokens de uma organização
 */
export function invalidateOrganizationCache(organizationId: string): void {
  tokenCache.delete(organizationId)
  logger.info(`[TokenCache] Invalidated all tokens for org ${organizationId}`)
}

/**
 * Limpa tokens expirados do cache
 */
export function cleanupExpiredTokens(): void {
  const now = new Date()
  let cleanedCount = 0
  
  for (const [orgId, orgCache] of tokenCache.entries()) {
    for (const [accountId, tokenData] of orgCache.entries()) {
      if (tokenData.expiresAt <= now) {
        orgCache.delete(accountId)
        cleanedCount++
      }
    }
    
    // Se organização ficou vazia, remover
    if (orgCache.size === 0) {
      tokenCache.delete(orgId)
    }
  }
  
  if (cleanedCount > 0) {
    logger.info(`[TokenCache] Cleaned up ${cleanedCount} expired tokens`)
  }
}

/**
 * Obtém estatísticas do cache
 */
export function getCacheStats(): {
  totalOrganizations: number
  totalTokens: number
  memoryUsage: number
} {
  let totalTokens = 0
  
  for (const orgCache of tokenCache.values()) {
    totalTokens += orgCache.size
  }
  
  // Estimativa de uso de memória (aproximado)
  const avgTokenSize = 500 // bytes por token
  const memoryUsage = totalTokens * avgTokenSize
  
  return {
    totalOrganizations: tokenCache.size,
    totalTokens,
    memoryUsage
  }
}

/**
 * Limita o tamanho do cache por organização
 */
export function enforceOrgCacheLimit(
  organizationId: string,
  maxAccounts: number = 10
): void {
  const orgCache = tokenCache.get(organizationId)
  if (!orgCache || orgCache.size <= maxAccounts) return
  
  // Remover tokens mais antigos se exceder limite
  const entries = Array.from(orgCache.entries())
  const toRemove = entries.slice(0, entries.length - maxAccounts)
  
  for (const [accountId] of toRemove) {
    orgCache.delete(accountId)
  }
  
  logger.info(`[TokenCache] Enforced cache limit for org ${organizationId}, removed ${toRemove.length} tokens`)
}

// Limpeza automática de tokens expirados
let cleanupInterval: NodeJS.Timeout | null = null

export function startCacheCleanup(): void {
  if (cleanupInterval) return
  
  cleanupInterval = setInterval(() => {
    cleanupExpiredTokens()
    
    // Log de estatísticas a cada limpeza
    const stats = getCacheStats()
    if (stats.totalTokens > 0) {
      logger.info(`[TokenCache] Stats: ${stats.totalOrganizations} orgs, ${stats.totalTokens} tokens, ~${(stats.memoryUsage / 1024).toFixed(2)}KB memory`)
    }
  }, CACHE_CLEANUP_INTERVAL)
  
  logger.info('[TokenCache] Cleanup job started')
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
    logger.info('[TokenCache] Cleanup job stopped')
  }
}

// Iniciar limpeza automática
if (typeof window === 'undefined') {
  // Apenas no servidor
  startCacheCleanup()
}

export default {
  getCachedToken,
  setCachedToken,
  invalidateCachedToken,
  invalidateOrganizationCache,
  cleanupExpiredTokens,
  getCacheStats,
  enforceOrgCacheLimit,
  startCacheCleanup,
  stopCacheCleanup
}