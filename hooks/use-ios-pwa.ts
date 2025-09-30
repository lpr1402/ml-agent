/**
 * Hook para detectar e gerenciar PWA no iOS
 * Garante que o app mantenha fullscreen após login
 */

import { useEffect, useState } from 'react'

export function useIOSPWA() {
  const [isIOSPWA, setIsIOSPWA] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const checkIOSPWA = () => {
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        (window.navigator as any).standalone === true

      setIsIOSPWA(isIOS && standalone)
      setIsStandalone(standalone)

      // Log para debug
      if (isIOS) {
        console.log('[iOS PWA Hook] Status:', {
          isIOS,
          standalone,
          displayMode: window.matchMedia('(display-mode: standalone)').matches,
          navigatorStandalone: (window.navigator as any).standalone
        })
      }
    }

    checkIOSPWA()

    // Verificar mudanças no display mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleChange = () => checkIOSPWA()

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange)
      }
    }
  }, [])

  return { isIOSPWA, isStandalone }
}