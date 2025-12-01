"use client"

import { logger } from '@/lib/logger'
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from 'next/image'

export default function AuthSuccessPage() {
  const router = useRouter()
  const [status, setStatus] = useState("processing")

  useEffect(() => {
    // Process auth params from URL
    const processAuth = () => {
      // Get params directly from window.location
      const urlParams = new URLSearchParams(window.location.search)
      
      const accessToken = urlParams.get("access_token")
      const refreshToken = urlParams.get("refresh_token")
      const userId = urlParams.get("user_id")
      const userName = urlParams.get("user_name")
      const userEmail = urlParams.get("user_email")
      const expiresIn = urlParams.get("expires_in")
      const error = urlParams.get("error")

      logger.info("Auth Success - Processing params:", {
        hasAccessToken: !!accessToken,
        hasUserId: !!userId,
        hasRefreshToken: !!refreshToken,
        error
      })

      if (error) {
        logger.error("Auth error:", { error })
        router.push(`/login?error=${error}`)
        return
      }

      if (accessToken && userId) {
        // Store auth data in localStorage
        localStorage.setItem("ml_access_token", accessToken)
        localStorage.setItem("ml_refresh_token", refreshToken || "")
        localStorage.setItem("ml_user_id", userId)
        localStorage.setItem("ml_user_name", userName || "")
        localStorage.setItem("ml_user_email", userEmail || "")
        
        // Calculate and store expiration time (6 hours as per ML docs)
        const expiresAt = Date.now() + (parseInt(expiresIn || "21600") * 1000)
        localStorage.setItem("ml_expires_at", expiresAt.toString())
        
        logger.info("Auth Success - Tokens stored, redirecting to dashboard")
        
        // Clear URL params for security
        window.history.replaceState({}, document.title, "/auth/success")
        
        setStatus("success")
        
        // Redirect to dashboard
        setTimeout(() => {
          router.push("/dashboard")
        }, 500)
      } else {
        logger.error("Missing required auth data")
        setStatus("error")
        router.push("/login?error=missing_data")
      }
    }

    // Run after component mounts
    if (typeof window !== "undefined") {
      processAuth()
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6" style={{backgroundColor: '#0A0A0A'}}>
      <div className="flex flex-col items-center justify-center max-w-md w-full">
        {/* Logo ML Agent */}
        <div style={{
          width: '64px',
          height: '64px',
          position: 'relative',
          marginBottom: '24px'
        }}>
          <Image
            src="/mlagent-logo-3d.png"
            alt="ML Agent"
            width={64}
            height={64}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.3))'
            }}
          />
          {/* Loading Ring */}
          {status === "processing" && (
            <div style={{
              position: 'absolute',
              inset: '-10px',
              borderRadius: '50%',
              border: '2px solid rgba(212, 175, 55, 0.2)',
              borderTopColor: '#D4AF37',
              animation: 'spin 1.2s linear infinite'
            }}></div>
          )}
        </div>

        {/* Status Text */}
        <h2 style={{
          fontSize: '13px',
          fontWeight: '600',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#D4AF37',
          marginBottom: '8px'
        }}>
          {status === "processing" && "Autenticando"}
          {status === "success" && "Autenticado"}
          {status === "error" && "Erro"}
        </h2>

        <p style={{
          fontSize: '12px',
          color: '#666666',
          textAlign: 'center'
        }}>
          {status === "processing" && "Conectando com o Mercado Livre"}
          {status === "success" && "Redirecionando para o painel"}
          {status === "error" && "Falha na autenticação"}
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}