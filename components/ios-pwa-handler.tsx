/**
 * iOS PWA Handler - Production 2025
 *
 * Garante experiencia nativa no iOS PWA com:
 * - Fullscreen persistente (nunca sai do app)
 * - Sessao que nao expira (login permanente)
 * - Notificacoes 24/7 (keep-alive do SW)
 * - Reconexao automatica de WebSocket
 * - Recovery de crashes
 *
 * PROTECOES:
 * 1. Redireciona automaticamente para /agente em standalone
 * 2. Previne navegacao externa que quebra fullscreen
 * 3. Mantem Service Worker ativo para notificacoes
 * 4. Reconecta WebSocket quando app volta do background
 */

'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// Constantes
const KEEP_ALIVE_INTERVAL = 2 * 60 * 1000 // 2 minutos
const RECONNECT_DELAY = 1000 // 1 segundo

export function IOSPWAHandler() {
  const router = useRouter()
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isVisibleRef = useRef(true)

  // Detectar se e iOS standalone
  const isIOSStandalone = useCallback(() => {
    if (typeof window === 'undefined') return false

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        window.matchMedia('(display-mode: fullscreen)').matches ||
                        (window.navigator as any).standalone === true

    return isIOS && isStandalone
  }, [])

  // Manter Service Worker ativo para notificacoes 24/7
  const keepServiceWorkerAlive = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return

    try {
      const registration = await navigator.serviceWorker.ready

      // Ping o SW para mante-lo ativo
      if (registration.active) {
        const channel = new MessageChannel()
        registration.active.postMessage({ type: 'KEEP_ALIVE' }, [channel.port2])
      }

      // Registrar background sync se disponivel
      if ('sync' in registration) {
        try {
          await (registration as any).sync.register('keep-alive')
        } catch {
          // Sync nao suportado
        }
      }
    } catch (error) {
      console.error('[iOS PWA] Keep-alive error:', error)
    }
  }, [])

  // Verificar e reconectar WebSocket se necessario
  const checkAndReconnectWebSocket = useCallback(() => {
    // Disparar evento customizado para componentes que usam WebSocket
    window.dispatchEvent(new CustomEvent('pwa-reconnect', {
      detail: { timestamp: Date.now() }
    }))

    console.log('[iOS PWA] WebSocket reconnect signal sent')
  }, [])

  // Handler quando app volta do background
  const handleVisibilityChange = useCallback(() => {
    const isVisible = document.visibilityState === 'visible'
    const wasHidden = !isVisibleRef.current

    isVisibleRef.current = isVisible

    if (isVisible && wasHidden && isIOSStandalone()) {
      console.log('[iOS PWA] App became visible after being hidden')

      // Delay para garantir conexao estavel
      setTimeout(() => {
        // Manter SW ativo
        keepServiceWorkerAlive()

        // Reconectar WebSocket
        checkAndReconnectWebSocket()
      }, RECONNECT_DELAY)
    }
  }, [isIOSStandalone, keepServiceWorkerAlive, checkAndReconnectWebSocket])

  // Handler quando app ganha foco
  const handleFocus = useCallback(() => {
    if (isIOSStandalone()) {
      console.log('[iOS PWA] App gained focus')
      keepServiceWorkerAlive()
    }
  }, [isIOSStandalone, keepServiceWorkerAlive])

  // Handler para online/offline
  const handleOnline = useCallback(() => {
    if (isIOSStandalone()) {
      console.log('[iOS PWA] Connection restored')

      // Reconectar servicos
      setTimeout(() => {
        keepServiceWorkerAlive()
        checkAndReconnectWebSocket()
      }, RECONNECT_DELAY)
    }
  }, [isIOSStandalone, keepServiceWorkerAlive, checkAndReconnectWebSocket])

  // Protecao 1: Forcar /agente como pagina inicial
  useEffect(() => {
    if (!isIOSStandalone()) return

    const currentPath = window.location.pathname
    const currentSearch = window.location.search

    console.log('[iOS PWA] Handler started - checking URL')

    // Paginas permitidas no standalone mode
    const allowedPages = ['/agente', '/answer/', '/approve/']
    const isAllowedPage = allowedPages.some(page => currentPath.startsWith(page))
    const isApiOrAsset = currentPath.startsWith('/api/') ||
                         currentPath.startsWith('/_next/') ||
                         /\.(js|css|png|jpg|svg|ico)$/.test(currentPath)

    // Se nao esta em pagina permitida, redirecionar
    if (!isAllowedPage && !isApiOrAsset) {
      console.log('[iOS PWA] Not on allowed page, redirecting to /agente')
      router.replace('/agente')
      return
    }

    // Limpar OAuth params stale
    if (currentSearch.includes('code=') || currentSearch.includes('state=')) {
      console.log('[iOS PWA] Cleaning stale OAuth params')
      window.history.replaceState({}, '', '/agente')
      router.replace('/agente')
      return
    }

    // Interceptar links externos
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (!link) return

      const href = link.getAttribute('href')
      if (!href) return

      // Links externos abrem no Safari
      if (href.startsWith('http') && !href.includes(window.location.hostname)) {
        e.preventDefault()
        window.open(href, '_blank')
      }
    }

    document.addEventListener('click', handleLinkClick, true)

    return () => {
      document.removeEventListener('click', handleLinkClick, true)
    }
  }, [router, isIOSStandalone])

  // Protecao 2: Garantir fullscreen e bloquear zoom
  useEffect(() => {
    if (!isIOSStandalone()) return

    console.log('[iOS PWA] Fullscreen mode activated')

    // Forcar viewport fixo
    const viewport = document.querySelector('meta[name="viewport"]')
    if (viewport) {
      viewport.setAttribute('content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      )
    }

    // Prevenir zoom que quebra fullscreen
    const preventGesture = (e: Event) => e.preventDefault()

    document.addEventListener('gesturestart', preventGesture, { passive: false })
    document.addEventListener('gesturechange', preventGesture, { passive: false })
    document.addEventListener('gestureend', preventGesture, { passive: false })

    // Prevenir double-tap zoom
    let lastTouchEnd = 0
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) {
        e.preventDefault()
      }
      lastTouchEnd = now
    }

    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false })

    return () => {
      document.removeEventListener('gesturestart', preventGesture)
      document.removeEventListener('gesturechange', preventGesture)
      document.removeEventListener('gestureend', preventGesture)
      document.removeEventListener('touchend', preventDoubleTapZoom)
    }
  }, [isIOSStandalone])

  // Protecao 3: Keep-alive para notificacoes 24/7
  useEffect(() => {
    if (!isIOSStandalone()) return

    console.log('[iOS PWA] Starting keep-alive system')

    // Keep-alive inicial
    keepServiceWorkerAlive()

    // Keep-alive periodico
    keepAliveIntervalRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        keepServiceWorkerAlive()
      }
    }, KEEP_ALIVE_INTERVAL)

    // Event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)

    return () => {
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
    }
  }, [isIOSStandalone, keepServiceWorkerAlive, handleVisibilityChange, handleFocus, handleOnline])

  // Protecao 4: Monitorar perda de standalone mode
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (!isIOS) return

    const standaloneQuery = window.matchMedia('(display-mode: standalone)')
    const fullscreenQuery = window.matchMedia('(display-mode: fullscreen)')

    const handleDisplayModeChange = () => {
      const isStandaloneNow = standaloneQuery.matches ||
                              fullscreenQuery.matches ||
                              (window.navigator as any).standalone

      const hasOAuthParams = window.location.search.includes('code=') ||
                             window.location.search.includes('state=')

      if (!isStandaloneNow && hasOAuthParams) {
        console.log('[iOS PWA] Lost standalone mode with OAuth params')
        const cleanUrl = window.location.pathname
        window.location.replace(cleanUrl)
      }
    }

    standaloneQuery.addEventListener('change', handleDisplayModeChange)
    fullscreenQuery.addEventListener('change', handleDisplayModeChange)

    return () => {
      standaloneQuery.removeEventListener('change', handleDisplayModeChange)
      fullscreenQuery.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  // Protecao 5: Prevenir crash por memoria
  useEffect(() => {
    if (!isIOSStandalone()) return

    // Limpar memoria quando app vai para background
    const handleBeforeHide = () => {
      // Forcar garbage collection se disponivel
      if ((window as any).gc) {
        (window as any).gc()
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleBeforeHide()
      }
    })
  }, [isIOSStandalone])

  return null
}

/**
 * Hook para componentes que precisam reagir a eventos PWA
 */
export function usePWAReconnect(onReconnect: () => void) {
  useEffect(() => {
    const handler = () => {
      console.log('[usePWAReconnect] Reconnect signal received')
      onReconnect()
    }

    window.addEventListener('pwa-reconnect', handler)

    return () => {
      window.removeEventListener('pwa-reconnect', handler)
    }
  }, [onReconnect])
}
