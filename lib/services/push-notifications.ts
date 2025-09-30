/**
 * Push Notifications Service para PWA
 * Gerencia inscrições e notificações push 24/7
 */

'use client'

import { logger } from '@/lib/logger'

// VAPID Public Key (mesma do backend)
const VAPID_PUBLIC_KEY = process.env['NEXT_PUBLIC_VAPID_PUBLIC_KEY'] || 'BKd0Fz7Yx0bgNdKCLqxqBkFDX3H3LbJhMwXN6kCVPGqPqFzKlFxNhA5qzYPxNgdFzYfGxQjPmFxQKFxNhA5qzYP'

export interface PushPreferences {
  enableQuestions: boolean
  enableUrgent: boolean
  enableBatch: boolean
  quietHoursStart?: number
  quietHoursEnd?: number
  timezone?: string
}

class PushNotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null
  private subscription: PushSubscription | null = null

  /**
   * Inicializa o serviço e registra Service Worker
   */
  async initialize(): Promise<boolean> {
    try {
      // Verificar suporte
      if (!('serviceWorker' in navigator)) {
        logger.warn('[Push Service] Service Workers not supported')
        return false
      }

      if (!('PushManager' in window)) {
        logger.warn('[Push Service] Push notifications not supported')
        return false
      }

      // Registrar Service Worker
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })

      logger.info('[Push Service] Service Worker registered')

      // Aguardar ativação
      await navigator.serviceWorker.ready

      // Verificar subscription existente
      this.subscription = await this.swRegistration.pushManager.getSubscription()

      if (this.subscription) {
        logger.info('[Push Service] Existing subscription found')
        // Sincronizar com backend
        await this.syncSubscription()
      }

      return true

    } catch (error) {
      logger.error('[Push Service] Initialization failed:', { error })
      return false
    }
  }

  /**
   * Verifica se tem permissão para notificações
   */
  hasPermission(): boolean {
    if (!('Notification' in window)) return false
    return Notification.permission === 'granted'
  }

  /**
   * Solicita permissão e inscreve para push
   */
  async subscribe(
    deviceName?: string,
    preferences?: PushPreferences
  ): Promise<boolean> {
    try {
      // Verificar se já está inscrito
      if (this.subscription) {
        logger.info('[Push Service] Already subscribed')
        return true
      }

      // Solicitar permissão
      if (!this.hasPermission()) {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          logger.warn('[Push Service] Permission denied or pending')
          // No iOS, pode estar ainda esperando resposta
          if (permission === 'default' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            logger.info('[Push Service] iOS: Waiting for user response...')
          }
          return false
        }
      }

      // Garantir que Service Worker está pronto
      if (!this.swRegistration) {
        await this.initialize()
      }

      if (!this.swRegistration) {
        throw new Error('Service Worker not registered')
      }

      // Pequeno delay no iOS para garantir que tudo está pronto
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Criar subscription
      this.subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })

      logger.info('[Push Service] Push subscription created')

      // Enviar para backend
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: this.subscription.toJSON(),
          deviceInfo: {
            name: deviceName || this.getDefaultDeviceName()
          },
          preferences: preferences || this.getDefaultPreferences()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to sync subscription with server')
      }

      const data = await response.json()
      logger.info('[Push Service] Subscription synced with server', {
        subscriptionId: data.subscriptionId
      })

      // Mostrar notificação de sucesso
      await this.showTestNotification()

      return true

    } catch (error) {
      logger.error('[Push Service] Subscribe failed:', { error })
      return false
    }
  }

  /**
   * Remove inscrição
   */
  async unsubscribe(): Promise<boolean> {
    try {
      if (!this.subscription) {
        logger.warn('[Push Service] No subscription to unsubscribe')
        return true
      }

      // Cancelar subscription no browser
      await this.subscription.unsubscribe()

      // Notificar backend
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint
        })
      })

      this.subscription = null
      logger.info('[Push Service] Unsubscribed successfully')

      return true

    } catch (error) {
      logger.error('[Push Service] Unsubscribe failed:', { error })
      return false
    }
  }

  /**
   * Verifica se está inscrito
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.swRegistration) {
      await this.initialize()
    }

    if (!this.swRegistration) return false

    this.subscription = await this.swRegistration.pushManager.getSubscription()
    return !!this.subscription
  }

  /**
   * Atualiza preferências
   */
  async updatePreferences(preferences: PushPreferences): Promise<boolean> {
    try {
      if (!this.subscription) {
        logger.warn('[Push Service] No subscription to update')
        return false
      }

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: this.subscription.toJSON(),
          preferences
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update preferences')
      }

      logger.info('[Push Service] Preferences updated')
      return true

    } catch (error) {
      logger.error('[Push Service] Update preferences failed:', { error })
      return false
    }
  }

  /**
   * Sincroniza subscription com backend
   */
  private async syncSubscription(): Promise<void> {
    if (!this.subscription) return

    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: this.subscription.toJSON(),
          resubscribe: true
        })
      })
    } catch (error) {
      logger.error('[Push Service] Sync failed:', { error })
    }
  }

  /**
   * Mostra notificação de teste
   */
  private async showTestNotification(): Promise<void> {
    try {
      // No iOS, usar o service worker para mostrar notificação
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && this.swRegistration) {
        await this.swRegistration.showNotification('🎉 ML Agent Pro', {
          body: 'Notificações push ativadas! Você receberá alertas 24/7 quando chegar novas perguntas.',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: 'test-notification',
          requireInteraction: false
        })
      } else {
        // Desktop/Android - usar API normal
        const notification = new Notification('🎉 ML Agent Pro', {
          body: 'Notificações push ativadas! Você receberá alertas 24/7 quando chegar novas perguntas.',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: 'test-notification',
          requireInteraction: false
        })

        setTimeout(() => notification.close(), 5000)
      }

    } catch (error) {
      logger.error('[Push Service] Test notification failed:', { error })
    }
  }

  /**
   * Obtém nome padrão do dispositivo
   */
  private getDefaultDeviceName(): string {
    const userAgent = navigator.userAgent
    const platform = navigator.platform

    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      if (/iPad/i.test(userAgent)) return 'iPad'
      return 'iPhone'
    }
    if (/Android/i.test(userAgent)) return 'Android'
    if (/Mac/i.test(platform)) return 'Mac'
    if (/Win/i.test(platform)) return 'Windows'
    if (/Linux/i.test(platform)) return 'Linux'

    return 'Web Browser'
  }

  /**
   * Obtém preferências padrão
   */
  private getDefaultPreferences(): PushPreferences {
    return {
      enableQuestions: true,
      enableUrgent: true,
      enableBatch: true,
      quietHoursStart: 22, // 22:00
      quietHoursEnd: 8,    // 08:00
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
    }
  }

  /**
   * Converte VAPID key para BufferSource
   */
  private urlBase64ToUint8Array(base64String: string): BufferSource {
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
}

// Singleton
let pushService: PushNotificationService | null = null

export const getPushNotificationService = (): PushNotificationService => {
  if (!pushService) {
    pushService = new PushNotificationService()
  }
  return pushService
}

// Exports convenientes
export const initializePushNotifications = () =>
  getPushNotificationService().initialize()

export const subscribeToPushNotifications = (deviceName?: string, preferences?: PushPreferences) =>
  getPushNotificationService().subscribe(deviceName, preferences)

export const unsubscribeFromPushNotifications = () =>
  getPushNotificationService().unsubscribe()

export const isPushSubscribed = () =>
  getPushNotificationService().isSubscribed()

export const updatePushPreferences = (preferences: PushPreferences) =>
  getPushNotificationService().updatePreferences(preferences)