import { logger } from '@/lib/logger'

// 🛡️ Flag global para prevenir múltiplos redirects simultâneos
let isRedirecting = false

export class APIClient {
  // CRITICAL: Get session token for SSE authentication
  getSessionToken(): string | null {
    if (typeof document === 'undefined') return null

    const cookies = document.cookie.split(';')
    // Cookie padronizado para produção
    const sessionCookie = cookies.find(c =>
      c.trim().startsWith('ml-agent-session=')
    )

    if (sessionCookie) {
      return sessionCookie.split('=')[1] || null
    }

    return null
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    }
    
    // Add CSRF token for non-GET requests
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';')
      const csrfCookie = cookies.find(c => c.trim().startsWith('ml-agent-csrf='))
      if (csrfCookie) {
        headers['x-csrf-token'] = csrfCookie.split('=')[1] || ''
      }
    }
    
    // Session authentication is handled via cookies automatically
    // No need for Bearer tokens
    return headers
  }

  async get(url: string) {
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
      credentials: "include", // Important: include cookies
    })
    
    if (!response.ok) {
      logger.error(`API call failed: ${url} - Status: ${response.status}`)
      
      if (response.status === 401) {
        // Session expired - redirect to login (com guard contra loops)
        logger.warn("401 Unauthorized - Session expired")
        if (!isRedirecting) {
          isRedirecting = true
          window.location.href = "/login"
        }
        throw new Error("Unauthorized")
      }
      throw new Error(`API call failed: ${response.statusText}`)
    }
    
    return response.json()
  }

  async post(url: string, data?: any) {
    const options: RequestInit = {
      method: "POST",
      headers: this.getHeaders(),
      credentials: "include", // Important: include cookies
    }

    if (data) {
      options.body = JSON.stringify(data)
    }

    const response = await fetch(url, options)

    // Handle redirects (3xx) gracefully
    if (response.status >= 300 && response.status < 400) {
      // For logout specifically, consider redirect as success
      if (url.includes('/auth/logout')) {
        return { success: true, message: 'Logged out successfully' }
      }
      // For other endpoints, follow redirect
      return { redirected: true, location: response.headers.get('location') }
    }

    if (!response.ok) {
      // Try to get error details from response
      let errorBody: any = {}
      let errorDetails = response.statusText

      try {
        errorBody = await response.json()
        if (errorBody.error) {
          errorDetails = errorBody.error
        }
      } catch (_e) {
        // Response might not be JSON
      }

      // Only log as error if it's not an expected condition
      if (response.status >= 500 || (response.status === 400 && !errorDetails.includes("answered"))) {
        logger.error(`API POST failed: ${url} - Status: ${response.status}`, {
          status: response.status,
          error: errorDetails,
          body: errorBody
        })
      }

      if (response.status === 401) {
        if (typeof window !== 'undefined' && !isRedirecting) {
          const currentPath = window.location.pathname
          if (!currentPath.includes('/login') && !currentPath.includes('/auth')) {
            isRedirecting = true
            sessionStorage.clear()
            localStorage.removeItem('ml-agent-session')
            window.location.href = "/login?session_expired=true"
          }
        }
        throw new Error("Session expired. Please login again.")
      }

      // Create a more detailed error object
      const error: any = new Error(errorDetails)
      error.response = {
        status: response.status,
        data: errorBody
      }
      throw error
    }

    return response.json()
  }

  async put(url: string, data?: any) {
    const options: RequestInit = {
      method: "PUT",
      headers: this.getHeaders(),
      credentials: "include", // Important: include cookies
    }
    
    if (data) {
      options.body = JSON.stringify(data)
    }
    
    const response = await fetch(url, options)
    
    if (!response.ok) {
      logger.error(`API PUT failed: ${url} - Status: ${response.status}`)
      
      if (response.status === 401) {
        if (typeof window !== 'undefined' && !isRedirecting) {
          const currentPath = window.location.pathname
          if (!currentPath.includes('/login') && !currentPath.includes('/auth')) {
            isRedirecting = true
            sessionStorage.clear()
            localStorage.removeItem('ml-agent-session')
            window.location.href = "/login?session_expired=true"
          }
        }
        throw new Error("Session expired. Please login again.")
      }

      throw new Error(`API PUT failed: ${response.statusText}`)
    }
    
    return response.json()
  }

  async delete(url: string) {
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.getHeaders(),
      credentials: "include", // Important: include cookies
    })
    
    if (!response.ok) {
      logger.error(`API DELETE failed: ${url} - Status: ${response.status}`)
      
      if (response.status === 401) {
        if (typeof window !== 'undefined' && !isRedirecting) {
          const currentPath = window.location.pathname
          if (!currentPath.includes('/login') && !currentPath.includes('/auth')) {
            isRedirecting = true
            sessionStorage.clear()
            localStorage.removeItem('ml-agent-session')
            window.location.href = "/login?session_expired=true"
          }
        }
        throw new Error("Session expired. Please login again.")
      }

      throw new Error(`API DELETE failed: ${response.statusText}`)
    }
    
    return response.json()
  }

  async clearAuth() {
    // Logout via API to clear server session
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: this.getHeaders(),
        credentials: "include"
      })

      if (response.ok) {
        const data = await response.json()
        logger.info("Logout successful", data)
      }
    } catch (error) {
      logger.error("Logout error:", { error })
    }
    window.location.href = "/login"
  }
}

export const apiClient = new APIClient()