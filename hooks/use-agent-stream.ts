/**
 * Hook React para consumir streaming do agente via WebSocket
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { logger } from '@/lib/logger'

interface AgentStreamState {
  // Streaming state
  isStreaming: boolean
  currentToken: string
  fullResponse: string
  sequenceNumber: number

  // Progress
  confidence: number

  // Status
  isDone: boolean
  error: string | null

  // Metadata
  tokensGenerated: number
  processingTime: number
}

interface UseAgentStreamReturn extends AgentStreamState {
  // Actions
  startStream: (questionId: string) => void
  resetStream: () => void
}

/**
 * Hook para consumir streaming do agente em tempo real
 */
export function useAgentStream(
  organizationId: string,
  socket: any // Socket.IO instance do useWebSocket
): UseAgentStreamReturn {
  // 🔴 FIX CRÍTICO: Validar organizationId obrigatório
  if (!organizationId || organizationId === '') {
    console.error('[useAgentStream] ❌ Missing organizationId, cannot listen to events!')
    logger.error('[useAgentStream] Missing organizationId', {
      hasSocket: !!socket,
      socketConnected: socket?.connected
    })
  }

  const [state, setState] = useState<AgentStreamState>({
    isStreaming: false,
    currentToken: '',
    fullResponse: '',
    sequenceNumber: 0,
    confidence: 0,
    isDone: false,
    error: null,
    tokensGenerated: 0,
    processingTime: 0,
  })

  const startTimeRef = useRef<number>(0)
  const questionIdRef = useRef<string>('')
  const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ⏱️ Timeout máximo para streaming (60 segundos)
  const STREAM_TIMEOUT_MS = 60000

  /**
   * ⏱️ Reseta timeout do streaming (chamado a cada token/evento)
   */
  const resetStreamTimeout = useCallback(() => {
    // Limpar timeout anterior
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current)
    }

    // Criar novo timeout
    streamTimeoutRef.current = setTimeout(() => {
      logger.error('[useAgentStream] Stream timeout - no tokens received for 60s')

      setState((prev) => {
        // Só aplicar timeout se ainda estiver em streaming
        if (!prev.isStreaming) return prev

        return {
          ...prev,
          error: 'Timeout: O servidor não respondeu a tempo. Tente novamente.',
          isDone: true,
          isStreaming: false,
        }
      })

      questionIdRef.current = ''
    }, STREAM_TIMEOUT_MS)
  }, [])

  /**
   * ⏱️ Limpa timeout do streaming
   */
  const clearStreamTimeout = useCallback(() => {
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current)
      streamTimeoutRef.current = null
    }
  }, [])

  /**
   * Handler para tokens do agente
   */
  const handleAgentToken = useCallback(
    (data: any) => {
      // 🔴 FIX CRÍTICO: Aceitar questionId flexível (pode vir como mlQuestionId ou id do banco)
      // Ignorar apenas se não for esta pergunta de forma alguma
      const isForThisQuestion =
        data.questionId === questionIdRef.current ||
        questionIdRef.current.includes(data.questionId) ||
        data.questionId.includes(questionIdRef.current)

      if (!isForThisQuestion) {
        // Silenciosamente ignorar tokens de outras perguntas
        return
      }

      if (data.organizationId !== organizationId) {
        return // Silenciosamente ignorar org diferente
      }

      // ⏱️ PRODUCTION FIX: Resetar timeout a cada token recebido
      resetStreamTimeout()

      // 🔇 PRODUCTION: Usar logger ao invés de console.log
      logger.debug('[useAgentStream] Token recebido', {
        sequence: data.sequenceNumber,
        tokenLength: data.token?.length || 0,
      })

      setState((prev) => ({
        ...prev,
        currentToken: data.token,
        fullResponse: prev.fullResponse + data.token,
        sequenceNumber: data.sequenceNumber,
        tokensGenerated: prev.tokensGenerated + 1,
        processingTime: Date.now() - startTimeRef.current,
      }))
    },
    [organizationId, resetStreamTimeout]
  )

  /**
   * Handler para confidence updates
   */
  const handleAgentConfidence = useCallback(
    (data: any) => {
      if (data.questionId !== questionIdRef.current) return
      if (data.organizationId !== organizationId) return

      logger.debug('[useAgentStream] Confidence update', {
        confidence: data.confidence,
      })

      setState((prev) => ({
        ...prev,
        confidence: data.confidence,
      }))
    },
    [organizationId]
  )

  /**
   * Handler para conclusão
   */
  const handleAgentDone = useCallback(
    (data: any) => {
      if (data.questionId !== questionIdRef.current) return
      if (data.organizationId !== organizationId) return

      // ⏱️ PRODUCTION FIX: Limpar timeout quando streaming completar
      clearStreamTimeout()

      logger.info('[useAgentStream] Stream completed', {
        confidence: data.confidence,
        tokensUsed: data.tokensUsed,
        processingTime: data.processingTime,
      })

      setState((prev) => ({
        ...prev,
        fullResponse: data.response,
        confidence: data.confidence,
        isDone: true,
        isStreaming: false,
        tokensGenerated: data.tokensUsed,
        processingTime: data.processingTime,
      }))
    },
    [organizationId, clearStreamTimeout]
  )

  /**
   * Handler para erros
   */
  const handleAgentError = useCallback(
    (data: any) => {
      if (data.questionId !== questionIdRef.current) return
      if (data.organizationId !== organizationId) return

      // ⏱️ PRODUCTION FIX: Limpar timeout quando ocorrer erro
      clearStreamTimeout()

      logger.error('[useAgentStream] Agent error', {
        error: data.error,
        code: data.code,
      })

      setState((prev) => ({
        ...prev,
        error: data.error,
        isDone: true,
        isStreaming: false,
      }))
    },
    [organizationId, clearStreamTimeout]
  )

  /**
   * Configurar listeners do WebSocket com debounce/retry
   */
  useEffect(() => {
    // 🔴 FIX CRÍTICO: Validações antes de registrar listeners
    if (!organizationId || organizationId === '') {
      logger.error('[useAgentStream] Cannot register listeners without organizationId')
      return
    }

    if (!socket) {
      logger.debug('[useAgentStream] Socket not available, waiting...')
      return
    }

    // 🔴 FIX CRÍTICO: Aguardar socket estar conectado com retry
    if (!socket.connected) {
      logger.debug('[useAgentStream] Socket not connected yet, will retry...')

      let retries = 0
      const maxRetries = 10
      const checkConnection = setInterval(() => {
        retries++

        if (socket.connected) {
          clearInterval(checkConnection)
          logger.info('[useAgentStream] Socket connected after retry')
        } else if (retries >= maxRetries) {
          clearInterval(checkConnection)
          logger.error('[useAgentStream] Socket connection timeout after 10 retries')
        }
        // 🔇 PRODUCTION: Removido log de cada retry para reduzir ruído
      }, 500) // Check every 500ms

      return () => clearInterval(checkConnection)
    }

    logger.debug('[useAgentStream] Registering WebSocket listeners', {
      socketId: socket.id,
      connected: socket.connected,
      organizationId
    })

    // Registrar listeners (apenas eventos essenciais)
    socket.on('agent:token', handleAgentToken)
    socket.on('agent:confidence', handleAgentConfidence)
    socket.on('agent:done', handleAgentDone)
    socket.on('agent:error', handleAgentError)

    logger.info('[useAgentStream] WebSocket listeners registered successfully')

    // Cleanup
    return () => {
      socket.off('agent:token', handleAgentToken)
      socket.off('agent:confidence', handleAgentConfidence)
      socket.off('agent:done', handleAgentDone)
      socket.off('agent:error', handleAgentError)

      // ⏱️ PRODUCTION FIX: Limpar timeout no cleanup
      clearStreamTimeout()

      logger.debug('[useAgentStream] WebSocket listeners removed')
    }
  }, [
    socket,
    socket?.connected,
    handleAgentToken,
    handleAgentConfidence,
    handleAgentDone,
    handleAgentError,
    organizationId,
    clearStreamTimeout,
  ])

  /**
   * Inicia streaming para uma pergunta
   */
  const startStream = useCallback((questionId: string) => {
    if (!organizationId) {
      logger.error('[useAgentStream] Cannot start stream without organizationId!')
      return
    }

    // 🔇 PRODUCTION: Usar logger ao invés de console.log
    logger.info('[useAgentStream] Starting stream', {
      questionId,
      organizationId,
      socketConnected: !!socket?.connected
    })

    questionIdRef.current = questionId
    startTimeRef.current = Date.now()

    // ⏱️ PRODUCTION FIX: Iniciar timeout de streaming
    resetStreamTimeout()

    setState({
      isStreaming: true,
      currentToken: '',
      fullResponse: '',
      sequenceNumber: 0,
      confidence: 0,
      isDone: false,
      error: null,
      tokensGenerated: 0,
      processingTime: 0,
    })
  }, [organizationId, socket, resetStreamTimeout])

  /**
   * Reseta estado do stream
   */
  const resetStream = useCallback(() => {
    logger.debug('[useAgentStream] Resetting stream')

    // ⏱️ PRODUCTION FIX: Limpar timeout ao resetar
    clearStreamTimeout()

    setState({
      isStreaming: false,
      currentToken: '',
      fullResponse: '',
      sequenceNumber: 0,
      confidence: 0,
      isDone: false,
      error: null,
      tokensGenerated: 0,
      processingTime: 0,
    })

    questionIdRef.current = ''
    startTimeRef.current = 0
  }, [clearStreamTimeout])

  return {
    ...state,
    startStream,
    resetStream,
  }
}
