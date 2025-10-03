/**
 * Hook para WebSocket real-time - iOS PWA Optimized
 * Gerencia conexão, reconexão robusta e eventos
 *
 * Features para iOS PWA:
 * - Reconexão automática ao voltar do background
 * - Heartbeat para manter conexão viva
 * - Exponential backoff para reconexão
 * - Detecção de visibilitychange
 * - Timeouts otimizados para mobile
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import io, { Socket } from 'socket.io-client'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'

interface WebSocketState {
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastPing: Date | null
  organizationId: string | null
  mlAccounts: string[]
  currentAccountId: string | null
}

interface UseWebSocketOptions {
  autoConnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    reconnectAttempts = Infinity, // ♾️ iOS PWA: Nunca desistir de reconectar
    reconnectDelay = 1000 // Começar com 1s
  } = options

  const socketRef = useRef<Socket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isManualDisconnectRef = useRef(false)
  const wasConnectedRef = useRef(false)

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    connectionStatus: 'disconnected',
    lastPing: null,
    organizationId: null,
    mlAccounts: [],
    currentAccountId: null
  })

  const [pendingQuestionsCount, setPendingQuestionsCount] = useState(0)

  /**
   * 🎯 iOS PWA: Start heartbeat para manter conexão viva
   */
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    // Enviar ping a cada 25 segundos para manter conexão viva
    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('ping')
        logger.debug('[WebSocket] Heartbeat ping sent')
      }
    }, 25000)

    logger.info('[WebSocket] Heartbeat started (25s interval)')
  }, [])

  /**
   * 🎯 iOS PWA: Stop heartbeat
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
      logger.info('[WebSocket] Heartbeat stopped')
    }
  }, [])

  /**
   * Get session token for authentication
   */
  const getSessionToken = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session/token', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        return data.token
      }
    } catch (error) {
      logger.error('[WebSocket] Failed to get session token:', { error })
    }
    return null
  }, [])

  /**
   * Connect to WebSocket server - iOS PWA Optimized
   */
  const connect = useCallback(async () => {
    // Don't connect if already connected OR manual disconnect
    if (socketRef.current?.connected) {
      logger.info('[WebSocket] Already connected')
      return
    }

    if (isManualDisconnectRef.current) {
      logger.info('[WebSocket] Manual disconnect active, skipping connect')
      return
    }

    setState(prev => ({ ...prev, connectionStatus: 'connecting' }))
    logger.info(`[WebSocket] Connecting... (attempt ${reconnectAttemptsRef.current + 1})`)

    // Get auth token
    const token = await getSessionToken()
    if (!token) {
      logger.error('[WebSocket] No session token available')
      setState(prev => ({ ...prev, connectionStatus: 'error' }))

      // 🎯 iOS PWA: Retry even on token failure (pode ser temporário)
      if (!isManualDisconnectRef.current) {
        const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttemptsRef.current), 30000)
        logger.info(`[WebSocket] Will retry in ${delay}ms (no token)`)

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++
          connect()
        }, delay)
      }
      return
    }

    // Create socket connection
    // Use the same origin with correct path for nginx proxy
    const wsUrl = typeof window !== 'undefined'
      ? window.location.origin  // This will use https://gugaleo.axnexlabs.com.br
      : 'http://localhost:3008'

    const socket = io(wsUrl, {
      path: '/socket.io/',
      auth: { token },
      // 🎯 iOS PWA: Polling primeiro, depois upgrade para WebSocket (mais confiável em mobile)
      transports: ['polling', 'websocket'],
      reconnection: false, // We handle reconnection manually
      timeout: 20000, // 🎯 iOS PWA: Timeout maior para mobile
      upgrade: true, // Permitir upgrade de polling para websocket
      rememberUpgrade: true, // Lembrar upgrade para próxima conexão
      forceNew: false // Reusar conexão quando possível
    })

    // Connection handlers
    socket.on('connect', () => {
      logger.info('[WebSocket] ✅ Connected successfully')
      setState(prev => ({
        ...prev,
        isConnected: true,
        connectionStatus: 'connected'
      }))
      reconnectAttemptsRef.current = 0 // Reset counter on success
      wasConnectedRef.current = true

      // 🎯 iOS PWA: Iniciar heartbeat assim que conectar
      startHeartbeat()

      // Removido o toast de conexão conforme solicitado
      // Conexão silenciosa sem notificação visual

      // 🎯 iOS PWA: Show subtle toast ONLY after reconnection (not first connect)
      if (wasConnectedRef.current && reconnectAttemptsRef.current > 0) {
        toast.success('Reconectado ao servidor', {
          duration: 2000
        })
      }
    })

    socket.on('connected', (data) => {
      logger.info('[WebSocket] Received connection confirmation', data)
      setState(prev => ({
        ...prev,
        organizationId: data.organizationId,
        mlAccounts: data.mlAccounts || [],
        currentAccountId: data.currentAccountId
      }))
    })

    socket.on('disconnect', (reason) => {
      logger.warn('[WebSocket] ⚠️  Disconnected:', { reason })
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectionStatus: 'disconnected'
      }))

      // 🎯 iOS PWA: Stop heartbeat
      stopHeartbeat()

      // 🎯 iOS PWA: Auto-reconnect if not manual disconnect
      // Usar exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
      if (reason !== 'io client disconnect' && !isManualDisconnectRef.current) {
        const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttemptsRef.current), 30000)

        logger.info(`[WebSocket] 🔄 Will reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`)

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++
          connect()
        }, delay)
      } else if (isManualDisconnectRef.current) {
        logger.info('[WebSocket] Manual disconnect, will not reconnect')
      }
    })

    socket.on('error', (error) => {
      logger.error('[WebSocket] Connection error:', error)
      setState(prev => ({ ...prev, connectionStatus: 'error' }))

      toast.error('Erro na conexão em tempo real', {
        duration: 3000
      })
    })

    // Question events
    socket.on('question:new', (data) => {
      logger.info('[WebSocket] New question received', data)
      setPendingQuestionsCount(prev => prev + 1)

      // Show notification
      const question = data.question
      toast.info(`Nova pergunta de ${question.mlAccount?.nickname || 'Cliente'}`, {
        description: question.text?.substring(0, 100),
        duration: 5000
      })

      // Emit custom event for components to listen
      window.dispatchEvent(new CustomEvent('websocket:question:new', { detail: data }))
    })

    // Error event for questions
    socket.on('question:error', (data) => {
      logger.error('[WebSocket] Question error received', data)

      // Determine error message based on context
      let errorMessage = 'Erro ao processar pergunta'
      if (data.errorType === 'N8N_ERROR') {
        errorMessage = 'Erro no processamento da IA'
      } else if (data.errorType === 'ML_API_ERROR') {
        errorMessage = 'Erro na API do Mercado Livre'
      } else if (data.failureReason) {
        errorMessage = data.failureReason
      }

      // Show error notification
      toast.error(errorMessage, {
        description: `Pergunta ID: ${data.questionId}`,
        duration: 7000
      })

      // Emit custom event for components to listen
      window.dispatchEvent(new CustomEvent('websocket:question:error', { detail: data }))
    })

    // Revision error event for questions
    socket.on('question:revision-error', (data) => {
      logger.error('[WebSocket] Revision error received', data)

      // Show specific revision error notification
      const errorMessage = data.failureReason || 'Erro ao revisar resposta com IA'

      toast.error('🤖 Erro na Revisão', {
        description: errorMessage,
        duration: 10000
      })

      // Emit custom event for components to listen
      window.dispatchEvent(new CustomEvent('websocket:question:revision-error', { detail: data }))
    })

    // Answer edited event for real-time updates
    socket.on('question:answer-edited', (data) => {
      logger.info('[WebSocket] Answer edited received', data)

      // Emit custom event for components to listen
      window.dispatchEvent(new CustomEvent('websocket:question:answer-edited', { detail: data }))
    })

    socket.on('question:updated', (data) => {
      logger.info('[WebSocket] Question updated', data)

      // Update count based on status
      if (data.status === 'COMPLETED') {
        setPendingQuestionsCount(prev => Math.max(0, prev - 1))
      }

      // Emit custom event
      window.dispatchEvent(new CustomEvent('websocket:question:updated', { detail: data }))
    })

    socket.on('questions:initial', (data) => {
      logger.info('[WebSocket] Initial questions data', data)
      setPendingQuestionsCount(data.pendingCount || 0)

      // Emit custom event
      window.dispatchEvent(new CustomEvent('websocket:questions:initial', { detail: data }))
    })

    // Account events
    socket.on('account-switched', (data) => {
      logger.info('[WebSocket] Account switched', data)
      setState(prev => ({ ...prev, currentAccountId: data.accountId }))

      window.dispatchEvent(new CustomEvent('websocket:account:switched', { detail: data }))
    })

    // Server events
    socket.on('server-shutdown', (data) => {
      logger.warn('[WebSocket] Server shutting down', data)
      toast.warning('Servidor reiniciando, reconectando...', {
        duration: 5000
      })
    })

    // Ping/pong for health check
    socket.on('ping', () => {
      setState(prev => ({ ...prev, lastPing: new Date() }))
      socket.emit('pong')
    })

    // 🎯 JWT Auto-Refresh: Receber novo token antes de expirar (UX perfeita)
    socket.on('token:refresh', (data) => {
      logger.info('[WebSocket] 🔑 JWT token auto-refreshed by server')

      // Atualizar token na socket atual (com type assertion seguro)
      if (socket.auth && typeof socket.auth === 'object' && 'token' in socket.auth) {
        (socket.auth as { token: string }).token = data.token
      }

      // Salvar novo token no sessionStorage para próximas conexões (opcional)
      try {
        sessionStorage.setItem('ws_token_refreshed_at', new Date().toISOString())
        logger.debug('[WebSocket] Token refresh timestamp saved')
      } catch (error) {
        // Silently fail if storage not available
      }

      logger.info(`[WebSocket] 🔄 New token valid for ${Math.round(data.expiresIn / (1000 * 60 * 60 * 24))} days`)
    })

    socketRef.current = socket
  }, [getSessionToken, reconnectAttempts, reconnectDelay])

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true // 🎯 iOS PWA: Mark as manual disconnect

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // 🎯 iOS PWA: Stop heartbeat
    stopHeartbeat()

    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    setState({
      isConnected: false,
      connectionStatus: 'disconnected',
      lastPing: null,
      organizationId: null,
      mlAccounts: [],
      currentAccountId: null
    })

    logger.info('[WebSocket] Disconnected manually')
  }, [stopHeartbeat])

  /**
   * Emit event to server
   */
  const emit = useCallback((event: string, data?: any) => {
    if (!socketRef.current?.connected) {
      logger.warn('[WebSocket] Cannot emit, not connected')
      return false
    }

    socketRef.current.emit(event, data)
    return true
  }, [])

  /**
   * Subscribe to event
   */
  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!socketRef.current) {
      logger.warn('[WebSocket] Cannot subscribe, no socket instance')
      return () => {}
    }

    socketRef.current.on(event, handler)

    // Return unsubscribe function
    return () => {
      socketRef.current?.off(event, handler)
    }
  }, [])

  /**
   * Switch ML account
   */
  const switchAccount = useCallback((accountId: string) => {
    if (!emit('switch-account', accountId)) {
      logger.error('[WebSocket] Failed to switch account')
      return false
    }
    return true
  }, [emit])

  /**
   * Question actions
   */
  const approveQuestion = useCallback((questionId: string, answer: string) => {
    return emit('question:approve', { questionId, answer })
  }, [emit])

  const reviseQuestion = useCallback((questionId: string, feedback: string) => {
    return emit('question:revise', { questionId, feedback })
  }, [emit])

  const editQuestion = useCallback((questionId: string, answer: string) => {
    return emit('question:edit', { questionId, answer })
  }, [emit])

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      isManualDisconnectRef.current = false
      connect()
    }

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  // 🎯 iOS PWA: CRÍTICO - Detectar quando app volta do background e reconectar
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.info('[WebSocket] 📱 App became visible (foreground)')

        // Se estava conectado antes MAS não está mais, reconectar
        if (wasConnectedRef.current && !socketRef.current?.connected && !isManualDisconnectRef.current) {
          logger.info('[WebSocket] 🔄 Reconnecting after returning to foreground...')

          // Reset attempt counter para reconectar rápido
          reconnectAttemptsRef.current = 0

          // Limpar qualquer timeout existente
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
          }

          // Reconectar imediatamente
          setTimeout(() => {
            connect()
          }, 500) // 500ms delay para garantir que app está pronto
        } else if (socketRef.current?.connected) {
          logger.info('[WebSocket] ✅ Still connected after returning to foreground')

          // Se estava conectado, reiniciar heartbeat por segurança
          stopHeartbeat()
          startHeartbeat()
        }
      } else {
        logger.info('[WebSocket] 📱 App went to background')
        // iOS pode desconectar WebSocket quando vai para background
        // Vamos deixar o heartbeat e os handlers de disconnect cuidarem disso
      }
    }

    const handleOnline = () => {
      logger.info('[WebSocket] 📡 Network online')
      // Se perdeu conexão de rede e voltou, reconectar
      if (!socketRef.current?.connected && !isManualDisconnectRef.current) {
        logger.info('[WebSocket] 🔄 Reconnecting after network came back...')
        reconnectAttemptsRef.current = 0
        setTimeout(() => connect(), 1000)
      }
    }

    const handleOffline = () => {
      logger.warn('[WebSocket] 📡 Network offline')
      // Quando rede cai, garantir que desconectamos limpo
      if (socketRef.current?.connected) {
        socketRef.current.disconnect()
      }
      stopHeartbeat()
    }

    // 🎯 iOS PWA: Escutar mudanças de visibilidade (CRÍTICO para PWA)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 🎯 iOS PWA: Escutar mudanças de rede
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [connect, startHeartbeat, stopHeartbeat])

  // Return hook interface
  return {
    // State
    isConnected: state.isConnected,
    connectionStatus: state.connectionStatus,
    organizationId: state.organizationId,
    mlAccounts: state.mlAccounts,
    currentAccountId: state.currentAccountId,
    pendingQuestionsCount,

    // Methods
    connect,
    disconnect,
    emit,
    on,
    switchAccount,

    // Question actions
    approveQuestion,
    reviseQuestion,
    editQuestion,

    // Socket instance (for advanced usage)
    socket: socketRef.current
  }
}

// Export connection status type
export type ConnectionStatus = WebSocketState['connectionStatus']