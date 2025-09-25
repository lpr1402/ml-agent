/**
 * Helper functions para APIs do Mercado Livre
 * Centraliza lógica comum para todos os endpoints
 */

import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { getAuthenticatedAccount } from '@/lib/api/session-auth'
import { mlApiQueue } from '@/lib/api/sequential-queue'

export interface MLApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  headers?: Record<string, string>
}

/**
 * Faz uma chamada para a API do ML usando autenticação de sessão e queue sequencial
 */
export async function mlApiCall(
  endpoint: string,
  options: MLApiOptions = {}
): Promise<any> {
  const auth = await getAuthenticatedAccount()
  
  if (!auth) {
    throw new Error('Not authenticated')
  }
  
  // Garantir que endpoint começa com / e tem api_version=4
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const urlWithVersion = normalizedEndpoint.includes('api_version') 
    ? normalizedEndpoint 
    : `${normalizedEndpoint}${normalizedEndpoint.includes('?') ? '&' : '?'}api_version=4`
  
  return mlApiQueue.add(async () => {
    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${auth.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    }
    
    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body)
    }
    
    const response = await fetch(
      `https://api.mercadolibre.com${urlWithVersion}`,
      fetchOptions
    )
    
    if (!response.ok) {
      // Log error but don't throw for 404s as they're often expected
      if (response.status !== 404) {
        logger.info(`[MLApi] ${endpoint} returned ${response.status}`)
      }
      
      // For errors, return null or empty structure
      if (response.status >= 400) {
        return null
      }
    }
    
    try {
      return await response.json()
    } catch (_e) {
      // Response might not be JSON
      return null
    }
  })
}

/**
 * Wrapper para endpoints que retorna NextResponse
 */
export async function createMLApiEndpoint(
  handler: (auth: Awaited<ReturnType<typeof getAuthenticatedAccount>>) => Promise<any>
): Promise<NextResponse> {
  try {
    const auth = await getAuthenticatedAccount()
    
    if (!auth) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const result = await handler(auth)
    
    return NextResponse.json(result)
    
  } catch (_error) {
    logger.error('[MLApi] Endpoint error:', { error: _error })

    // Check for rate limiting
    if (_error instanceof Error && _error.message.includes('429')) {
      return NextResponse.json(
        {
          error: 'Rate limited',
          message: 'Too many requests. Please try again later.',
          retryAfter: 60
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: _error instanceof Error ? _error.message : 'An error occurred'
      },
      { status: 500 }
    )
  }
}

/**
 * Helper para buscar dados do usuário autenticado
 */
export async function getAuthenticatedUserData() {
  return mlApiCall('/users/me')
}

/**
 * Helper para buscar múltiplos recursos em sequência
 */
export async function fetchMultipleResources(
  requests: Array<{ endpoint: string; options?: MLApiOptions }>
): Promise<any[]> {
  const results = []
  
  for (const req of requests) {
    try {
      const data = await mlApiCall(req.endpoint, req.options)
      results.push(data)
    } catch (_error) {
      logger.info(`[MLApi] Failed to fetch ${req.endpoint}`)
      results.push(null)
    }
  }
  
  return results
}