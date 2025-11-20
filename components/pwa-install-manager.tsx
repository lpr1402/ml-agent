'use client'

// ML Agent PWA Install Manager - Enterprise Gold 2025
// Banner iOS-like compacto + Modal Premium
// Mobile-first, clean, high-end UX sem emojis

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Download,
  Smartphone,
  Monitor,
  Chrome,
  Share,
  Plus,
  Bell,
  CheckCircle,
  Info,
  Apple,
  Zap
} from 'lucide-react'
import { Button } from './ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'ios' | 'android' | 'windows' | 'macos' | 'unknown'
type Browser = 'safari' | 'chrome' | 'firefox' | 'edge' | 'unknown'

export function PWAInstallManager() {
  const [showInstructions, setShowInstructions] = useState(false)
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [browser, setBrowser] = useState<Browser>('unknown')
  const [isInstalled, setIsInstalled] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Detectar plataforma e navegador
    const detectPlatform = () => {
      const ua = navigator.userAgent
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
      const isAndroid = /Android/.test(ua)
      const isWindows = /Windows/.test(ua)
      const isMac = /Macintosh/.test(ua)

      if (isIOS) setPlatform('ios')
      else if (isAndroid) setPlatform('android')
      else if (isWindows) setPlatform('windows')
      else if (isMac) setPlatform('macos')
      else setPlatform('unknown')

      // Detectar navegador
      if (ua.includes('Safari') && !ua.includes('Chrome')) setBrowser('safari')
      else if (ua.includes('Chrome')) setBrowser('chrome')
      else if (ua.includes('Firefox')) setBrowser('firefox')
      else if (ua.includes('Edg')) setBrowser('edge')
      else setBrowser('unknown')
    }

    detectPlatform()

    // Verificar se já está instalado
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone
      const isInstalled = isStandalone || isInStandaloneMode || document.referrer.includes('android-app://')

      setIsInstalled(isInstalled)

      // Se não está instalado e não foi dismissado, mostrar banner após 5 segundos
      if (!isInstalled && !localStorage.getItem('pwa-install-dismissed')) {
        setTimeout(() => {
          setShowBanner(true)
        }, 5000)
      }
    }

    checkInstalled()

    // Capturar evento de instalação (Chrome/Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      // Mostrar banner customizado
      if (!localStorage.getItem('pwa-install-dismissed')) {
        setShowBanner(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Detectar quando o app é instalado
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setShowBanner(false)
      setShowInstructions(false)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Chrome/Edge - usar prompt nativo
      try {
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
          setIsInstalled(true)
          setShowBanner(false)
        }

        setDeferredPrompt(null)
      } catch (error) {
        console.error('Erro ao instalar:', error)
        setShowInstructions(true)
        setShowBanner(false)
      }
    } else {
      // iOS/Safari ou sem prompt - mostrar instruções
      setShowInstructions(true)
      setShowBanner(false)
    }
  }

  const handleDismiss = () => {
    setShowBanner(false)
    setShowInstructions(false)
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  const handleShowInstructions = () => {
    setShowInstructions(true)
  }

  // Não mostrar nada se já está instalado
  if (isInstalled && !showInstructions) {
    return null
  }

  const isMobile = platform === 'ios' || platform === 'android'

  return (
    <>
      {/* Banner iOS-like Compacto - Mobile */}
      <AnimatePresence>
        {showBanner && !dismissed && isMobile && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-4 sm:left-auto sm:right-6 sm:max-w-md sm:rounded-xl"
            style={{
              paddingBottom: platform === 'ios' ? 'max(12px, env(safe-area-inset-bottom))' : '0'
            }}
          >
            <div className="bg-gradient-to-br from-black/98 via-gray-950/98 to-black/98 backdrop-blur-2xl border-t border-gold/30 sm:border sm:border-gold/20 sm:rounded-xl shadow-2xl">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-gold/10 via-transparent to-gold/10 opacity-50 pointer-events-none" />

              <div className="relative px-4 py-3 sm:p-4">
                <div className="flex items-center gap-3">
                  {/* Logo */}
                  <div className="relative flex-shrink-0">
                    <Image
                      src="/mlagent-logo-3d.svg"
                      alt="ML Agent"
                      width={40}
                      height={40}
                      className="relative"
                      style={{
                        filter: 'drop-shadow(0 0 15px rgba(212, 175, 55, 0.4))'
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm sm:text-base truncate">
                      Instalar ML Agent
                    </h3>
                    <p className="text-gray-400 text-xs sm:text-sm truncate">
                      Notificações 24/7 e acesso rápido
                    </p>
                  </div>

                  {/* Install Button */}
                  <Button
                    onClick={handleInstallClick}
                    className="flex-shrink-0 bg-gradient-to-r from-gold via-gold-light to-gold text-black font-bold text-xs sm:text-sm px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-gold/40 transition-all active:scale-95"
                  >
                    Instalar
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Banner Desktop - Modal Compact */}
        {showBanner && !dismissed && !isMobile && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 max-w-md"
          >
            <div className="bg-gradient-to-br from-black/95 via-gray-950/95 to-black/95 backdrop-blur-xl rounded-2xl border border-gold/20 shadow-2xl overflow-hidden">
              {/* Premium glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-gold/10 opacity-40 pointer-events-none" />
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-gold/20 blur-3xl rounded-full" />

              <div className="relative p-5">
                {/* Close */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>

                <div className="flex items-start gap-4">
                  {/* Logo */}
                  <div className="flex-shrink-0">
                    <Image
                      src="/mlagent-logo-3d.svg"
                      alt="ML Agent"
                      width={48}
                      height={48}
                      className="drop-shadow-2xl"
                      style={{
                        filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.4))'
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-white font-bold text-base">
                        Instalar ML Agent
                      </h3>
                      <p className="text-gray-400 text-sm mt-0.5">
                        Aplicativo nativo com notificações em tempo real
                      </p>
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 bg-gradient-to-r from-gold/10 to-gold/5 border border-gold/20 rounded-lg px-2.5 py-1">
                        <Bell className="w-3.5 h-3.5 text-gold" strokeWidth={2} />
                        <span className="text-xs text-gold font-semibold">Notificações</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gradient-to-r from-gold/10 to-gold/5 border border-gold/20 rounded-lg px-2.5 py-1">
                        <Zap className="w-3.5 h-3.5 text-gold" strokeWidth={2} />
                        <span className="text-xs text-gold font-semibold">Rápido</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gradient-to-r from-gold/10 to-gold/5 border border-gold/20 rounded-lg px-2.5 py-1">
                        <CheckCircle className="w-3.5 h-3.5 text-gold" strokeWidth={2} />
                        <span className="text-xs text-gold font-semibold">Seguro</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleInstallClick}
                        className="flex-1 bg-gradient-to-r from-gold via-gold-light to-gold text-black font-bold text-sm py-2.5 rounded-lg hover:shadow-lg hover:shadow-gold/40 transition-all active:scale-95"
                      >
                        <Download className="w-4 h-4 mr-2" strokeWidth={2.5} />
                        Instalar Agora
                      </Button>
                      <Button
                        onClick={handleShowInstructions}
                        variant="outline"
                        className="border-gold/30 text-gold hover:bg-gold/10 hover:border-gold/40 py-2.5 px-3 rounded-lg"
                      >
                        <Info className="w-4 h-4" strokeWidth={2} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Instruções Premium */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setShowInstructions(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="bg-gradient-to-br from-black via-gray-950 to-black rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gold/20 w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-hidden backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Premium Effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

              {/* Header Sticky */}
              <div className="sticky top-0 bg-gradient-to-b from-black/95 to-black/80 backdrop-blur-xl border-b border-gold/20 p-4 sm:p-5 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/mlagent-logo-3d.svg"
                      alt="ML Agent"
                      width={36}
                      height={36}
                      style={{
                        filter: 'drop-shadow(0 0 15px rgba(212, 175, 55, 0.3))'
                      }}
                    />
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white">
                        Como Instalar
                      </h2>
                      <p className="text-xs text-gray-400">
                        {platform === 'ios' ? 'iOS Safari' :
                         platform === 'android' ? 'Android' :
                         platform === 'windows' ? 'Windows Desktop' :
                         'Guia de Instalação'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowInstructions(false)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Content Scrollable */}
              <div className="overflow-y-auto max-h-[calc(85vh-80px)] sm:max-h-[calc(90vh-90px)] p-4 sm:p-5 space-y-5">
                {/* Platform-specific instructions */}
                {platform === 'ios' && browser === 'safari' ? (
                  <IosInstructions />
                ) : platform === 'ios' && browser !== 'safari' ? (
                  <IosChromeInstructions />
                ) : platform === 'windows' || platform === 'macos' ? (
                  <DesktopInstructions browser={browser} platform={platform} />
                ) : platform === 'android' ? (
                  <AndroidInstructions />
                ) : (
                  <GenericInstructions />
                )}

                {/* Benefits Section */}
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <h3 className="text-sm font-bold text-gold">
                    Benefícios do App
                  </h3>
                  <div className="space-y-2.5">
                    <BenefitItem
                      icon={<Bell className="w-4 h-4" />}
                      title="Notificações em Tempo Real"
                      description="Receba alertas instantâneos de novas perguntas"
                    />
                    <BenefitItem
                      icon={<Smartphone className="w-4 h-4" />}
                      title="Acesso Rápido"
                      description="Ícone na tela inicial para acesso direto"
                    />
                    <BenefitItem
                      icon={<Zap className="w-4 h-4" />}
                      title="Experiência Completa"
                      description="Interface em tela cheia sem barras do navegador"
                    />
                  </div>
                </div>

                {/* Close Button Bottom */}
                <div className="pt-4">
                  <Button
                    onClick={() => setShowInstructions(false)}
                    className="w-full bg-gradient-to-r from-gold via-gold-light to-gold text-black font-bold py-3 rounded-lg hover:shadow-lg hover:shadow-gold/40 transition-all active:scale-95"
                  >
                    Entendi
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Instruções iOS Safari - Clean e High-end
function IosInstructions() {
  return (
    <div className="space-y-4">
      {/* Feature Badge */}
      <div className="bg-gradient-to-r from-gold/10 to-gold/5 border border-gold/30 rounded-xl p-3.5">
        <div className="flex items-center gap-2">
          <Apple className="w-4 h-4 text-gold" strokeWidth={2} />
          <p className="text-gold text-sm font-semibold">
            iOS 16.4+ com Push Notifications
          </p>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
          Notificações funcionam quando instalado na tela inicial
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <InstructionStep
          number={1}
          icon={<Share className="w-4 h-4" />}
          iconColor="text-blue-400"
          iconBg="from-blue-500/20 to-blue-500/10"
          title="Toque no botão Compartilhar"
          description="Ícone de compartilhamento na barra inferior do Safari"
        />

        <InstructionStep
          number={2}
          icon={<Plus className="w-4 h-4" />}
          iconColor="text-gold"
          iconBg="from-gold/20 to-gold/10"
          title="Adicionar à Tela de Início"
          description="Role para baixo no menu de opções"
        />

        <InstructionStep
          number={3}
          icon={<CheckCircle className="w-4 h-4" />}
          iconColor="text-green-400"
          iconBg="from-green-500/20 to-green-500/10"
          title="Confirme a instalação"
          description="Toque em Adicionar no canto superior direito"
        />
      </div>
    </div>
  )
}

// Instruções iOS Chrome - Redirecionamento
function IosChromeInstructions() {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-red-500/10 to-red-500/5 border border-red-500/30 rounded-xl p-3.5">
        <div className="flex items-start gap-2.5">
          <Apple className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <p className="text-red-400 text-sm font-semibold">
              iOS exige Safari
            </p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Push notifications só funcionam quando instalado via Safari
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <InstructionStep
          number={1}
          icon={<Chrome className="w-4 h-4" />}
          iconColor="text-gold"
          iconBg="from-gold/20 to-gold/10"
          title="Abra no Safari"
          description="Copie o link e cole no Safari para melhor experiência"
        />

        <InstructionStep
          number={2}
          icon={<Share className="w-4 h-4" />}
          iconColor="text-blue-400"
          iconBg="from-blue-500/20 to-blue-500/10"
          title="Use o botão Compartilhar"
          description="Disponível na barra inferior do Safari"
        />

        <InstructionStep
          number={3}
          icon={<Plus className="w-4 h-4" />}
          iconColor="text-green-400"
          iconBg="from-green-500/20 to-green-500/10"
          title="Adicione à Tela de Início"
          description="Confirme para instalar o app"
        />
      </div>
    </div>
  )
}

// Instruções Desktop - Windows/Mac
function DesktopInstructions({ browser, platform }: { browser: Browser; platform: Platform }) {
  return (
    <div className="space-y-4">
      {/* Platform Badge */}
      <div className="bg-gradient-to-r from-gold/10 to-gold/5 border border-gold/30 rounded-xl p-3.5">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-gold" strokeWidth={2} />
          <p className="text-gold text-sm font-semibold">
            Aplicativo Nativo {platform === 'windows' ? 'Windows' : 'Desktop'}
          </p>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
          Experiência completa com notificações e acesso rápido
        </p>
      </div>

      {browser === 'chrome' || browser === 'edge' ? (
        <div className="space-y-3">
          <InstructionStep
            number={1}
            icon={<Download className="w-4 h-4" />}
            iconColor="text-gold"
            iconBg="from-gold/20 to-gold/10"
            title="Clique em Instalar"
            description="Ícone de instalação na barra de endereços (lado direito)"
          />

          <InstructionStep
            number={2}
            icon={<CheckCircle className="w-4 h-4" />}
            iconColor="text-green-400"
            iconBg="from-green-500/20 to-green-500/10"
            title="Confirme a Instalação"
            description="Clique em Instalar na janela que aparecer"
          />

          <InstructionStep
            number={3}
            icon={<Monitor className="w-4 h-4" />}
            iconColor="text-blue-400"
            iconBg="from-blue-500/20 to-blue-500/10"
            title="App Instalado"
            description="ML Agent será adicionado ao Menu Iniciar"
          />
        </div>
      ) : (
        <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/30 rounded-xl p-3.5">
          <div className="flex items-start gap-2.5">
            <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <div>
              <p className="text-amber-400 text-sm font-semibold">
                Use Chrome ou Edge
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Para instalar como aplicativo nativo no {platform === 'windows' ? 'Windows' : 'desktop'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Instruções Android
function AndroidInstructions() {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <InstructionStep
          number={1}
          icon={<Chrome className="w-4 h-4" />}
          iconColor="text-gold"
          iconBg="from-gold/20 to-gold/10"
          title="Toque no menu"
          description="Três pontos no canto superior direito"
        />

        <InstructionStep
          number={2}
          icon={<Plus className="w-4 h-4" />}
          iconColor="text-gold"
          iconBg="from-gold/20 to-gold/10"
          title="Adicionar à tela inicial"
          description="Ou selecione Instalar aplicativo"
        />

        <InstructionStep
          number={3}
          icon={<CheckCircle className="w-4 h-4" />}
          iconColor="text-green-400"
          iconBg="from-green-500/20 to-green-500/10"
          title="Confirme a instalação"
          description="O app será adicionado à sua tela inicial"
        />
      </div>
    </div>
  )
}

// Instruções genéricas
function GenericInstructions() {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-gold/10 to-gold/5 border border-gold/30 rounded-xl p-4 text-center">
        <Info className="w-6 h-6 text-gold mx-auto mb-2" strokeWidth={2} />
        <p className="text-white text-sm font-medium">
          Procure a opção de instalação no menu do seu navegador
        </p>
        <p className="text-gray-400 text-xs mt-1.5">
          Geralmente em Mais opções ou Configurações
        </p>
      </div>
    </div>
  )
}

// Componente de passo - Enterprise Clean
function InstructionStep({
  number,
  icon,
  iconColor,
  iconBg,
  title,
  description
}: {
  number: number
  icon: React.ReactNode
  iconColor: string
  iconBg: string
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3 group">
      {/* Number Badge */}
      <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 border border-gold/40 flex items-center justify-center">
        <span className="text-gold font-bold text-sm">{number}</span>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${iconBg} border border-white/10 flex items-center justify-center`}>
            <div className={iconColor}>{icon}</div>
          </div>
          <h4 className="text-white font-semibold text-sm flex-1">{title}</h4>
        </div>
        <p className="text-gray-400 text-xs leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

// Componente de benefício - Enterprise Style
function BenefitItem({
  icon,
  title,
  description
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 hover:border-gold/20 transition-all">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold/20 to-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
        <div className="text-gold">{icon}</div>
      </div>
      <div className="flex-1">
        <h4 className="text-white text-sm font-semibold">{title}</h4>
        <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
