/**
 * PWA Initializer Component
 * Registra service worker e solicita permissão para notificações
 */

'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
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
      // Verificar suporte a notificações
      if (!('Notification' in window)) {
        // Removido toast - apenas notificações do dispositivo
        console.error('[PWA] Browser does not support notifications')
        setShowPermissionRequest(false)
        return
      }

      // Log para debug
      console.log('[PWA] Requesting notification permission...')
      console.log('[PWA] Current permission:', Notification.permission)

      // Solicitar permissão
      const permission = await Notification.requestPermission()
      console.log('[PWA] Permission result:', permission)

      if (permission === 'granted') {
        // Obter registration do service worker
        console.log('[PWA] Getting service worker registration...')
        const registration = await navigator.serviceWorker.ready
        console.log('[PWA] Service worker ready:', registration)

        await subscribeToNotifications(registration)

        // Removido toast - apenas notificações do dispositivo
        // toast.success('Notificações ativadas! 🎉', {
        //   description: 'Você receberá alertas quando novas perguntas chegarem.',
        //   duration: 5000
        // })

        setShowPermissionRequest(false)
      } else if (permission === 'denied') {
        // Removido toast - apenas notificações do dispositivo
        console.log('[PWA] Notification permission denied')
        setShowPermissionRequest(false)
      }
    } catch (error: any) {
      console.error('[PWA] Error enabling notifications:', error)
      console.error('[PWA] Error stack:', error.stack)

      // Mensagem de erro mais específica
      const errorMessage = 'Erro ao ativar notificações'
      let errorDescription = 'Verifique as permissões do navegador e tente novamente.'

      if (error.message?.includes('Registration failed')) {
        errorDescription = 'Service Worker não está registrado. Recarregue a página.'
      } else if (error.message?.includes('subscription')) {
        errorDescription = 'Erro ao criar inscrição. Tente novamente.'
      } else if (error.message) {
        errorDescription = error.message
      }

      // Removido toast - apenas notificações do dispositivo
      console.error('[PWA] Error:', errorMessage, errorDescription)
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

      {/* Push Notification Request - cuida das notificações */}
      {showPermissionRequest && (
        <div className="fixed bottom-24 right-4 max-w-sm bg-black/90 backdrop-blur-lg border border-yellow-500/30 rounded-lg p-4 shadow-2xl z-50 animate-in slide-in-from-right">
          <div className="flex items-start gap-3">
            <div className="bg-yellow-500/20 rounded-full p-2 flex-shrink-0">
              <Bell className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white text-sm mb-1">
                Ativar Notificações
              </h4>
              <p className="text-xs text-gray-400 mb-3">
                Receba alertas instantâneos quando novas perguntas chegarem no Mercado Livre.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleEnableNotifications}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black text-xs font-medium rounded-md transition-colors"
                >
                  {isLoading ? 'Ativando...' : 'Ativar'}
                </button>
                <button
                  onClick={() => setShowPermissionRequest(false)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white text-xs font-medium transition-colors"
                >
                  Agora não
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}