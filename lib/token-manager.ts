/**
 * Token Manager for 24/7 Operation
 * Handles token persistence, refresh, and automatic renewal
 */

import { prisma } from "./prisma"

interface TokenData {
  accessToken: string
  refreshToken: string
  expiresIn: number // seconds
  userId: string
}

class TokenManager {
  private refreshing: Map<string, Promise<string | null>> = new Map()
  
  constructor() {
    console.log('[TokenManager] Initialized')
  }

  /**
   * Store or update user tokens in database
   */
  async storeTokens(data: TokenData): Promise<void> {
    const expiresAt = new Date(Date.now() + (data.expiresIn * 1000))
    
    await prisma.userToken.upsert({
      where: { mlUserId: data.userId },
      update: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt,
        updatedAt: new Date()
      },
      create: {
        mlUserId: data.userId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt
      }
    })
    
    console.log(`[TokenManager] Stored tokens for user ${data.userId}, expires at ${expiresAt}`)
  }

  /**
   * Get valid access token for user, refreshing if necessary
   */
  async getAccessToken(userId: string): Promise<string | null> {
    try {
      // Check if already refreshing for this user
      if (this.refreshing.has(userId)) {
        return await this.refreshing.get(userId)!
      }

      // Get token from database
      const tokenData = await prisma.userToken.findUnique({
        where: { mlUserId: userId }
      })

      if (!tokenData) {
        console.log(`[TokenManager] No token found for user ${userId}`)
        return null
      }

      // Check if token is expired or about to expire (5 min buffer)
      const now = new Date()
      const expirationBuffer = new Date(tokenData.expiresAt.getTime() - 5 * 60 * 1000)
      
      if (now < expirationBuffer) {
        // Token is still valid
        return tokenData.accessToken
      }

      // Token needs refresh
      console.log(`[TokenManager] Token expired for user ${userId}, refreshing...`)
      
      // Create refresh promise to avoid multiple simultaneous refreshes
      const refreshPromise = this.refreshAccessToken(userId, tokenData.refreshToken)
      this.refreshing.set(userId, refreshPromise)
      
      try {
        const newToken = await refreshPromise
        return newToken
      } finally {
        this.refreshing.delete(userId)
      }
      
    } catch (error) {
      console.error(`[TokenManager] Error getting token for user ${userId}:`, error)
      return null
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(userId: string, refreshToken: string): Promise<string | null> {
    try {
      const response = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.AUTH_MERCADOLIBRE_ID!,
          client_secret: process.env.AUTH_MERCADOLIBRE_SECRET!,
          refresh_token: refreshToken
        })
      })

      if (!response.ok) {
        const error = await response.text()
        console.error(`[TokenManager] Failed to refresh token for user ${userId}:`, error)
        
        // If refresh fails, remove invalid tokens
        await prisma.userToken.delete({
          where: { mlUserId: userId }
        }).catch(() => {})
        
        return null
      }

      const data = await response.json()
      
      // Store new tokens
      await this.storeTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        userId
      })
      
      console.log(`[TokenManager] Successfully refreshed token for user ${userId}`)
      return data.access_token
      
    } catch (error) {
      console.error(`[TokenManager] Error refreshing token for user ${userId}:`, error)
      return null
    }
  }

  /**
   * Remove user tokens (for logout)
   */
  async removeTokens(userId: string): Promise<void> {
    await prisma.userToken.delete({
      where: { mlUserId: userId }
    }).catch(() => {})
    
    console.log(`[TokenManager] Removed tokens for user ${userId}`)
  }

  /**
   * Check if user has valid tokens
   */
  async hasValidToken(userId: string): Promise<boolean> {
    const token = await this.getAccessToken(userId)
    return token !== null
  }

  /**
   * Get all users with tokens (for monitoring)
   */
  async getAllTokenUsers(): Promise<string[]> {
    const users = await prisma.userToken.findMany({
      select: { mlUserId: true }
    })
    return users.map(u => u.mlUserId)
  }

  /**
   * Cleanup expired tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    
    const result = await prisma.userToken.deleteMany({
      where: {
        updatedAt: {
          lt: sixMonthsAgo
        }
      }
    })
    
    if (result.count > 0) {
      console.log(`[TokenManager] Cleaned up ${result.count} expired token(s)`)
    }
  }
}

// Singleton instance
export const tokenManager = new TokenManager()

// Helper function for auth callback
export async function storeUserTokens(data: {
  userId: string
  accessToken: string
  refreshToken: string
  expiresIn: number
}) {
  await tokenManager.storeTokens(data)
}

// Start cleanup job (runs every 24 hours)
if (typeof global !== 'undefined') {
  const g = global as any
  if (!g.tokenCleanupJob) {
    g.tokenCleanupJob = setInterval(() => {
      tokenManager.cleanupExpiredTokens()
    }, 24 * 60 * 60 * 1000) // 24 hours
    
    console.log('[TokenManager] Cleanup job scheduled')
  }
}