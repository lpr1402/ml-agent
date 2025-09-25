/**
 * Cliente HTTP para API do Mercado Livre
 * 100% conformidade com documentação oficial
 * Setembro 2025 - Production Ready
 */

import { withRateLimitRetry } from '@/lib/api/rate-limiter'

// User-Agent oficial do ML Agent
const ML_USER_AGENT = 'ML-Agent/2.0 (+https://gugaleo.axnexlabs.com.br)'

// Headers padrão para todas as requisições ML
export function getMLHeaders(accessToken?: string): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/json',
    'User-Agent': ML_USER_AGENT,
    'Content-Type': 'application/json'
  }
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }
  
  return headers
}

// Interface para resposta ML
export interface MLResponse<T = any> {
  data?: T
  error?: string
  status: number
  headers: Headers
}

/**
 * Requisição GET para API ML
 */
export async function mlGet<T = any>(
  url: string,
  accessToken: string
): Promise<MLResponse<T>> {
  try {
    const data = await withRateLimitRetry<T>(async (): Promise<Response> => {
      return await fetch(url, {
        method: 'GET',
        headers: getMLHeaders(accessToken)
      })
    })
    
    return {
      data,
      status: 200,
      headers: new Headers() // withRateLimitRetry já processou a resposta
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const status = errorMessage.includes('API error') ? 
      parseInt(errorMessage.match(/\d+/)?.[0] || '500') : 500
    
    return {
      error: errorMessage,
      status,
      headers: new Headers()
    }
  }
}

/**
 * Requisição POST para API ML
 */
export async function mlPost<T = any>(
  url: string,
  body: any,
  accessToken: string
): Promise<MLResponse<T>> {
  try {
    const data = await withRateLimitRetry<T>(async (): Promise<Response> => {
      return await fetch(url, {
        method: 'POST',
        headers: getMLHeaders(accessToken),
        body: JSON.stringify(body)
      })
    })
    
    return {
      data,
      status: 200,
      headers: new Headers() // withRateLimitRetry já processou a resposta
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const status = errorMessage.includes('API error') ? 
      parseInt(errorMessage.match(/\d+/)?.[0] || '500') : 500
    
    return {
      error: errorMessage,
      status,
      headers: new Headers()
    }
  }
}

/**
 * Requisição PUT para API ML
 */
export async function mlPut<T = any>(
  url: string,
  body: any,
  accessToken: string
): Promise<MLResponse<T>> {
  try {
    const data = await withRateLimitRetry<T>(async (): Promise<Response> => {
      return await fetch(url, {
        method: 'PUT',
        headers: getMLHeaders(accessToken),
        body: JSON.stringify(body)
      })
    })
    
    return {
      data,
      status: 200,
      headers: new Headers() // withRateLimitRetry já processou a resposta
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const status = errorMessage.includes('API error') ? 
      parseInt(errorMessage.match(/\d+/)?.[0] || '500') : 500
    
    return {
      error: errorMessage,
      status,
      headers: new Headers()
    }
  }
}

/**
 * Requisição DELETE para API ML
 */
export async function mlDelete<T = any>(
  url: string,
  accessToken: string
): Promise<MLResponse<T>> {
  try {
    const data = await withRateLimitRetry<T>(async (): Promise<Response> => {
      return await fetch(url, {
        method: 'DELETE',
        headers: getMLHeaders(accessToken)
      })
    })
    
    return {
      data,
      status: 200,
      headers: new Headers() // withRateLimitRetry já processou a resposta
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const status = errorMessage.includes('API error') ? 
      parseInt(errorMessage.match(/\d+/)?.[0] || '500') : 500
    
    return {
      error: errorMessage,
      status,
      headers: new Headers()
    }
  }
}

/**
 * Token exchange para OAuth2
 */
export async function mlTokenExchange(params: URLSearchParams): Promise<MLResponse> {
  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': ML_USER_AGENT
    },
    body: params.toString()
  })
  
  const data = await response.json()
  
  return {
    data,
    error: response.ok ? undefined : data.message || data.error,
    status: response.status,
    headers: response.headers
  }
}

// Endpoints oficiais do ML
export const ML_ENDPOINTS = {
  // OAuth
  AUTHORIZATION: 'https://auth.mercadolibre.com.br/authorization',
  TOKEN: 'https://api.mercadolibre.com/oauth/token',
  
  // User
  USER_ME: 'https://api.mercadolibre.com/users/me',
  USER_BY_ID: (id: string) => `https://api.mercadolibre.com/users/${id}`,
  
  // Questions
  QUESTIONS_SEARCH: 'https://api.mercadolibre.com/questions/search',
  QUESTION_BY_ID: (id: string) => `https://api.mercadolibre.com/questions/${id}`,
  ANSWERS: 'https://api.mercadolibre.com/answers',
  RECEIVED_QUESTIONS: 'https://api.mercadolibre.com/my/received_questions/search',
  
  // Items
  ITEM_BY_ID: (id: string) => `https://api.mercadolibre.com/items/${id}`,
  ITEMS_SEARCH: 'https://api.mercadolibre.com/sites/MLB/search',
  
  // Orders
  ORDERS_SEARCH: 'https://api.mercadolibre.com/orders/search',
  ORDER_BY_ID: (id: string) => `https://api.mercadolibre.com/orders/${id}`,
  
  // Metrics
  USER_SALES: (userId: string) => `https://api.mercadolibre.com/users/${userId}/sales`,
  USER_VISITS: (userId: string) => `https://api.mercadolibre.com/users/${userId}/items_visits`,
  
  // Billing
  BILLING_INFO: (userId: string) => `https://api.mercadolibre.com/users/${userId}/billing_info`
}

export default {
  getMLHeaders,
  mlGet,
  mlPost,
  mlPut,
  mlDelete,
  mlTokenExchange,
  ML_ENDPOINTS,
  ML_USER_AGENT
}