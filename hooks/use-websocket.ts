/**
 * Hook para WebSocket real-time
 * Gerencia conexão, reconexão e eventos
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
    reconnectAttempts = 5,
    reconnectDelay = 2000
  } = options

  const socketRef = useRef<Socket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)

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
   * Connect to WebSocket server
   */
  const connect = useCallback(async () => {
    // Don't connect if already connected
    if (socketRef.current?.connected) {
      logger.info('[WebSocket] Already connected')
      return
    }

    setState(prev => ({ ...prev, connectionStatus: 'connecting' }))

    // Get auth token
    const token = await getSessionToken()
    if (!token) {
      logger.error('[WebSocket] No session token available')
      setState(prev => ({ ...prev, connectionStatus: 'error' }))
      return
    }

    // Create socket connection
    // Use the same origin with correct path for nginx proxy
    const wsUrl = typeof window !== 'undefined'
      ? window.location.origin  // This will use https://gugaleo.axnexlabs.com.br
      : 'http://localhost:3008'

    const socket = io(wsUrl, {
      path: '/socket.io/', // Important: Use the correct path for nginx proxy
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: false, // We handle reconnection manually
      timeout: 10000
    })

    // Connection handlers
    socket.on('connect', () => {
      logger.info('[WebSocket] Connected successfully')
      setState(prev => ({
        ...prev,
        isConnected: true,
        connectionStatus: 'connected'
      }))
      reconnectAttemptsRef.current = 0

      // Show success toast
      toast.success('Conectado em tempo real', {
        duration: 2000
      })
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
      logger.warn('[WebSocket] Disconnected:', { reason })
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectionStatus: 'disconnected'
      }))

      // Auto-reconnect if not manual disconnect
      if (reason !== 'io client disconnect' && reconnectAttemptsRef.current < reconnectAttempts) {
        reconnectAttemptsRef.current++
        logger.info(`[WebSocket] Reconnecting... (attempt ${reconnectAttemptsRef.current})`)

        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, reconnectDelay * reconnectAttemptsRef.current)
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

    socketRef.current = socket
  }, [getSessionToken, reconnectAttempts, reconnectDelay])

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

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
  }, [])

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
      connect()
    }

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, []) // Only run once on mount

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