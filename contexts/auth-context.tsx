"use client"

import { logger } from '@/lib/logger'
import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  saveSession,
  getSession,
  clearSession,
  setupSessionKeepAlive,
  isIOSStandalone
} from '@/lib/ios-session-persistence'

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
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Rotas públicas que não precisam de autenticação
const PUBLIC_ROUTES = ['/login', '/auth', '/api/']

// Rotas protegidas que requerem autenticação
const PROTECTED_ROUTES = ['/agente', '/dashboard']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Ref para evitar múltiplas verificações simultâneas
  const isCheckingAuth = useRef(false)
  const lastCheckTime = useRef(0)
  const cleanupKeepAlive = useRef<(() => void) | null>(null)

  // Verificar se rota é pública
  const isPublicRoute = useCallback((path: string | null) => {
    if (!path) return false
    return PUBLIC_ROUTES.some(route => path.startsWith(route))
  }, [])

  // Verificar se rota é protegida
  const isProtectedRoute = useCallback((path: string | null) => {
    if (!path) return false
    return PROTECTED_ROUTES.some(route => path.startsWith(route))
  }, [])

  // Função para validar sessão com API
  const validateSessionWithAPI = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store"
      })

      if (!response.ok) {
        return false
      }

      const sessionData = await response.json()

      if (!sessionData.authenticated || !sessionData.user) {
        return false
      }

      // Atualizar estado
      setUser(sessionData.user)
      setOrganization(sessionData.organization)
      setAccessToken("session-active")
      setRefreshToken("session-active")

      // Salvar sessão para persistência iOS
      await saveSession({
        user: sessionData.user,
        organization: sessionData.organization
      })

      return true
    } catch (error) {
      logger.error("API session validation failed:", { error })
      return false
    }
  }, [])

  // Função para carregar sessão do cache
  const loadCachedSession = useCallback(async (): Promise<boolean> => {
    try {
      const cachedSession = await getSession()

      if (cachedSession && cachedSession.user) {
        setUser(cachedSession.user)
        setOrganization(cachedSession.organization)
        setAccessToken("session-active")
        setRefreshToken("session-active")

        logger.info("[Auth] Loaded session from cache:", { data: cachedSession.user.nickname })
        return true
      }

      return false
    } catch (error) {
      logger.error("Failed to load cached session:", { error })
      return false
    }
  }, [])

  // Função principal de verificação de auth
  const checkAuth = useCallback(async () => {
    // Evitar verificações simultâneas
    if (isCheckingAuth.current) {
      return
    }

    // Throttle: não verificar mais que 1x a cada 5 segundos
    const now = Date.now()
    if (now - lastCheckTime.current < 5000 && user !== null) {
      return
    }

    isCheckingAuth.current = true
    lastCheckTime.current = now

    try {
      // Skip check em rotas públicas
      if (isPublicRoute(pathname)) {
        setIsLoading(false)
        isCheckingAuth.current = false
        return
      }

      // iOS PWA: Carregar do cache primeiro para UX instantânea
      const isIOS = isIOSStandalone()

      if (isIOS) {
        logger.info("[Auth] iOS PWA detected - loading from cache first")
        const hasCachedSession = await loadCachedSession()

        if (hasCachedSession) {
          setIsLoading(false)

          // Validar com API em background (não bloqueia UI)
          validateSessionWithAPI().then(isValid => {
            if (!isValid) {
              logger.warn("[Auth] Cached session invalid, clearing...")
              clearSession()
              setUser(null)
              setOrganization(null)
              setAccessToken(null)
              setRefreshToken(null)

              if (isProtectedRoute(pathname)) {
                router.push("/login")
              }
            }
          })

          isCheckingAuth.current = false
          return
        }
      }

      // Validar sessão com API (comportamento padrão)
      const isValid = await validateSessionWithAPI()

      if (!isValid) {
        logger.info("[Auth] Session invalid")

        // Limpar estado
        setUser(null)
        setOrganization(null)
        setAccessToken(null)
        setRefreshToken(null)
        await clearSession()

        // Redirecionar se em rota protegida
        if (isProtectedRoute(pathname)) {
          logger.info("[Auth] Redirecting to login")
          router.push("/login")
        }
      }

      setIsLoading(false)
    } catch (error) {
      logger.error("[Auth] Check failed:", { error })

      // Em caso de erro, tentar cache como fallback
      const hasCachedSession = await loadCachedSession()

      if (!hasCachedSession && isProtectedRoute(pathname)) {
        router.push("/login")
      }

      setIsLoading(false)
    } finally {
      isCheckingAuth.current = false
    }
  }, [pathname, router, user, isPublicRoute, isProtectedRoute, loadCachedSession, validateSessionWithAPI])

  // Função para refresh manual da sessão
  const refreshSession = useCallback(async () => {
    lastCheckTime.current = 0 // Reset throttle
    await checkAuth()
  }, [checkAuth])

  // Effect principal de autenticação
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Setup keep-alive para iOS PWA
  useEffect(() => {
    if (user && isIOSStandalone()) {
      logger.info("[Auth] Setting up iOS session keep-alive")
      cleanupKeepAlive.current = setupSessionKeepAlive()
    }

    return () => {
      if (cleanupKeepAlive.current) {
        cleanupKeepAlive.current()
        cleanupKeepAlive.current = null
      }
    }
  }, [user])

  // Listener para quando app volta do background (iOS PWA)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isIOSStandalone()) {
        logger.info("[Auth] iOS PWA became visible - refreshing session")
        // Delay pequeno para garantir que conexão está estável
        setTimeout(() => {
          refreshSession()
        }, 500)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshSession])

  // Função de logout
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

    // Limpar sessão persistida
    await clearSession()

    // Cleanup keep-alive
    if (cleanupKeepAlive.current) {
      cleanupKeepAlive.current()
      cleanupKeepAlive.current = null
    }

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
        refreshSession,
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
