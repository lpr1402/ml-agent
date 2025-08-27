import { NextRequest } from "next/server"

export interface AuthData {
  accessToken: string
  userId: string
}

export async function getAuthFromRequest(request: NextRequest): Promise<AuthData | null> {
  try {
    // Get token from Authorization header (sent by our API client)
    const authHeader = request.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) {
      const accessToken = authHeader.substring(7)
      
      // For now, we just return the token
      // In production, you might want to validate it with Mercado Livre
      return {
        accessToken,
        userId: "" // Will be fetched if needed
      }
    }

    return null
  } catch (error) {
    console.error("Auth extraction failed:", error)
    return null
  }
}

export function createAuthHeaders(accessToken: string) {
  return {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  }
}