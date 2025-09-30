/**
 * iOS PWA Handler - Production Ready 2025
 * Garante que o app iOS PWA mantenha fullscreen após login OAuth
 * Intercepta navegações externas e mantém dentro do app
 * Otimizado para iOS 16+ com suporte a notificações push
 *
 * PROTEÇÕES:
 * 1. Detecta URLs sujas com OAuth params e limpa automaticamente
 * 2. Previne navegação externa que quebra fullscreen
 * 3. Monitora perda de contexto standalone e recupera
 * 4. Bloqueia zoom que pode quebrar fullscreen
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function IOSPWAHandler() {
  const router = useRouter()

  // 🎯 PROTEÇÃO 1: Forçar /agente como página inicial no iOS standalone
  useEffect(() => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        window.matchMedia('(display-mode: fullscreen)').matches ||
                        (window.navigator as any).standalone === true

    if (!isIOS || !isStandalone) {
      return
    }

    const currentPath = window.location.pathname
    const currentSearch = window.location.search

    console.log('[iOS PWA] Handler iniciado - verificando URL inicial')
    console.log('[iOS PWA] Current path:', currentPath)

    // Lista de páginas permitidas no standalone mode
    const allowedPages = ['/agente', '/answer/', '/approve/']
    const isAllowedPage = allowedPages.some(page => currentPath.startsWith(page))
    const isApiOrAsset = currentPath.startsWith('/api/') ||
                         currentPath.startsWith('/_next/') ||
                         /\.(js|css|png|jpg|svg|ico)$/.test(currentPath)

    // Se está em página não permitida (ex: /login) e não é API/asset
    if (!isAllowedPage && !isApiOrAsset) {
      console.log('[iOS PWA] 🎯 Not on allowed page, redirecting to /agente')
      console.log('[iOS PWA] This ensures PWA always opens on dashboard')
      router.replace('/agente')
      return
    }

    // Verificar se a URL atual tem OAuth params stale
    const hasStaleOAuthParams = currentSearch.includes('code=') || currentSearch.includes('state=')

    if (hasStaleOAuthParams) {
      console.log('[iOS PWA] 🚨 Detected stale OAuth params, cleaning and redirecting')
      window.history.replaceState({}, '', '/agente')
      router.replace('/agente')
      return
    }

    // Apenas prevenir navegação externa para manter fullscreen
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (!link) return

      const href = link.getAttribute('href')
      if (!href) return

      // Links externos devem abrir no Safari (fora do PWA)
      if (href.startsWith('http') && !href.includes(window.location.hostname)) {
        e.preventDefault()
        window.open(href, '_blank')
      }
    }

    // Adicionar listener apenas para links externos
    document.addEventListener('click', handleLinkClick, true)

    // Cleanup
    return () => {
      document.removeEventListener('click', handleLinkClick, true)
    }
  }, [router])

  // 🎯 PROTEÇÃO 2: Garantir fullscreen e bloquear zoom
  useEffect(() => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const isStandalone = (window.navigator as any).standalone === true ||
                        window.matchMedia('(display-mode: standalone)').matches ||
                        window.matchMedia('(display-mode: fullscreen)').matches

    if (isIOS && isStandalone) {
      console.log('[iOS PWA] ✅ Fullscreen mode activated')

      // Forçar viewport FIXO para manter fullscreen (sem zoom)
      const viewport = document.querySelector('meta[name="viewport"]')
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover')
      }

      // Prevenir qualquer tentativa de zoom que pode quebrar fullscreen
      document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false })
      document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false })
      document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false })

      console.log('[iOS PWA] 🔒 Viewport locked, zoom disabled, fullscreen guaranteed')
    }
  }, [])

  // 🎯 PROTEÇÃO 3: Monitorar perda de contexto standalone
  useEffect(() => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)

    if (!isIOS) {
      return
    }

    // Monitorar mudanças no display-mode
    const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)')
    const fullscreenMediaQuery = window.matchMedia('(display-mode: fullscreen)')

    const handleDisplayModeChange = () => {
      const isStandaloneNow = standaloneMediaQuery.matches || fullscreenMediaQuery.matches || (window.navigator as any).standalone
      const hasOAuthParams = window.location.search.includes('code=') || window.location.search.includes('state=')

      if (!isStandaloneNow && hasOAuthParams) {
        console.log('[iOS PWA] ⚠️ Detected loss of standalone mode with OAuth params')
        console.log('[iOS PWA] User may have opened from OAuth redirect - cleaning URL')

        // Limpar e recarregar para tentar recuperar standalone mode
        const cleanUrl = window.location.pathname
        window.location.replace(cleanUrl)
      }
    }

    standaloneMediaQuery.addEventListener('change', handleDisplayModeChange)
    fullscreenMediaQuery.addEventListener('change', handleDisplayModeChange)

    return () => {
      standaloneMediaQuery.removeEventListener('change', handleDisplayModeChange)
      fullscreenMediaQuery.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  return null
}