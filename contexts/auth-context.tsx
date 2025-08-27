"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"

interface User {
  id: string
  email: string
  name: string
}

interface AuthContextType {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Simple auth check - just verify tokens exist
    const checkAuth = () => {
      // Skip check on auth pages
      if (pathname?.startsWith("/auth") || pathname === "/login") {
        setIsLoading(false)
        return
      }
      
      const token = localStorage.getItem("ml_access_token")
      const refresh = localStorage.getItem("ml_refresh_token")
      const userId = localStorage.getItem("ml_user_id")
      const userName = localStorage.getItem("ml_user_name")
      const userEmail = localStorage.getItem("ml_user_email")
      const expiresAt = localStorage.getItem("ml_expires_at")
      
      // Check if we have required data
      if (!token || !userId) {
        setIsLoading(false)
        // Only redirect if trying to access protected route
        if (pathname?.startsWith("/dashboard")) {
          console.log("No auth tokens found, redirecting to login")
          router.push("/login")
        }
        return
      }
      
      // Don't check expiration on client side - let the API handle it
      // This prevents premature logouts
      
      // Set auth state
      setUser({
        id: userId,
        name: userName || "User",
        email: userEmail || ""
      })
      setAccessToken(token)
      setRefreshToken(refresh || null)
      setIsLoading(false)
      
      console.log("Auth check complete - user authenticated as:", userName)
    }

    checkAuth()
  }, [pathname, router])

  const logout = () => {
    // Clear all auth data
    localStorage.removeItem("ml_access_token")
    localStorage.removeItem("ml_refresh_token")
    localStorage.removeItem("ml_user_id")
    localStorage.removeItem("ml_user_name")
    localStorage.removeItem("ml_user_email")
    localStorage.removeItem("ml_expires_at")
    
    setUser(null)
    setAccessToken(null)
    setRefreshToken(null)
    
    router.push("/login")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isLoading,
        isAuthenticated: !!accessToken && !!user,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}