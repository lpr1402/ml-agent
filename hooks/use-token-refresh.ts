import { logger } from '@/lib/logger'
import { useEffect, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"

export function useTokenRefresh() {
  const { refreshToken, logout } = useAuth()
  const router = useRouter()
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!refreshToken) return

    const checkAndRefreshToken = async () => {
      const expiresAt = localStorage.getItem("ml_expires_at")
      if (!expiresAt) return

      const now = Date.now()
      const expiry = parseInt(expiresAt)
      
      // Refresh if token expires in less than 10 minutes
      if (expiry - now < 10 * 60 * 1000) {
        logger.info("Token expiring soon, refreshing...")
        
        try {
          const response = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              refresh_token: refreshToken,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            
            // Update stored tokens
            localStorage.setItem("ml_access_token", data.access_token)
            localStorage.setItem("ml_refresh_token", data.refresh_token)
            
            // Update expiration time
            const newExpiresAt = Date.now() + (data.expires_in * 1000)
            localStorage.setItem("ml_expires_at", newExpiresAt.toString())
            
            logger.info("Token refreshed successfully")
            
            // Reload the page to update auth context
            window.location.reload()
          } else {
            logger.error("Failed to refresh token")
            logout()
            router.push("/login")
          }
        } catch (error) {
          logger.error("Error refreshing token:", { error })
          logout()
          router.push("/login")
        }
      }
    }

    // Check immediately
    checkAndRefreshToken()

    // Check every 5 minutes
    refreshIntervalRef.current = setInterval(checkAndRefreshToken, 5 * 60 * 1000)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [refreshToken, logout, router])
}