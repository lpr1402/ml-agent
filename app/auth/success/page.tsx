"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

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

      console.log("Auth Success - Processing params:", {
        hasAccessToken: !!accessToken,
        hasUserId: !!userId,
        hasRefreshToken: !!refreshToken,
        error
      })

      if (error) {
        console.error("Auth error:", error)
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
        
        console.log("Auth Success - Tokens stored, redirecting to dashboard")
        
        // Clear URL params for security
        window.history.replaceState({}, document.title, "/auth/success")
        
        setStatus("success")
        
        // Redirect to dashboard
        setTimeout(() => {
          router.push("/dashboard")
        }, 500)
      } else {
        console.error("Missing required auth data")
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor: '#0A0A0A'}}>
      <div className="flex flex-col items-center justify-center">
        {/* Logo ML Agent sem fundo */}
        <div style={{
          width: '80px',
          height: '80px',
          position: 'relative',
          marginBottom: '32px'
        }}>
          <img 
            src="/mlagent-logo-3d.png" 
            alt="ML Agent" 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
          />
          {/* Loading Ring */}
          {status === "processing" && (
            <div style={{
              position: 'absolute',
              inset: '-10px',
              borderRadius: '50%',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderTopColor: '#FFE600',
              animation: 'spin 1.5s linear infinite'
            }}></div>
          )}
        </div>
        
        {/* Status Text */}
        <h2 style={{
          fontSize: '14px',
          fontWeight: '300',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#FFE600',
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
          {status === "success" && "Redirecionando"}
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