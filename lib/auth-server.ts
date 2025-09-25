import { logger } from '@/lib/logger'
import { NextRequest } from "next/server"

export async function extractAuthHeader(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    
    if (authHeader?.startsWith("Bearer ")) {
      return {
        accessToken: authHeader.substring(7),
        userId: ""
      }
    }
    
    return null
  } catch (error) {
    logger.error("Auth extraction failed:", { error })
    return null
  }
}