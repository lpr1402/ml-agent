'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Download,
  Smartphone,
  Monitor,
  Share,
  Plus,
  Bell,
  CheckCircle,
  Apple,
  Home
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

  // Instruções para iOS
  if (isIOS && browser === 'safari') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="bg-gradient-to-br from-gray-900 to-black rounded-t-3xl sm:rounded-3xl w-full max-w-md border border-gold/30 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center shadow-xl">
                    <Apple className="w-8 h-8 text-black" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">Instalar ML Agent</h3>
                    <p className="text-gray-400 text-sm">App nativo para iOS</p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Instructions */}
              <div className="space-y-4">
                <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-gold font-bold text-sm">1</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">
                        Toque no botão compartilhar
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Share className="w-5 h-5 text-blue-400" />
                        </div>
                        <p className="text-gray-400 text-sm">na barra inferior</p>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-gold font-bold text-sm">2</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">
                        Role e toque em &quot;Adicionar à Tela de Início&quot;
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="p-2 bg-gray-500/20 rounded-lg">
                          <Plus className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-gray-400 text-sm">Adicionar à Tela de Início</p>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-gold font-bold text-sm">3</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">
                        Toque em &quot;Adicionar&quot;
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        O app será instalado na sua tela inicial
                      </p>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-gold" />
                    <span className="text-white text-sm">Notificações 24/7</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 flex items-center gap-2">
                    <Home className="w-4 h-4 text-gold" />
                    <span className="text-white text-sm">Acesso Rápido</span>
                  </div>
                </div>

                {/* Action */}
                <Button
                  onClick={handleDismiss}
                  className="w-full bg-gradient-to-r from-gold to-yellow-600 hover:from-yellow-600 hover:to-gold text-black font-bold py-3 rounded-xl"
                >
                  Entendi
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Prompt para Chrome/Edge no Windows/Android
  // IMPORTANTE: Só mostrar se tiver deferredPrompt capturado (senão não tem como instalar)
  if ((platform === 'windows' || platform === 'android') && deferredPrompt) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md z-[9999]"
        >
          <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 rounded-2xl shadow-2xl border border-gold/30 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-gold/10 opacity-50" />

            <div className="relative p-5">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>

              {/* Content */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center shadow-xl">
                    {platform === 'windows' ? (
                      <Monitor className="w-6 h-6 text-black" />
                    ) : (
                      <Smartphone className="w-6 h-6 text-black" />
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-white font-bold text-base">
                      Instale o ML Agent
                    </h3>
                    <p className="text-gray-400 text-sm mt-0.5">
                      Acesse rapidamente com notificações em tempo real
                    </p>
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                      <Bell className="w-3 h-3 text-gold" />
                      <span className="text-xs text-gray-300">24/7</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-gray-300">Seguro</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                      <Download className="w-3 h-3 text-blue-400" />
                      <span className="text-xs text-gray-300">Offline</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleInstall}
                      className="flex-1 bg-gradient-to-r from-gold to-yellow-600 hover:from-yellow-600 hover:to-gold text-black font-bold py-2 rounded-lg"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Instalar Agora
                    </Button>
                    <Button
                      onClick={handleDismiss}
                      variant="ghost"
                      className="text-gray-400 hover:text-white hover:bg-white/10 py-2 px-3 rounded-lg"
                    >
                      Depois
                    </Button>
                  </div>
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