"use client"

import { logger } from '@/lib/logger'
import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"

interface User {
  id: string
  nickname: string
  email?: string
  siteId: string
}

interface Organization {
  id: string
  subscriptionStatus: string
  trialEndsAt?: string
  subscriptionEndsAt?: string
}

interface AuthContextType {
  user: User | null
  organization: Organization | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Check session via API
    const checkAuth = async () => {
      // Skip check on auth pages
      if (pathname?.startsWith("/auth") || pathname === "/login") {
        setIsLoading(false)
        return
      }
      
      try {
        // Check session via our API
        const response = await fetch("/api/auth/session", {
          credentials: "include"
        })
        
        if (!response.ok) {
          // Session invalid
          setIsLoading(false)
          // Only redirect if trying to access protected route
          if (pathname?.startsWith("/dashboard")) {
            logger.info("Session invalid, redirecting to login")
            router.push("/login")
          }
          return
        }
        
        const sessionData = await response.json()
        
        // Set auth state from session
        setUser(sessionData.user)
        setOrganization(sessionData.organization)
        
        // Para compatibilidade, vamos manter um token fake
        // O token real está criptografado no banco
        setAccessToken("session-active")
        setRefreshToken("session-active")
        
        setIsLoading(false)
        
        logger.info("Auth check complete - user authenticated as:", { data: sessionData.user.nickname })
      } catch (error) {
        logger.error("Auth check failed:", { error })
        setIsLoading(false)
        if (pathname?.startsWith("/dashboard")) {
          router.push("/login")
        }
      }
    }

    checkAuth()
  }, [pathname, router])

  const logout = async () => {
    try {
      // Call logout API
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      })
    } catch (error) {
      logger.error("Logout error:", { error })
    }
    
    // Clear state
    setUser(null)
    setOrganization(null)
    setAccessToken(null)
    setRefreshToken(null)
    
    // SEMPRE usar domínio fixo!
    window.location.href = "https://gugaleo.axnexlabs.com.br/login"
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        accessToken,
        refreshToken,
        isLoading,
        isAuthenticated: !!user,
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