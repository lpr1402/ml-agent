'use client'

import { useEffect, useState, useCallback } from 'react'
import { 
  getBrowserNotificationService,
  requestNotificationPermission,
  sendBrowserQuestionNotification,
  sendBrowserAnswerConfirmation 
} from '@/lib/services/browser-notifications'

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)
  
  useEffect(() => {
    // Verificar suporte
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)
    }
  }, [])
  
  const requestPermission = useCallback(async () => {
    if (!isSupported) return false
    
    const granted = await requestNotificationPermission()
    setPermission(granted ? 'granted' : 'denied')
    return granted
  }, [isSupported])
  
  const sendQuestionNotification = useCallback(async (data: {
    sequentialId: number
    questionText: string
    productTitle: string
    productImage?: string
    sellerName: string
    approvalUrl: string
  }) => {
    if (permission !== 'granted') {
      const granted = await requestPermission()
      if (!granted) return false
    }
    
    return sendBrowserQuestionNotification(data)
  }, [permission, requestPermission])
  
  const sendAnswerConfirmation = useCallback(async (data: {
    sequentialId: number
    productTitle: string
    sellerName: string
    approved: boolean
  }) => {
    if (permission !== 'granted') return false
    
    return sendBrowserAnswerConfirmation(data)
  }, [permission])
  
  const testNotification = useCallback(async () => {
    if (!isSupported) {
      alert('Seu navegador não suporta notificações!')
      return false
    }
    
    const service = getBrowserNotificationService()
    return service?.testNotification() || false
  }, [isSupported])
  
  return {
    permission,
    isSupported,
    hasPermission: permission === 'granted',
    requestPermission,
    sendQuestionNotification,
    sendAnswerConfirmation,
    testNotification
  }
}