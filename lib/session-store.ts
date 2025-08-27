// Production-ready session store for managing ML access tokens
// Tokens are stored in memory with expiration handling

interface SessionData {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  userId: string
  nickname: string
}

class SessionStore {
  private sessions: Map<string, SessionData> = new Map()
  
  constructor() {
    console.log(`[SessionStore] Initialized new session store`)
  }
  
  // Store session data for a user
  setSession(userId: string, data: {
    accessToken: string
    refreshToken: string
    expiresIn: number
    nickname: string
  }) {
    const expiresAt = new Date(Date.now() + (data.expiresIn * 1000))
    
    this.sessions.set(userId, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt,
      userId,
      nickname: data.nickname
    })
    
    console.log(`[SessionStore] Stored session for user ${userId} (${data.nickname}), expires at ${expiresAt}`)
  }
  
  // Get access token for a user
  async getAccessToken(userId: string): Promise<string | null> {
    const session = this.sessions.get(userId)
    
    if (!session) {
      console.log(`[SessionStore] No session found for user ${userId}`)
      console.log(`[SessionStore] Active sessions:`, this.getActiveSessions())
      return null
    }
    
    // Check if token is expired
    if (new Date() >= session.expiresAt) {
      console.log(`[SessionStore] Token expired for user ${userId}, attempting refresh...`)
      
      // In production, refresh the token here
      const refreshed = await this.refreshAccessToken(userId, session.refreshToken)
      if (refreshed) {
        return refreshed.accessToken
      }
      
      // If refresh fails, remove session
      this.sessions.delete(userId)
      return null
    }
    
    return session.accessToken
  }
  
  // Refresh access token
  private async refreshAccessToken(userId: string, refreshToken: string): Promise<{ accessToken: string } | null> {
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
        console.error(`[SessionStore] Failed to refresh token for user ${userId}`)
        return null
      }
      
      const data = await response.json()
      
      // Update session with new tokens
      const session = this.sessions.get(userId)
      if (session) {
        this.setSession(userId, {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
          nickname: session.nickname
        })
      }
      
      return { accessToken: data.access_token }
    } catch (error) {
      console.error(`[SessionStore] Error refreshing token for user ${userId}:`, error)
      return null
    }
  }
  
  // Remove session
  removeSession(userId: string) {
    this.sessions.delete(userId)
    console.log(`[SessionStore] Removed session for user ${userId}`)
  }
  
  // Check if user has active session
  hasSession(userId: string): boolean {
    return this.sessions.has(userId)
  }
  
  // Get all active sessions (for monitoring)
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys())
  }
}

// Singleton instance
export const sessionStore = new SessionStore()

// Helper function to store session from auth callback
export function storeUserSession(userData: {
  userId: string
  accessToken: string
  refreshToken: string
  expiresIn: number
  nickname: string
}) {
  sessionStore.setSession(userData.userId, {
    accessToken: userData.accessToken,
    refreshToken: userData.refreshToken,
    expiresIn: userData.expiresIn,
    nickname: userData.nickname
  })
}