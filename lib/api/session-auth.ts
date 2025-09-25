/**
 * Funções auxiliares para autenticação via sessão
 * SEMPRE usa tokens criptografados do banco de dados
 * Segue 100% a documentação do Mercado Livre
 * Integra com sistema de refresh automático
 */

import { logger } from '@/lib/logger'
import { getCurrentSession } from "@/lib/auth/ml-auth"
import { prisma } from "@/lib/prisma"
import { getValidMLToken } from "@/lib/ml-api/token-refresh-manager"
import { withRateLimitRetry, mlRequestPool } from "@/lib/api/rate-limiter"

export interface AuthenticatedAccount {
  mlAccount: {
    id: string
    mlUserId: string
    nickname: string
    siteId: string
  }
  accessToken: string
  organizationId: string
}

/**
 * Obtém conta ML autenticada e token descriptografado da sessão atual
 * Usa SEMPRE o token criptografado do banco
 * @returns Dados da conta autenticada ou null se não autenticado
 */
export async function getAuthenticatedAccount(): Promise<AuthenticatedAccount | null> {
  try {
    // Obter sessão atual
    const session = await getCurrentSession()
    
    if (!session) {
      logger.info("[Auth] No session found")
      return null
    }
    
    logger.info("[Auth] Session found:", {
      organizationId: session.organizationId,
      activeMLAccountId: session.activeMLAccountId
    })
    
    // Buscar conta ML ativa da organização
    // Primeiro tenta a conta ativa da sessão, senão pega a primária
    let mlAccount = null
    
    if (session.activeMLAccountId) {
      mlAccount = await prisma.mLAccount.findFirst({
        where: {
          id: session.activeMLAccountId,
          organizationId: session.organizationId,
          isActive: true
        }
      })
    }
    
    // Se não encontrou pela sessão, pega a conta primária
    if (!mlAccount) {
      mlAccount = await prisma.mLAccount.findFirst({
        where: {
          organizationId: session.organizationId,
          isPrimary: true,
          isActive: true
        }
      })
    }
    
    if (!mlAccount) {
      logger.info("[Auth] No active ML account found for org:", { data: session.organizationId })
      return null
    }
    
    logger.info("[Auth] ML Account found:", {
      id: mlAccount.id,
      nickname: mlAccount.nickname,
      hasToken: !!mlAccount.accessToken,
      hasIV: !!mlAccount.accessTokenIV,
      hasTag: !!mlAccount.accessTokenTag
    })
    
    // Obter token válido (com refresh automático se necessário)
    // IMPORTANTE: Para autenticação interna, não exigimos token ML válido
    // O token só é necessário para chamadas à API do ML
    let accessToken = null
    try {
      accessToken = await getValidMLToken(mlAccount.id)
    } catch (error) {
      logger.warn("[Auth] Could not get ML token, but session is valid:", { 
        nickname: mlAccount.nickname,
        error 
      })
    }
    
    // Retornar dados da conta mesmo sem token ML
    // Isso permite que o usuário acesse o sistema e faça login novamente no ML se necessário
    logger.info("[Auth] Returning authenticated account:", { 
      nickname: mlAccount.nickname,
      hasToken: !!accessToken 
    })
    
    return {
      mlAccount: {
        id: mlAccount.id,
        mlUserId: mlAccount.mlUserId,
        nickname: mlAccount.nickname,
        siteId: mlAccount.siteId
      },
      accessToken: accessToken || '',
      organizationId: session.organizationId
    }
  } catch (error) {
    logger.error("[Auth] Error getting authenticated account:", { error })
    return null
  }
}

/**
 * Faz chamada autenticada para API do Mercado Livre
 * Usa token da sessão e trata erros automaticamente
 * Implementa rate limiting e retry automático
 */
export async function mlApiCall(
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> {
  const auth = await getAuthenticatedAccount()
  
  if (!auth) {
    throw new Error("Not authenticated")
  }
  
  // Garantir que sempre usa HTTPS e API versão 4
  const url = endpoint.startsWith("http") 
    ? endpoint 
    : `https://api.mercadolibre.com${endpoint}`
  
  // Adicionar api_version se não tiver
  const urlWithVersion = url.includes("api_version") 
    ? url 
    : url + (url.includes("?") ? "&" : "?") + "api_version=4"
  
  // Fazer chamada com token usando pool de requisições
  const response = await mlRequestPool.add(async () => {
    return await fetch(urlWithVersion, {
      ...options,
      headers: {
        ...options.headers,
        "Authorization": `Bearer ${auth.accessToken}`,
        "Accept": "application/json"
      }
    })
  })
  
  // Log para debug
  if (!response.ok) {
    logger.error(`[ML API] Error ${response.status} on ${endpoint}`)
  }
  
  return response
}

/**
 * Faz chamada autenticada com retry automático em caso de rate limit
 * Retorna o JSON da resposta diretamente
 */
export async function mlApiCallWithRetry<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const auth = await getAuthenticatedAccount()
  
  if (!auth) {
    throw new Error("Not authenticated")
  }
  
  // Garantir que sempre usa HTTPS e API versão 4
  const url = endpoint.startsWith("http") 
    ? endpoint 
    : `https://api.mercadolibre.com${endpoint}`
  
  const urlWithVersion = url.includes("api_version") 
    ? url 
    : url + (url.includes("?") ? "&" : "?") + "api_version=4"
  
  // Usar rate limiter com retry automático
  return await withRateLimitRetry<T>(async () => {
    return await fetch(urlWithVersion, {
      ...options,
      headers: {
        ...options.headers,
        "Authorization": `Bearer ${auth.accessToken}`,
        "Accept": "application/json"
      }
    })
  })
}