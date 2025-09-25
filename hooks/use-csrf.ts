/**
 * Client-side CSRF token hook
 * Automatically includes CSRF token in API requests
 */

import { useEffect, useState } from 'react'

let csrfToken: string | null = null

/**
 * Hook to get and manage CSRF token
 */
export function useCSRF() {
  const [token, setToken] = useState<string | null>(csrfToken)
  const [loading, setLoading] = useState(!csrfToken)

  useEffect(() => {
    if (!csrfToken) {
      // Get CSRF token from cookie
      const cookies = document.cookie.split(';')
      const csrfCookie = cookies.find(c => c.trim().startsWith('ml-agent-csrf='))
      
      if (csrfCookie) {
        csrfToken = csrfCookie.split('=')[1] || null
        setToken(csrfToken)
      }
      
      setLoading(false)
    }
  }, [])

  return { token, loading }
}

/**
 * Add CSRF token to fetch headers
 */
export function addCSRFHeader(headers: HeadersInit = {}): HeadersInit {
  const token = getCSRFTokenFromCookie()
  
  if (token) {
    return {
      ...headers,
      'x-csrf-token': token
    }
  }
  
  return headers
}

/**
 * Get CSRF token from browser cookie
 */
function getCSRFTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  
  const cookies = document.cookie.split(';')
  const csrfCookie = cookies.find(c => c.trim().startsWith('ml-agent-csrf='))
  
  return csrfCookie ? (csrfCookie.split('=')[1] || null) : null
}

/**
 * Enhanced fetch with automatic CSRF token
 */
export async function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
  const enhancedOptions = {
    ...options,
    headers: addCSRFHeader(options.headers)
  }
  
  return fetch(url, enhancedOptions)
}