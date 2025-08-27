"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  email: string
  name: string
  image: string | null
}

interface Session {
  user: User
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check if user has a valid session
    fetch("/api/auth/session")
      .then(res => {
        if (res.ok) {
          return res.json()
        }
        return null
      })
      .then(data => {
        setSession(data)
        setLoading(false)
      })
      .catch(() => {
        setSession(null)
        setLoading(false)
      })
  }, [])

  return {
    data: session,
    status: loading ? "loading" : session ? "authenticated" : "unauthenticated",
  }
}

export function signOut(options?: { callbackUrl?: string }) {
  // Clear the session cookie
  document.cookie = "authjs.session-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
  
  // Redirect to login or callback URL
  window.location.href = options?.callbackUrl || "/login"
}