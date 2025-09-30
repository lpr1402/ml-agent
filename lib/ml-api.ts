import { logger } from '@/lib/logger'
import { sessionStore } from "./session-store"
import { executeMLRequest } from './ml-api/retry-handler'

// Helper function to get seller's access token from session store
// This is used by the webhook handler to fetch ML data
export async function getSellerAccessToken(sellerId: string): Promise<string | null> {
  try {
    // Get token from session store (production-ready)
    const token = await sessionStore.getAccessToken(sellerId)

    if (!token) {
      logger.warn(`No access token found for seller ${sellerId} in session store`)
    }

    return token
  } catch (error) {
    logger.error("Error getting seller access token:", { error })
    return null
  }
}

// Helper to make ML API calls with retry logic (NO internal rate limiting)
export async function fetchFromML(endpoint: string, accessToken?: string | null, accountId?: string) {
  const operation = async () => {
    const headers: any = {
      "Accept": "application/json",
      "Content-Type": "application/json"
    }

    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`
    }

    const response = await fetch(`https://api.mercadolibre.com${endpoint}`, { headers })

    if (!response.ok) {
      // Criar erro com todas informações necessárias
      const error: any = new Error(`ML API Error: ${response.statusText}`)
      error.status = response.status
      error.statusCode = response.status
      error.headers = Object.fromEntries(response.headers.entries())

      // Se for 429, o retry handler vai cuidar
      if (response.status === 429) {
        error.message = 'Too Many Requests'
        throw error
      }

      // Se for 401, lançar direto
      if (response.status === 401) {
        error.message = 'Unauthorized'
        throw error
      }

      logger.error(`ML API error for ${endpoint}:`, {
        status: response.status,
        accountId
      })

      // If 403, try without auth (public endpoints)
      if (response.status === 403 && accessToken) {
        logger.info("Retrying as public endpoint...")
        const publicResponse = await fetch(`https://api.mercadolibre.com${endpoint}`, {
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          }
        })

        if (publicResponse.ok) {
          return publicResponse.json()
        }
      }

      throw error
    }

    return response.json()
  }

  // Usar retry handler SEM rate limiting interno
  return executeMLRequest(
    operation,
    `ML API: ${endpoint}`,
    accountId
  )
}