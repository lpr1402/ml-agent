/**
 * PWA Initializer Component
 * Registra service worker e solicita permissão para notificações
 */

'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { PWAInstallPrompt } from './pwa-install-prompt'

export function PWAInitializer() {
  const [showPermissionRequest, setShowPermissionRequest] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // 🔴 CRITICAL FIX: Listener para tocar sons quando Service Worker enviar mensagem
    // iOS/Windows precisam que o cliente toque o som (Service Worker não tem acesso ao Audio API)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'PLAY_NOTIFICATION_SOUND') {
          const { sound, volume = 0.8, repeat = 1 } = event.data

          console.log('[PWA] 🔊 Playing notification sound:', sound, 'volume:', volume, 'repeat:', repeat)

          try {
            const audio = new Audio(sound)
            audio.volume = volume

            // Tocar o som
            audio.play().catch(err => {
              console.warn('[PWA] Failed to play notification sound:', err)
            })

            // Se repeat > 1, tocar múltiplas vezes
            if (repeat > 1) {
              audio.addEventListener('ended', function playAgain() {
                const currentRepeat = (this as any).__repeat || 1
                if (currentRepeat < repeat) {
                  (this as any).__repeat = currentRepeat + 1
                  this.play().catch(err => console.warn('[PWA] Repeat play failed:', err))
                } else {
                  this.removeEventListener('ended', playAgain)
                }
              })
            }
          } catch (error) {
            console.error('[PWA] Error creating audio:', error)
          }
        }
      })
    }

    // Verificar contexto seguro
    const isSecureContext = window.isSecureContext
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1'

    // Verificar se está rodando como PWA instalada
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone ||
                        document.referrer.includes('android-app://');

    // Detectar iOS Safari - Atualizado para 2025
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/i.test(navigator.userAgent)

    // Verificar se pode registrar Service Worker
    if (!isSecureContext && !isLocalhost) {
      console.error('[PWA] Service Worker requires HTTPS or localhost')
      return
    }

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(registration => {
          // Detectar Windows
          const isWindows = /Windows/i.test(navigator.userAgent)

          // No iOS Safari, push notifications só funcionam se instalado como PWA
          if (isIOS && !isStandalone && isSafari) {
            return
          }

          // Verificar suporte a Push
          if (!('PushManager' in window)) {
            return
          }

          // NOVO COMPORTAMENTO: Pedir notificações LOGO AO ABRIR (como app nativo iOS)
          // Não esperar autenticação! Apps nativos pedem permissão antes de login

          if (isIOS && isStandalone) {
            // iOS PWA: Pedir permissão IMEDIATAMENTE ao abrir o app (500ms)
            if (Notification.permission === 'default') {
              setTimeout(() => {
                console.log('[PWA] iOS PWA detectado - pedindo permissão de notificações')
                setShowPermissionRequest(true)
              }, 500)
            } else if (Notification.permission === 'granted') {
              // Se já tem permissão, tentar inscrever quando autenticar
              checkAuthAndSubscribe()
            }
          } else if (isWindows) {
            // Windows: Verificar autenticação primeiro, pedir após 3s
            checkAuthAndSubscribe()
          }

          async function checkAuthAndSubscribe() {
            try {
              const res = await fetch('/api/auth/session')
              const data = await res.json()

              if (data.authenticated) {
                if (Notification.permission === 'default') {
                  setTimeout(() => {
                    setShowPermissionRequest(true)
                  }, 3000)
                } else if (Notification.permission === 'granted') {
                  subscribeToNotifications(registration)
                }
              }
            } catch {
              // Silenciosamente falhar
            }
          }
        })
        .catch(error => {
          console.error('[PWA] Service Worker registration failed:', error)
        })
    } else {
      console.log('[PWA] Service Worker not supported')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const subscribeToNotifications = async (registration: ServiceWorkerRegistration) => {
    try {
      // VAPID Public Key (mesma do backend)
      const vapidPublicKey = 'BFDQNvQB1cWQbPHStt5S6mRtVCGldecWfKMDWfyBx2HTPhvitpZdVE7kMIAQPpGawd5GN7XrzMnvfMq3n7NOM0g'

      // Verificar se pushManager está disponível
      if (!registration.pushManager) {
        throw new Error('PushManager not available in service worker registration')
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })

      // Enviar subscription para o servidor
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          deviceInfo: { name: getDeviceName() },
          preferences: {
            enableQuestions: true,
            enableUrgent: true,
            enableBatch: true
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      await response.json()
    } catch (error: any) {
      // Silenciosamente falhar se não conseguir registrar
      console.error('[PWA] Push subscription failed:', error.message)
    }
  }

  const handleEnableNotifications = async () => {
    setIsLoading(true)

    try {
      // 🎯 iOS Critical: Verificar standalone mode PRIMEIRO
      const isIOSDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone === true

      console.log('[PWA Notif] iOS:', isIOSDevice, 'Standalone:', isStandalone)

      // iOS: Notificações APENAS funcionam em standalone mode
      if (isIOSDevice && !isStandalone) {
        console.error('[PWA Notif] iOS needs standalone mode for notifications')
        setShowPermissionRequest(false)
        return
      }

      // Verificar suporte a notificações
      if (!('Notification' in window)) {
        console.error('[PWA Notif] Browser does not support notifications')
        setShowPermissionRequest(false)
        return
      }

      console.log('[PWA Notif] Current permission:', Notification.permission)

      // 🎯 iOS Critical: Aguardar service worker estar completamente pronto
      if ('serviceWorker' in navigator) {
        console.log('[PWA Notif] Waiting for service worker to be ready...')
        const registration = await navigator.serviceWorker.ready
        console.log('[PWA Notif] ✅ Service worker ready')

        // Verificar se pushManager está disponível
        if (!registration.pushManager) {
          console.error('[PWA Notif] PushManager not available')
          setShowPermissionRequest(false)
          return
        }
      }

      // Solicitar permissão
      console.log('[PWA Notif] Requesting permission...')
      const permission = await Notification.requestPermission()
      console.log('[PWA Notif] Permission result:', permission)

      if (permission === 'granted') {
        // Aguardar service worker registration
        const registration = await navigator.serviceWorker.ready

        // 🎯 iOS Fix: Pequeno delay antes de subscribe (iOS precisa processar permission)
        if (isIOSDevice) {
          console.log('[PWA Notif] iOS detected, waiting 500ms before subscribe...')
          await new Promise(resolve => setTimeout(resolve, 500))
        }

        await subscribeToNotifications(registration)

        console.log('[PWA Notif] ✅ Notifications enabled successfully!')
        setShowPermissionRequest(false)

      } else if (permission === 'denied') {
        console.log('[PWA Notif] Permission denied by user')
        setShowPermissionRequest(false)
      } else {
        // 'default' - usuário fechou sem escolher
        console.log('[PWA Notif] Permission prompt dismissed')
        setShowPermissionRequest(false)
      }

    } catch (error: any) {
      console.error('[PWA Notif] ❌ Error:', error)
      console.error('[PWA Notif] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      })

      // iOS: Se erro, fechar modal e permitir retry
      setShowPermissionRequest(false)

    } finally {
      setIsLoading(false)
    }
  }

  const urlBase64ToUint8Array = (base64String: string): BufferSource => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray.buffer
  }

  const getDeviceName = (): string => {
    const userAgent = navigator.userAgent
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iPhone'
    if (/Android/i.test(userAgent)) return 'Android'
    return 'Web Browser'
  }

  return (
    <>
      {/* PWA Install Prompt - cuida da instalação */}
      <PWAInstallPrompt />

      {/* Push Notification Request - Responsive & Clean 2025 */}
      <AnimatePresence>
        {showPermissionRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setShowPermissionRequest(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className="relative w-full max-w-[340px] sm:max-w-[400px] md:max-w-[440px] bg-black/60 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Subtle glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-40 pointer-events-none" />

              <div className="relative p-6 sm:p-8">
                {/* Close button - minimal */}
                <button
                  onClick={() => setShowPermissionRequest(false)}
                  className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                </button>

                {/* Header - Clean com logo */}
                <div className="flex flex-col items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
                  {/* Logo ML Agent 3D */}
                  <div className="relative">
                    <Image
                      src="/mlagent-logo-3d.png"
                      alt="ML Agent"
                      width={72}
                      height={72}
                      className="drop-shadow-2xl sm:w-20 sm:h-20"
                      style={{
                        filter: 'drop-shadow(0 0 25px rgba(212, 175, 55, 0.5))'
                      }}
                    />
                  </div>

                  <div className="text-center">
                    <div className="flex items-baseline justify-center gap-2 mb-1.5">
                      <h3 className="text-lg sm:text-xl font-light text-white tracking-wide">ML Agent</h3>
                      <span className="text-lg sm:text-xl font-extrabold italic bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">PRO</span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                      <strong className="text-gold">Essencial:</strong> Receba alertas 24/7
                    </p>
                  </div>
                </div>

                {/* Benefícios - Responsivo */}
                <div className="space-y-2 sm:space-y-2.5 mb-5 sm:mb-6">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gold flex-shrink-0" />
                    <p className="text-white text-xs sm:text-sm font-medium">Nunca perca uma venda</p>
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-400 flex-shrink-0" />
                    <p className="text-white text-xs sm:text-sm font-medium">Responda em segundos</p>
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-400 flex-shrink-0" />
                    <p className="text-white text-xs sm:text-sm font-medium">Automático 24 horas</p>
                  </div>
                </div>

                {/* Buttons - Responsivo */}
                <div className="space-y-2.5 sm:space-y-3">
                  <button
                    onClick={handleEnableNotifications}
                    disabled={isLoading}
                    className="w-full h-11 sm:h-12 rounded-xl font-bold text-sm sm:text-base bg-gradient-to-r from-gold via-gold-light to-gold text-black shadow-lg shadow-gold/30 hover:shadow-xl hover:shadow-gold/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 bg-black/60 rounded-full animate-pulse" />
                        <div className="w-1.5 h-1.5 bg-black/60 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-black/60 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <>
                        <Bell className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                        <span>Ativar Agora</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowPermissionRequest(false)}
                    className="w-full h-9 sm:h-10 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Agora não
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}