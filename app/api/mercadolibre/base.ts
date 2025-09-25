import { logger } from '@/lib/logger'
import { NextRequest } from "next/server"
import { getCurrentSession } from "@/lib/auth/ml-auth"
import { prisma } from "@/lib/prisma"
import { decryptToken } from "@/lib/security/encryption"

export interface AuthData {
  accessToken: string
  userId: string
}

export interface SessionAuthData {
  accessToken: string
  mlAccount: {
    id: string
    mlUserId: string
    nickname: string
    email: string | null
    siteId: string
  }
  organization: {
    id: string
    primaryMLUserId: string
  }
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
    logger.error("Auth extraction failed:", { error })
    return null
  }
}

// Nova função que usa o sistema de sessão criptografada
export async function getSessionAuth(): Promise<SessionAuthData | null> {
  try {
    const session = await getCurrentSession()
    
    if (!session) {
      logger.info('[Auth] No active session found')
      return null
    }
    
    // Buscar conta ML ativa
    const mlAccount = await prisma.mLAccount.findFirst({
      where: {
        id: session.activeMLAccountId,
        isActive: true
      },
      include: {
        organization: {
          select: {
            id: true,
            primaryMLUserId: true
          }
        }
      }
    })
    
    if (!mlAccount) {
      logger.info('[Auth] No active ML account found')
      return null
    }
    
    // Descriptografar token
    const accessToken = decryptToken({
      encrypted: mlAccount.accessToken,
      iv: mlAccount.accessTokenIV!,
      authTag: mlAccount.accessTokenTag!
    })
    
    return {
      accessToken,
      mlAccount: {
        id: mlAccount.id,
        mlUserId: mlAccount.mlUserId,
        nickname: mlAccount.nickname,
        email: mlAccount.email,
        siteId: mlAccount.siteId
      },
      organization: {
        id: mlAccount.organization!.id,
        primaryMLUserId: mlAccount.organization!.primaryMLUserId || ''
      }
    }
    
  } catch (error) {
    logger.error('[Auth] Session auth failed:', { error })
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