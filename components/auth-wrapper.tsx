"use client"

import { ReactNode, useEffect } from "react"

/**
 * AuthWrapper - Gerencia autenticação e cleanup de dados legados
 *
 * NOTA: O hook useTokenRefresh foi DESATIVADO porque:
 * 1. Sistema migrou para sessões server-side via cookies
 * 2. Token refresh é feito automaticamente pelo servidor
 * 3. O hook antigo causava LOOP INFINITO de reload:
 *    - refreshToken era sempre "session-active" (fake)
 *    - localStorage tinha valores antigos de ml_expires_at
 *    - Hook tentava refresh → erro → logout → redirect → loop
 *
 * @date 2025-11-24
 */
export function AuthWrapper({ children }: { children: ReactNode }) {
  // 🧹 CLEANUP: Remover dados obsoletos do localStorage que causavam loops
  useEffect(() => {
    const cleanupLegacyData = () => {
      try {
        // Remover tokens antigos que não são mais usados (sessão é via cookie agora)
        const legacyKeys = [
          'ml_access_token',
          'ml_refresh_token',
          'ml_expires_at',
          'ml_user_id',
          'ws_auth_token',
          'ws_auth_token_time'
        ]

        legacyKeys.forEach(key => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key)
            console.log(`[AuthWrapper] Removed legacy key: ${key}`)
          }
        })
      } catch (e) {
        // Ignorar erros de storage (ex: modo privado)
      }
    }

    // Executar cleanup apenas uma vez no mount
    cleanupLegacyData()
  }, [])

  return <>{children}</>
}