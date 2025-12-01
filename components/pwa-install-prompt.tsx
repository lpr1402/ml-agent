'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  X,
  Download,
  Share,
  Plus,
  Bell,
  CheckCircle,
  Zap
} from 'lucide-react'
import { Button } from './ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'ios' | 'android' | 'windows' | 'macos' | 'unknown'
type Browser = 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'brave' | 'unknown'

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [browser, setBrowser] = useState<Browser>('unknown')
  const [isInstalled, setIsInstalled] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  // const [isChrome, setIsChrome] = useState(false) // Reserved for future use

  useEffect(() => {
    // Detectar plataforma e navegador
    const ua = navigator.userAgent.toLowerCase()
    const isIPad = ua.includes('ipad')
    const isIPhone = ua.includes('iphone')
    const isIOSDevice = isIPad || isIPhone || (ua.includes('macintosh') && 'ontouchend' in document)
    const isAndroid = ua.includes('android')
    const isWindows = ua.includes('windows')
    const isMac = ua.includes('macintosh') && !('ontouchend' in document)

    setIsIOS(isIOSDevice)

    if (isIOSDevice) setPlatform('ios')
    else if (isAndroid) setPlatform('android')
    else if (isWindows) setPlatform('windows')
    else if (isMac) setPlatform('macos')

    // 🎯 CRITICAL iOS FIX: Limpar URL quando modal aparecer
    // iOS ignora start_url do manifest e salva URL atual
    // Solução: pushState para "/" quando mostrar modal de instalação iOS
    if (isIOSDevice && !window.matchMedia('(display-mode: standalone)').matches) {
      const currentPath = window.location.pathname
      const isSafari = ua.includes('safari') && !ua.includes('chrome')

      // Se está em /login ou qualquer página que não seja raiz
      // Mudar para "/" silenciosamente quando o usuário ver o modal
      if (isSafari && currentPath !== '/') {
        console.log('[PWA Install] iOS detected on non-root page:', currentPath)
        console.log('[PWA Install] Changing URL to / for clean installation')

        // Mudar URL para raiz sem reload
        // IMPORTANTE: Fazer isso ANTES de mostrar o modal
        window.history.pushState({}, '', '/')

        console.log('[PWA Install] ✅ URL changed to / - iOS will save clean URL')
      }
    }

    // Detectar navegador
    const isSafari = ua.includes('safari') && !ua.includes('chrome')
    const isChromeBrowser = ua.includes('chrome') && !ua.includes('edg')
    const isEdge = ua.includes('edg/')
    const isFirefox = ua.includes('firefox')
    const isSamsung = ua.includes('samsungbrowser')
    const isBrave = (navigator as any).brave !== undefined

    // setIsChrome(isChromeBrowser) // Reserved for future use

    if (isSafari) setBrowser('safari')
    else if (isSamsung) setBrowser('samsung')
    else if (isBrave) setBrowser('brave')
    else if (isChromeBrowser) setBrowser('chrome')
    else if (isEdge) setBrowser('edge')
    else if (isFirefox) setBrowser('firefox')

    console.log('[PWA Install] Platform:', isWindows ? 'Windows' : isAndroid ? 'Android' : isIOSDevice ? 'iOS' : 'Other')
    console.log('[PWA Install] Browser:', isChromeBrowser ? 'Chrome' : isEdge ? 'Edge' : isSafari ? 'Safari' : 'Other')

    // Verificar se está instalado
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          window.matchMedia('(display-mode: fullscreen)').matches ||
                          window.matchMedia('(display-mode: minimal-ui)').matches ||
                          (window.navigator as any).standalone === true

      setIsInstalled(isStandalone)
      console.log('[PWA Install] Is installed?', isStandalone)

      // Mostrar prompt se não instalado e não foi dismissado
      if (!isStandalone && !sessionStorage.getItem('pwa-prompt-dismissed')) {
        // Para iOS, sempre mostrar após 3 segundos em QUALQUER página
        if (isIOSDevice && isSafari) {
          setTimeout(() => {
            setShowPrompt(true)
            console.log('[PWA Install] Showing iOS prompt')
          }, 3000)
        }

        // Windows/Android - Mostrar popup automático após 5 segundos
        if ((isWindows || isAndroid) && !isIOSDevice) {
          setTimeout(() => {
            setShowPrompt(true)
            console.log('[PWA Install] Auto-showing install prompt for Windows/Android')
          }, 5000)
        }
      }
    }

    checkInstalled()

    // Capturar evento beforeinstallprompt (Chrome/Edge no Windows/Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[PWA Install] beforeinstallprompt event fired!')
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      if (setDeferredPrompt) {
        setDeferredPrompt(promptEvent)
      }

      // Armazenar globalmente para acesso posterior
      (window as any).deferredPrompt = promptEvent

      // NÃO MOSTRAR POPUP AUTOMÁTICO
      // O usuário deve clicar no botão para instalar
      console.log('[PWA Install] Prompt capturado, aguardando clique do usuário')
    }

    // Verificar se já existe um prompt armazenado
    if ((window as any).deferredPrompt) {
      console.log('[PWA Install] Found existing deferred prompt')
      if (setDeferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt)
      }
    }

    // Adicionar listener global para capturar o evento
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    console.log('[PWA Install] Listener added for beforeinstallprompt')

    // Detectar instalação
    const handleAppInstalled = () => {
      console.log('[PWA Install] App installed successfully!')
      setIsInstalled(true)
      setShowPrompt(false)
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, []) // Removido deferredPrompt das dependências!

  const handleInstall = async () => {
    console.log('[PWA Install] Install button clicked')
    console.log('[PWA Install] deferredPrompt available?', !!deferredPrompt)

    if (!deferredPrompt) {
      console.log('[PWA Install] No deferredPrompt available')
      return
    }

    try {
      // Chrome/Edge - chamar prompt nativo IMEDIATAMENTE
      console.log('[PWA Install] Calling prompt()...')
      await deferredPrompt.prompt()

      console.log('[PWA Install] Waiting for user choice...')
      const { outcome } = await deferredPrompt.userChoice
      console.log('[PWA Install] User choice:', outcome)

      if (outcome === 'accepted') {
        console.log('[PWA Install] Installation accepted!')
        setIsInstalled(true)
        setShowPrompt(false)
        sessionStorage.setItem('pwa-installed', 'true')
      } else {
        console.log('[PWA Install] Installation dismissed by user')
        // Fechar o prompt mesmo se o usuário recusou
        setShowPrompt(false)
      }
    } catch (error) {
      console.error('[PWA Install] Error during installation:', error)
      setShowPrompt(false)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    sessionStorage.setItem('pwa-prompt-dismissed', 'true')
  }

  if (isInstalled || !showPrompt) {
    return null
  }

  // Modal iOS - High-End e Minimalista
  if (isIOS && browser === 'safari') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-end sm:items-center justify-center"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="bg-black/60 backdrop-blur-2xl rounded-t-3xl sm:rounded-3xl w-full max-w-md border-t border-white/[0.08] sm:border shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
            style={{
              paddingBottom: 'max(20px, env(safe-area-inset-bottom))'
            }}
          >
            {/* Subtle glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-40 pointer-events-none rounded-t-3xl sm:rounded-3xl" />

            <div className="relative p-6 sm:p-8">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>

              {/* Logo & Title */}
              <div className="flex flex-col items-center gap-4 mb-6">
                <Image
                  src="/mlagent-logo-3d.png"
                  alt="ML Agent"
                  width={80}
                  height={80}
                  className="drop-shadow-2xl"
                  style={{
                    filter: 'drop-shadow(0 0 25px rgba(212, 175, 55, 0.4))'
                  }}
                />
                <div className="text-center">
                  {/* Logo ML Agent PRO */}
                  <Image
                    src="/mlagent-pro-logo.png"
                    alt="ML Agent PRO"
                    width={180}
                    height={50}
                    className="mb-2 drop-shadow-lg"
                    style={{
                      filter: 'drop-shadow(0 0 15px rgba(212, 175, 55, 0.3))'
                    }}
                  />
                  <p className="text-xs text-gray-500 font-light tracking-wider">
                    Instalar no iPhone
                  </p>
                </div>
              </div>

              {/* Steps - Clean & Minimal */}
              <div className="space-y-2.5 mb-6">
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Share className="w-3.5 h-3.5 text-blue-400" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">Toque em Compartilhar</p>
                    <p className="text-gray-500 text-xs">Barra inferior do Safari</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-gold" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">Adicionar à Tela de Início</p>
                    <p className="text-gray-500 text-xs">Role o menu para encontrar</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-3.5 h-3.5 text-green-400" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">Confirme e pronto!</p>
                    <p className="text-gray-500 text-xs">App instalado com sucesso</p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <Button
                onClick={handleDismiss}
                className="w-full bg-gradient-to-r from-gold via-gold-light to-gold text-black font-bold py-3 rounded-xl hover:shadow-xl hover:shadow-gold/50 transition-all active:scale-[0.98]"
              >
                Entendi
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Modal Windows/Desktop - High-End e Clean
  if ((platform === 'windows' || platform === 'android') && deferredPrompt) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-[9999] max-w-sm"
        >
          <div className="bg-black/60 backdrop-blur-2xl rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] border border-white/[0.08] overflow-hidden">
            {/* Premium glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold/8 via-transparent to-gold/8 opacity-50 pointer-events-none" />
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-gold/15 blur-3xl rounded-full" />

            <div className="relative p-5">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors z-10"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>

              {/* Content */}
              <div className="flex items-start gap-4">
                {/* Logo */}
                <div className="flex-shrink-0">
                  <Image
                    src="/mlagent-logo-3d.png"
                    alt="ML Agent"
                    width={56}
                    height={56}
                    className="drop-shadow-2xl"
                    style={{
                      filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.5))'
                    }}
                  />
                </div>

                <div className="flex-1 space-y-3 pr-6">
                  {/* Title */}
                  <div>
                    {/* Logo ML Agent PRO */}
                    <Image
                      src="/mlagent-pro-logo.png"
                      alt="ML Agent PRO"
                      width={140}
                      height={40}
                      className="mb-1 drop-shadow-lg"
                      style={{
                        filter: 'drop-shadow(0 0 12px rgba(212, 175, 55, 0.3))'
                      }}
                    />
                    <p className="text-xs text-gray-500">
                      Aplicativo nativo para {platform === 'windows' ? 'Windows' : 'Android'}
                    </p>
                  </div>

                  {/* Features - Ultra compacto */}
                  <div className="flex flex-wrap gap-1.5">
                    <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1">
                      <Bell className="w-3 h-3 text-gold" strokeWidth={2} />
                      <span className="text-[10px] text-gray-400 font-medium">Push 24/7</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1">
                      <Zap className="w-3 h-3 text-gold" strokeWidth={2} />
                      <span className="text-[10px] text-gray-400 font-medium">Rápido</span>
                    </div>
                  </div>

                  {/* Action */}
                  <Button
                    onClick={handleInstall}
                    className="w-full bg-gradient-to-r from-gold via-gold-light to-gold text-black font-bold text-sm py-2.5 rounded-xl hover:shadow-xl hover:shadow-gold/50 transition-all active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4 mr-2" strokeWidth={2.5} />
                    Instalar Agora
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Instruções genéricas para outros navegadores - removidas conforme solicitação
  return null
}