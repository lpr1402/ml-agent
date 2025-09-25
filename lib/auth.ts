import { logger } from '@/lib/logger'
import { NextRequest } from "next/server"

export async function getAuthFromRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    
    if (authHeader?.startsWith("Bearer ")) {
      return {
        accessToken: authHeader.substring(7),
        mlUserId: "", // Will be fetched from ML API if needed
        id: "" // User ID
      }
    }
    
    return null
  } catch (error) {
    logger.error("Auth extraction failed:", { error })
    return null
  }
}