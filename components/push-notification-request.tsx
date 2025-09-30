/**
 * Push Notification Permission Request Component
 * Solicita permissão para notificações push com UX otimizada para iOS
 */

'use client'

import { useState, useEffect } from 'react'
import { X, Bell, BellRing, CheckCircle } from 'lucide-react'
import {
  subscribeToPushNotifications,
  isPushSubscribed,
  initializePushNotifications
} from '@/lib/services/push-notifications'
// import { toast } from 'sonner' // Removido - apenas notificações do dispositivo

export function PushNotificationRequest() {
  const [isVisible, setIsVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [hasDeclined, setHasDeclined] = useState(false)
  const [isWaitingForPermission, setIsWaitingForPermission] = useState(false)

  useEffect(() => {
    checkNotificationStatus()
  }, [])

  // Verificar periodicamente se a permissão foi concedida no iOS
  useEffect(() => {
    if (!isWaitingForPermission) return

    const checkInterval = setInterval(async () => {
      try {
        // Verificar se a permissão foi concedida
        if ('Notification' in window && Notification.permission === 'granted') {
          console.log('[Push] Permission granted detected')

          // Tentar se inscrever automaticamente
          const success = await subscribeToPushNotifications()

          if (success) {
            console.log('[Push] Successfully subscribed to push notifications')
            setIsSubscribed(true)
            setIsVisible(false)
            setIsWaitingForPermission(false)
            setIsLoading(false)

            // Limpar flag de declined
            localStorage.removeItem('push_declined')

            // Parar de verificar
            clearInterval(checkInterval)
          } else {
            // Verificar se já está inscrito de outra forma
            const subscribed = await isPushSubscribed()

            if (subscribed) {
              console.log('[Push] Already subscribed to push notifications')
              setIsSubscribed(true)
              setIsVisible(false)
              setIsWaitingForPermission(false)
              setIsLoading(false)

              // Limpar flag de declined
              localStorage.removeItem('push_declined')

              // Parar de verificar
              clearInterval(checkInterval)
            }
          }
        }
      } catch (error) {
        console.error('[Push] Error checking permission status:', error)
      }
    }, 1000) // Verificar a cada 1 segundo

    // Timeout após 60 segundos no iOS
    const timeout = setTimeout(() => {
      setIsWaitingForPermission(false)
      setIsLoading(false)
      clearInterval(checkInterval)
    }, 60000)

    return () => {
      clearInterval(checkInterval)
      clearTimeout(timeout)
    }
  }, [isWaitingForPermission])

  const checkNotificationStatus = async () => {
    try {
      // Verificar se já recusou anteriormente
      const declined = localStorage.getItem('push_declined')
      if (declined === 'true') {
        setHasDeclined(true)
        return
      }

      // Verificar se já tem permissão concedida
      if ('Notification' in window && Notification.permission === 'granted') {
        console.log('[Push] Permission already granted')

        // Inicializar serviço
        await initializePushNotifications()

        // Verificar se já está inscrito
        const subscribed = await isPushSubscribed()

        if (subscribed) {
          setIsSubscribed(true)
          console.log('[Push] Already subscribed to push notifications')
          return // Não mostrar o prompt
        } else {
          // Tem permissão mas não está inscrito, tentar inscrever automaticamente
          try {
            const success = await subscribeToPushNotifications()
            if (success) {
              setIsSubscribed(true)
              console.log('[Push] Auto-subscribed to push notifications')
              return // Não mostrar o prompt
            }
          } catch (error) {
            console.error('[Push] Auto-subscribe failed:', error)
          }
        }
      }

      // Inicializar serviço
      await initializePushNotifications()

      // Verificar se já está inscrito
      const subscribed = await isPushSubscribed()
      setIsSubscribed(subscribed)

      // Mostrar prompt se não está inscrito e tem suporte
      if (!subscribed && 'Notification' in window && 'PushManager' in window) {
        // No iOS, verificar se está na PWA antes de mostrar
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                                   (window.navigator as any).standalone === true

        if (isIOS && !isInStandaloneMode) {
          console.log('[Push] iOS detected but not in standalone mode, skipping prompt')
          return
        }

        // Aguardar 3 segundos antes de mostrar (melhor UX)
        setTimeout(() => {
          setIsVisible(true)
        }, 3000)
      }

    } catch (error) {
      console.error('Error checking notification status:', error)
    }
  }

  const handleEnable = async () => {
    setIsLoading(true)
    setIsWaitingForPermission(true) // Ativar monitoramento

    try {
      const success = await subscribeToPushNotifications()

      if (success) {
        setIsSubscribed(true)
        setIsVisible(false)
        setIsWaitingForPermission(false)

        // Removido toast - apenas notificações do dispositivo
        console.log('[Push] Notifications enabled successfully')
      } else {
        // No iOS, pode estar esperando o usuário responder ao prompt
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          console.log('[Push] Waiting for iOS permission prompt...')
          // O intervalo continuará verificando
        } else {
          setIsWaitingForPermission(false)
          setIsLoading(false)
          console.error('[Push] Failed to enable notifications')
        }
      }

    } catch (error) {
      console.error('Error enabling notifications:', error)
      // No iOS, pode estar esperando o usuário responder ao prompt
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        console.log('[Push] iOS: Waiting for permission...')
      } else {
        setIsWaitingForPermission(false)
        setIsLoading(false)
      }
    }
  }

  const handleDecline = () => {
    setHasDeclined(true)
    setIsVisible(false)
    localStorage.setItem('push_declined', 'true')
  }

  const handleRemindLater = () => {
    setIsVisible(false)
    // Mostrar novamente na próxima sessão
    sessionStorage.setItem('push_remind_later', 'true')
  }

  // Verificar se deve mostrar botão flutuante
  const showFloatingButton = !isSubscribed && hasDeclined && !isVisible

  if (!isVisible && !showFloatingButton) return null

  // Botão flutuante para reativar
  if (showFloatingButton) {
    return (
      <button
        onClick={() => {
          setHasDeclined(false)
          setIsVisible(true)
          localStorage.removeItem('push_declined')
        }}
        className="fixed bottom-6 right-6 bg-yellow-500 hover:bg-yellow-600 text-black rounded-full p-4 shadow-lg transition-all hover:scale-110 z-40"
        aria-label="Ativar notificações"
      >
        <Bell className="w-6 h-6" />
      </button>
    )
  }

  // Modal de permissão
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="p-6">
          {/* Header com ícone */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-3">
                <BellRing className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Ativar Notificações
              </h3>
            </div>
            <button
              onClick={handleDecline}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="space-y-4 mb-6">
            <p className="text-gray-600 dark:text-gray-400">
              Receba alertas instantâneos quando novas perguntas chegarem no Mercado Livre.
            </p>

            {/* Benefícios */}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Notificações em tempo real 24/7
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Responda perguntas mais rapidamente
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Funciona em segundo plano no iOS e Android
                </span>
              </div>
            </div>

            {/* Nota iOS */}
            {/iPhone|iPad|iPod/i.test(navigator.userAgent) && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  💡 Após clicar em &quot;Ativar&quot;, permita as notificações no popup do iOS.
                  {isWaitingForPermission && ' Aguardando sua permissão...'}
                </p>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleEnable}
              disabled={isLoading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  {isWaitingForPermission ? 'Aguardando permissão...' : 'Ativando...'}
                </>
              ) : (
                <>
                  <Bell className="w-5 h-5" />
                  Ativar Notificações
                </>
              )}
            </button>

            {!isWaitingForPermission && (
              <button
                onClick={handleRemindLater}
                className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium py-2 transition-colors"
              >
                Lembrar mais tarde
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}