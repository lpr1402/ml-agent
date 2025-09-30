'use client'

// ML Agent PWA Install Manager - Premium Design 2025
// Otimizado para iOS com notificações push e fullscreen
// Suporte completo iOS 16.4+ Safari

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
  ArrowUpFromLine
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

          // Feedback visual para Windows
          if (platform === 'windows' || platform === 'macos') {
            // Mostrar notificação de sucesso
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('ML Agent Instalado!', {
                body: 'O aplicativo foi instalado com sucesso no seu computador',
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png'
              })
            }
          }
        }

        setDeferredPrompt(null)
      } catch (error) {
        console.error('Erro ao instalar:', error)
        // Fallback para mostrar instruções
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
    setShowBanner(false)
  }

  // Não mostrar nada se já está instalado
  if (isInstalled && !showInstructions) {
    return null
  }

  return (
    <>
      {/* Banner de instalação */}
      <AnimatePresence>
        {showBanner && !dismissed && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50"
          >
            <div className="bg-gradient-to-br from-black via-gray-950 to-black rounded-2xl shadow-2xl border border-gold/20 overflow-hidden backdrop-blur-xl">
              {/* Premium glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30" />
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-gold/10 blur-3xl rounded-full" />

              <div className="relative p-4 sm:p-6">
                {/* Close button */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-2 right-2 p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>

                <div className="flex items-start gap-4">
                  {/* ML Agent Logo Premium */}
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gold/20 blur-xl rounded-full" />
                      <Image
                        src="/mlagent-logo-3d.svg"
                        alt="ML Agent"
                        width={48}
                        height={48}
                        className="relative drop-shadow-2xl"
                        style={{
                          filter: 'drop-shadow(0 0 20px rgba(255, 230, 0, 0.3))'
                        }}
                        priority
                      />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-white font-semibold text-base">
                          ML Agent
                        </h3>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">
                        {platform === 'ios' ? (
                          <>Notificações push 24/7 • Fullscreen no iOS 16.4+</>
                        ) : platform === 'windows' ? (
                          <>Aplicativo nativo do Windows com notificações em tempo real</>
                        ) : (
                          <>Acesso rápido, notificações e experiência otimizada</>
                        )}
                      </p>
                    </div>

                    {/* Features Premium */}
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gold/10 border border-gold/20">
                        <Bell className="w-3 h-3 text-gold" />
                        <span className="text-xs text-gold font-medium">Push 24/7</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gold/10 border border-gold/20">
                        <Smartphone className="w-3 h-3 text-gold" />
                        <span className="text-xs text-gold font-medium">{platform === 'windows' ? 'Desktop App' : 'Fullscreen'}</span>
                      </div>
                      {platform === 'ios' && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          <span className="text-xs text-emerald-400 font-medium">iOS 16.4+</span>
                        </div>
                      )}
                      {platform === 'windows' && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                          <Monitor className="w-3 h-3 text-blue-400" />
                          <span className="text-xs text-blue-400 font-medium">Windows</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleInstallClick}
                        className="flex-1 bg-gradient-to-r from-gold to-yellow-600 hover:from-gold/90 hover:to-yellow-600/90 text-black font-semibold transition-all hover:scale-105"
                        size="sm"
                      >
                        {platform === 'windows' ? 'Instalar App' : 'Instalar Agora'}
                      </Button>
                      <Button
                        onClick={handleShowInstructions}
                        variant="outline"
                        className="border-gold/30 text-gold hover:bg-gold/10"
                        size="sm"
                      >
                        <Info className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de instruções */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowInstructions(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-black via-gray-950 to-black rounded-2xl shadow-2xl border border-gold/20 max-w-lg w-full max-h-[90vh] overflow-y-auto backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Premium background effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-20 pointer-events-none rounded-2xl" />
              {/* Header */}
              <div className="sticky top-0 bg-black/90 backdrop-blur border-b border-gold/20 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* ML Agent Logo */}
                    <Image
                      src="/mlagent-logo-3d.svg"
                      alt="ML Agent"
                      width={40}
                      height={40}
                      className="drop-shadow-2xl"
                      style={{
                        filter: 'drop-shadow(0 0 15px rgba(255, 230, 0, 0.3))'
                      }}
                      priority
                    />
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        ML Agent
                      </h2>
                      <p className="text-xs text-gray-400">
                        {platform === 'ios' ? 'iOS 16.4+ Suportado' :
                         platform === 'android' ? 'Android PWA' :
                         'Instalação Desktop'}
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

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-6">
                {/* Platform-specific instructions */}
                {platform === 'ios' && browser === 'safari' ? (
                  <IosInstructions />
                ) : platform === 'ios' && browser !== 'safari' ? (
                  <IosChromeInstructions />
                ) : platform === 'windows' || platform === 'macos' ? (
                  <DesktopInstructions browser={browser} />
                ) : platform === 'android' ? (
                  <AndroidInstructions browser={browser} />
                ) : (
                  <GenericInstructions />
                )}

                {/* Benefits */}
                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-semibold text-white">
                    Benefícios do App
                  </h3>
                  <div className="space-y-2">
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
                      icon={<CheckCircle className="w-4 h-4" />}
                      title="Experiência Otimizada"
                      description="Interface em tela cheia sem barras do navegador"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Instruções para iOS Safari - Otimizado 2025
function IosInstructions() {
  return (
    <div className="space-y-4">
      {/* iOS Capabilities Badge */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <p className="text-emerald-400 text-sm font-medium">
            ✨ iOS 16.4+ com Push Notifications e Fullscreen
          </p>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Notificações funcionam quando instalado na tela inicial
        </p>
      </div>

      <div className="text-center mb-4">
        <p className="text-gray-300 text-sm">
          3 passos rápidos para instalar no iPhone/iPad
        </p>
      </div>

      <div className="space-y-3">
        <InstructionStep
          number={1}
          icon={<Share className="w-4 h-4" />}
          title="Toque no botão Compartilhar"
          description="Encontre o ícone de compartilhamento na barra inferior do Safari"
        />

        <InstructionStep
          number={2}
          icon={<Plus className="w-4 h-4" />}
          title='Selecione "Adicionar à Tela de Início"'
          description="Role para baixo no menu de opções"
        />

        <InstructionStep
          number={3}
          icon={<CheckCircle className="w-4 h-4" />}
          title="Confirme a instalação"
          description='Toque em "Adicionar" no canto superior direito'
        />
      </div>

      {/* Visual guide Premium */}
      <div className="mt-6 p-4 bg-gradient-to-br from-gold/10 to-yellow-600/5 rounded-xl border border-gold/20">
        <div className="flex items-center justify-center gap-2 text-gold">
          <ArrowUpFromLine className="w-5 h-5 animate-bounce" />
          <span className="text-sm font-bold">
            Toque no botão compartilhar do Safari
          </span>
        </div>
      </div>

      {/* Important iOS Note */}
      <div className="text-xs text-center text-gray-500">
        <p>📱 Após instalar, o app abrirá em tela cheia sem barras</p>
        <p className="mt-1">🔔 Notificações push 24/7 quando instalado</p>
      </div>
    </div>
  )
}

// Instruções para iOS com Chrome - Redirecionamento para Safari
function IosChromeInstructions() {
  return (
    <div className="space-y-4">
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Apple className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 text-sm font-medium">
              🚨 iOS exige Safari para instalar PWAs
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Push notifications só funcionam quando instalado via Safari
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <InstructionStep
          number={1}
          icon={<Chrome className="w-4 h-4" />}
          title="Abra esta página no Safari"
          description="Copie o link e cole no Safari para melhor experiência"
        />

        <InstructionStep
          number={2}
          icon={<Share className="w-4 h-4" />}
          title="Use o botão Compartilhar do Safari"
          description="Disponível na barra inferior"
        />

        <InstructionStep
          number={3}
          icon={<Plus className="w-4 h-4" />}
          title='Adicione à "Tela de Início"'
          description="Confirme para instalar o app"
        />
      </div>
    </div>
  )
}

// Instruções para Desktop - Otimizado para Windows
function DesktopInstructions({ browser }: { browser: Browser }) {
  return (
    <div className="space-y-4">
      {/* Windows Features Badge */}
      <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-blue-400" />
          <p className="text-blue-400 text-sm font-medium">
            🚀 Aplicativo Nativo no Windows
          </p>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Experiência completa com notificações e acesso rápido
        </p>
      </div>

      <div className="text-center mb-4">
        <p className="text-gray-300 text-sm font-semibold">
          Instale o ML Agent como aplicativo no Windows
        </p>
        <p className="text-gray-400 text-xs mt-1">
          Funciona como um aplicativo desktop completo
        </p>
      </div>

      {browser === 'chrome' || browser === 'edge' ? (
        <>
          <div className="space-y-3">
            <InstructionStep
              number={1}
              icon={<Download className="w-4 h-4" />}
              title="Instalação Automática"
              description="Clique no botão de instalação na barra de endereços (lado direito)"
            />

            <InstructionStep
              number={2}
              icon={<CheckCircle className="w-4 h-4" />}
              title="Confirme a Instalação"
              description='Clique em "Instalar" na janela pop-up que aparecer'
            />

            <InstructionStep
              number={3}
              icon={<Monitor className="w-4 h-4" />}
              title="App Instalado!"
              description="O ML Agent será adicionado ao Menu Iniciar e Área de Trabalho"
            />
          </div>

          {/* Visual Guide for Windows */}
          <div className="mt-4 p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 rounded-xl border border-blue-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Download className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Instalação Rápida</p>
                  <p className="text-gray-400 text-xs">Procure este ícone na barra de URL →</p>
                </div>
              </div>
              <div className="animate-pulse">
                <div className="px-3 py-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30">
                  <span className="text-blue-400 text-xs font-bold">Instalar</span>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits for Windows */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="p-2 bg-gray-900/50 rounded-lg border border-gray-800">
              <p className="text-xs text-gold font-medium">✨ Menu Iniciar</p>
              <p className="text-xs text-gray-400 mt-1">Acesso rápido</p>
            </div>
            <div className="p-2 bg-gray-900/50 rounded-lg border border-gray-800">
              <p className="text-xs text-gold font-medium">🔔 Notificações</p>
              <p className="text-xs text-gray-400 mt-1">Windows nativas</p>
            </div>
            <div className="p-2 bg-gray-900/50 rounded-lg border border-gray-800">
              <p className="text-xs text-gold font-medium">🖥️ Área de Trabalho</p>
              <p className="text-xs text-gray-400 mt-1">Ícone direto</p>
            </div>
            <div className="p-2 bg-gray-900/50 rounded-lg border border-gray-800">
              <p className="text-xs text-gold font-medium">⚡ Performance</p>
              <p className="text-xs text-gray-400 mt-1">Otimizado</p>
            </div>
          </div>
        </>
      ) : browser === 'firefox' ? (
        <div className="space-y-3">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 text-sm font-medium">
                  Firefox tem suporte limitado para PWA
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Recomendamos usar Chrome ou Edge para melhor experiência no Windows
                </p>
              </div>
            </div>
          </div>

          <InstructionStep
            number={1}
            icon={<Chrome className="w-4 h-4" />}
            title="Abra no Chrome ou Edge"
            description="Para instalar como aplicativo nativo do Windows"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-amber-400 text-sm">
              Use Chrome ou Edge para instalar o app no Windows
            </p>
          </div>

          <InstructionStep
            number={1}
            icon={<Chrome className="w-4 h-4" />}
            title="Abra no Chrome ou Edge"
            description="Estes navegadores suportam instalação completa de PWA no Windows"
          />
        </div>
      )}

      {/* Atalhos de teclado Windows */}
      <div className="mt-4 p-3 bg-black/50 rounded-lg border border-gray-800">
        <p className="text-xs text-gray-400">
          💡 Dica Windows: Após instalar, você pode fixar o ML Agent na barra de tarefas para acesso instantâneo
        </p>
      </div>
    </div>
  )
}

// Instruções para Android
function AndroidInstructions({ browser: _browser }: { browser: Browser }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <InstructionStep
          number={1}
          icon={<Chrome className="w-4 h-4" />}
          title="Toque no menu (⋮)"
          description="No canto superior direito do navegador"
        />

        <InstructionStep
          number={2}
          icon={<Plus className="w-4 h-4" />}
          title='Selecione "Adicionar à tela inicial"'
          description="Ou 'Instalar aplicativo'"
        />

        <InstructionStep
          number={3}
          icon={<CheckCircle className="w-4 h-4" />}
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
      <div className="text-center">
        <p className="text-gray-300 text-sm">
          Procure a opção de instalação no menu do seu navegador
        </p>
      </div>
    </div>
  )
}

// Componente de passo
function InstructionStep({
  number,
  icon,
  title,
  description
}: {
  number: number
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-gold/20 to-yellow-600/20 border border-gold/30 flex items-center justify-center">
        <span className="text-gold font-semibold text-sm">{number}</span>
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <div className="text-gold">{icon}</div>
          <h4 className="text-white font-medium text-sm">{title}</h4>
        </div>
        <p className="text-gray-400 text-xs">{description}</p>
      </div>
    </div>
  )
}

// Componente de benefício
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
    <div className="flex gap-3">
      <div className="text-gold flex-shrink-0">{icon}</div>
      <div>
        <h4 className="text-white text-sm font-medium">{title}</h4>
        <p className="text-gray-400 text-xs">{description}</p>
      </div>
    </div>
  )
}