import { sessionStore } from "./session-store"

// Helper function to get seller's access token from session store
// This is used by the webhook handler to fetch ML data  
export async function getSellerAccessToken(sellerId: string): Promise<string | null> {
  try {
    // Get token from session store (production-ready)
    const token = await sessionStore.getAccessToken(sellerId)
    
    if (!token) {
      console.warn(`No access token found for seller ${sellerId} in session store`)
    }
    
    return token
  } catch (error) {
    console.error("Error getting seller access token:", error)
    return null
  }
}

// Helper to make ML API calls
export async function fetchFromML(endpoint: string, accessToken?: string | null) {
  const headers: any = {
    "Accept": "application/json",
    "Content-Type": "application/json"
  }
  
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }
  
  const response = await fetch(`https://api.mercadolibre.com${endpoint}`, { headers })
  
  if (!response.ok) {
    console.error(`ML API error for ${endpoint}:`, response.status)
    
    // If 403, try without auth (public endpoints)
    if (response.status === 403 && accessToken) {
      console.log("Retrying as public endpoint...")
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