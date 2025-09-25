import { logger } from '@/lib/logger'
import { sessionStore } from "./session-store"
import { mlRateLimiter } from './ml-api/rate-limiter'

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

// Helper to make ML API calls with rate limiting and retry logic
export async function fetchFromML(endpoint: string, accessToken?: string | null, accountId?: string) {
  // Se não tiver accountId, usar 'global' como fallback
  const rateLimitAccountId = accountId || 'global'

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
      // Se for 429, lançar erro para o rate limiter tratar
      if (response.status === 429) {
        const error: any = new Error('Rate limit exceeded')
        error.status = 429
        throw error
      }

      // Se for 401, lançar erro para não tentar novamente
      if (response.status === 401) {
        const error: any = new Error('Unauthorized')
        error.status = 401
        throw error
      }

      logger.error(`ML API error for ${endpoint}:`, { status: response.status })

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

      return null
    }

    return response.json()
  }

  // Usar rate limiter para executar com retry logic
  return mlRateLimiter.executeWithRetry(
    rateLimitAccountId,
    operation,
    `ML API call: ${endpoint}`
  )
}