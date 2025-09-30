/**
 * Browser Push Notifications Service
 * Notificações push para o navegador quando chegar nova pergunta
 */

import { logger } from '@/lib/logger'

class BrowserNotificationService {
  
  /**
   * Solicita permissão para enviar notificações
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (!('Notification' in window)) {
        logger.warn('[BrowserNotification] Notifications not supported')
        return false
      }
      
      if (Notification.permission === 'granted') {
        return true
      }
      
      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission()
        return permission === 'granted'
      }
      
      return false
    } catch (error) {
      logger.error('[BrowserNotification] Error requesting permission', { error })
      return false
    }
  }
  
  /**
   * Verifica se tem permissão para notificar
   */
  hasPermission(): boolean {
    return 'Notification' in window && Notification.permission === 'granted'
  }
  
  /**
   * Envia notificação de nova pergunta
   */
  async sendQuestionNotification(data: {
    sequentialId: number
    questionText: string
    productTitle: string
    productImage?: string
    sellerName: string
    approvalUrl: string
  }): Promise<boolean> {
    try {
      if (!this.hasPermission()) {
        const granted = await this.requestPermission()
        if (!granted) return false
      }

      // Tocar som de notificação
      try {
        const audio = new Audio('/notification-new.mp3')
        audio.volume = 0.7
        audio.play().catch(() => {
          // Falha silenciosa se não conseguir tocar o som
        })
      } catch (_error) {
        // Ignora erro de áudio
      }

      // Truncar pergunta se for muito longa (máximo 120 caracteres)
      const truncatedQuestion = data.questionText.length > 120
        ? data.questionText.substring(0, 120) + '...'
        : data.questionText

      // Truncar título do produto se for muito longo (máximo 40 caracteres)
      const truncatedProduct = data.productTitle.length > 40
        ? data.productTitle.substring(0, 40) + '...'
        : data.productTitle

      // Notificação profissional: contexto completo para o vendedor
      const notification = new Notification(`🔔 Nova Pergunta - ${data.sellerName}`, {
        body: `Um cliente enviou uma pergunta sobre "${truncatedProduct}":\n\n${truncatedQuestion}`,
        icon: '/mlagent-logo-3d.svg', // Logo ML Agent 3D SVG (renderiza maior)
        badge: '/mlagent-logo-3d.svg',
        tag: `question-${data.sequentialId}`,
        requireInteraction: false, // Não manter aberta
        silent: false
      })

      // Ao clicar, focar na aba do ML Agent
      notification.onclick = () => {
        notification.close()
        // Focar a janela do ML Agent se já estiver aberta
        window.focus()
      }

      // Auto-fechar após 15 segundos
      setTimeout(() => notification.close(), 15000)
      
      logger.info('[BrowserNotification] Question notification sent', { 
        questionId: data.sequentialId 
      })
      
      return true
    } catch (error) {
      logger.error('[BrowserNotification] Error sending notification', { error })
      return false
    }
  }
  
  /**
   * Envia notificação de confirmação de resposta
   * NOTA: Desabilitado conforme requisito - apenas WhatsApp deve receber confirmação
   */
  async sendAnswerConfirmation(_data: {
    sequentialId: number
    productTitle: string
    sellerName: string
    approved: boolean
  }): Promise<boolean> {
    // Não enviar notificação de confirmação no browser
    // Apenas WhatsApp recebe confirmação
    return false
  }
  
  /**
   * Envia notificação de erro
   */
  async sendErrorNotification(data: {
    message: string
    questionId?: number
  }): Promise<boolean> {
    try {
      if (!this.hasPermission()) return false
      
      const notification = new Notification('⚠️ ML Agent - Erro', {
        body: data.message,
        icon: '/mlagent-logo-3d.svg',
        badge: '/mlagent-logo-3d.svg',
        tag: data.questionId ? `error-${data.questionId}` : 'error',
        requireInteraction: true
      })
      
      setTimeout(() => notification.close(), 10000)
      
      return true
    } catch (error) {
      logger.error('[BrowserNotification] Error sending error notification', { error })
      return false
    }
  }
  
  /**
   * Testa notificações
   */
  async testNotification(): Promise<boolean> {
    try {
      if (!this.hasPermission()) {
        const granted = await this.requestPermission()
        if (!granted) {
          alert('Por favor, permita notificações para receber alertas de novas perguntas!')
          return false
        }
      }
      
      const notification = new Notification('🔔 ML Agent - Teste', {
        body: 'Notificações ativadas! Você receberá alertas de novas perguntas.',
        icon: '/mlagent-logo-3d.svg',
        badge: '/mlagent-logo-3d.svg'
      })
      
      setTimeout(() => notification.close(), 3000)
      
      return true
    } catch (error) {
      logger.error('[BrowserNotification] Test failed', { error })
      return false
    }
  }
}

// Singleton para uso no browser
let browserNotificationService: BrowserNotificationService | null = null

export const getBrowserNotificationService = () => {
  if (typeof window === 'undefined') return null
  
  if (!browserNotificationService) {
    browserNotificationService = new BrowserNotificationService()
  }
  
  return browserNotificationService
}

// Export para uso direto
export const requestNotificationPermission = () => {
  const service = getBrowserNotificationService()
  return service?.requestPermission() || Promise.resolve(false)
}

export const sendBrowserQuestionNotification = (data: any) => {
  const service = getBrowserNotificationService()
  return service?.sendQuestionNotification(data) || Promise.resolve(false)
}

export const sendBrowserAnswerConfirmation = (data: any) => {
  const service = getBrowserNotificationService()
  return service?.sendAnswerConfirmation(data) || Promise.resolve(false)
}