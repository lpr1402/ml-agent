/**
 * QuestionCard - Componente Premium para Exibição de Perguntas ML
 *
 * FLUXOS DE PROCESSAMENTO 2025-11-24:
 *
 * 📥 PROCESSAMENTO NORMAL (pergunta recebida):
 * 1. Pergunta chega → status: PROCESSING
 * 2. PRIORIDADE 5: Mostra "ML Agent está pensando..."
 * 3. Backend inicia streaming → agentStream.startStream()
 * 4. PRIORIDADE 3: agentStream.isStreaming = true → tokens aparecem real-time
 * 5. Streaming completa → agentStream.isDone = true
 * 6. PRIORIDADE 4: Mostra resposta completa (temporário)
 * 7. Backend salva → question.aiSuggestion atualizado
 * 8. PRIORIDADE 2: Mostra resposta salva (estado final)
 *
 * ♻️ FLUXO DE REVISÃO (usuário pede para melhorar):
 * 1. Usuário abre formulário inline → isRevising = true
 * 2. Usuário digita feedback e clica "Revisar com IA"
 * 3. Backend recebe request → status: REVISING
 * 4. PRIORIDADE 1: isErasing = true → apaga resposta anterior
 * 5. Após erasing completo → agentStream.startStream()
 * 6. PRIORIDADE 3: Streaming ativo → tokens aparecem real-time
 * 7. Streaming completa → PRIORIDADE 4 (temporário)
 * 8. Backend salva → question.aiSuggestion atualizado
 * 9. PRIORIDADE 2: Mostra nova resposta revisada
 *
 * ✅ GARANTIAS:
 * - Condições mutuamente exclusivas (sem conflitos)
 * - Prioridade clara e documentada
 * - Sempre mostra question.aiSuggestion como fonte da verdade
 * - Streaming real-time token-by-token
 * - Transições suaves e naturais
 *
 * @author ML Agent Team
 * @date 2025-11-24
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Question, MLAccount } from '@prisma/client'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Edit2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Zap,
  RefreshCw,
  Loader2,
  Send
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { logger } from '@/lib/logger'
import { useWebSocket } from '@/hooks/use-websocket'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { StreamingResponse } from './streaming-response'
import { ErrorFeedback, LoadingState } from './approval-feedback'
import { ApprovalAnimation, ApprovalAnimationState } from './approval-animation'
// import { toast } from '@/hooks/use-toast' // Removido - apenas notificações do dispositivo

interface QuestionCardProps {
  question: Question & {
    mlAccount?: MLAccount & {
      mlUserId?: string
      thumbnail?: string | null
    }
    item?: {
      title?: string
      thumbnail?: string
    }
    mlAnswerId?: string | null // ID da resposta enviada ao ML
    sentToMLAt?: Date | string | null
  }
  onApprove?: (answer: string) => Promise<{
    success?: boolean
    mlAnswerId?: string
    error?: string
    isRateLimit?: boolean
  } | void>
  onEdit?: (answer: string) => Promise<void>
}

// Add shimmer animation to global styles or inline
const shimmerKeyframes = `
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .animation-delay-200 {
    animation-delay: 200ms;
  }

  .animation-delay-400 {
    animation-delay: 400ms;
  }
`

// Style injection moved to useEffect for proper cleanup
const injectShimmerStyles = () => {
  if (typeof document !== 'undefined' && !document.getElementById('shimmer-animation')) {
    const style = document.createElement('style')
    style.id = 'shimmer-animation'
    style.textContent = shimmerKeyframes
    document.head.appendChild(style)
    return style
  }
  return null
}

export function QuestionCard({ question, onApprove, onEdit }: QuestionCardProps) {
  // 🤖 AI Agent Streaming (NOVO)
  const websocket = useWebSocket()
  const { socket, organizationId: wsOrgId } = websocket

  // 🔴 FIX CRÍTICO: Pegar organizationId com múltiplos fallbacks
  // Ordem de prioridade:
  // 1. mlAccount.organizationId (dados da API/WebSocket)
  // 2. question.organizationId (pode estar no objeto raiz)
  // 3. wsOrgId (WebSocket global connection)
  const organizationId = question.mlAccount?.organizationId ||
                         (question as any).organizationId ||
                         wsOrgId ||
                         ''

  // 🔴 DEBUG: Log apenas se vazio (para rastrear edge cases)
  useEffect(() => {
    if (!organizationId) {
      console.error('[QuestionCard] ❌ organizationId is EMPTY after all fallbacks!', {
        fromMlAccount: question.mlAccount?.organizationId,
        fromQuestionRoot: (question as any).organizationId,
        fromWebSocket: wsOrgId,
        mlAccountId: question.mlAccount?.id,
        questionId: question.id
      })
    }
  }, [organizationId, question.mlAccount?.organizationId, wsOrgId, question.mlAccount?.id, question.id, question])

  const agentStream = useAgentStream(organizationId, socket)

  // Estados existentes
  const [isEditing, setIsEditing] = useState(false)
  const [editedResponse, setEditedResponse] = useState(question.aiSuggestion || question.answer || '')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isReprocessing, setIsReprocessing] = useState(false)

  // 🔴 NOVO: Estados para revisão inline (sem modal)
  const [isRevising, setIsRevising] = useState(false)
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [revisionError, setRevisionError] = useState<string | null>(null)
  const [isErasing, setIsErasing] = useState(false)
  const [erasingText, setErasingText] = useState('')

  // Estados de feedback
  const [approvalFeedback, setApprovalFeedback] = useState<{
    type: 'success' | 'error' | 'loading' | 'warning'
    message: string
    details?: string
    errorCode?: string
    isRateLimit?: boolean
    canRetry?: boolean
  } | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const eraseIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isStuckQuestion, setIsStuckQuestion] = useState(false)

  // 🎯 NOVO: Estado unificado para ApprovalAnimation (loading, success, error)
  const [approvalAnimationState, setApprovalAnimationState] = useState<ApprovalAnimationState | null>(null)
  const [approvalAnimationMessage, setApprovalAnimationMessage] = useState<string>('')
  const [approvalAnimationDetails, setApprovalAnimationDetails] = useState<string>('')

  // 🔊 Helper: Reproduzir som de notificação
  const playNotificationSound = (type: 'success' | 'error' = 'error') => {
    try {
      const soundFile = type === 'success' ? '/notification-new.mp3' : '/notification.mp3'
      const audio = new Audio(soundFile)
      audio.volume = 0.4
      audio.play().catch(() => {
        // Silenciosamente falhar se não conseguir reproduzir (browser pode bloquear)
      })
    } catch (_error) {
      // Silenciosamente falhar
    }
  }

  // 📳 Helper: Vibração iOS (haptic feedback)
  const triggerHapticFeedback = (pattern: 'success' | 'error' | 'warning' = 'error') => {
    try {
      if (navigator.vibrate) {
        const patterns = {
          success: [50, 30, 50], // Padrão de sucesso
          error: [100, 50, 100, 50, 100], // Padrão de erro (mais intenso)
          warning: [80, 40, 80] // Padrão de aviso
        }
        navigator.vibrate(patterns[pattern])
      }
    } catch (_error) {
      // Silenciosamente falhar
    }
  }

  // Inject shimmer styles with proper cleanup
  useEffect(() => {
    const style = injectShimmerStyles()
    return () => {
      // Clean up style on unmount only if this component created it
      if (style && document.head.contains(style)) {
        document.head.removeChild(style)
      }
    }
  }, [])

  // 🔴 FIX CRÍTICO: Handler UNIFICADO para todos os erros
  useEffect(() => {
    const handleQuestionError = (event: CustomEvent) => {
      const { questionId, failureReason, errorType, canRetryNow, isRateLimit, keepStatus } = event.detail

      // Check if this error is for current question
      if (question.mlQuestionId !== questionId && question.id !== questionId) {
        return
      }

      logger.info('[Question Card] ⚠️ Error received via WebSocket', {
        questionId,
        errorType,
        failureReason,
        canRetryNow,
        isRateLimit,
        keepStatus
      })

      // 🔊 Feedback sensorial de erro
      playNotificationSound('error')
      triggerHapticFeedback(isRateLimit ? 'warning' : 'error')

      setIsProcessing(false)
      setIsRetrying(false)

      // CASO 1: Erro de Revisão com IA
      if (errorType === 'REVISION_ERROR' || errorType === 'AGENT_ERROR') {
        setRevisionError(failureReason || 'Erro ao revisar resposta com IA')
        setIsRevising(false) // 🔴 INLINE: Fechar revisão inline
        setIsProcessing(false)

        // Hide revision error after 10 seconds
        setTimeout(() => {
          setRevisionError(null)
        }, 10000)

        // Update local state to reflect AWAITING_APPROVAL
        question.status = 'AWAITING_APPROVAL'
        return
      }

      // CASO 2: Rate Limit (warning, não erro fatal)
      if (isRateLimit) {
        setApprovalFeedback({
          type: 'warning',
          message: 'Rate Limit Ativo',
          details: 'O Mercado Livre está limitando requisições. Aguarde, tentaremos enviar automaticamente em alguns instantes.',
          isRateLimit: true,
          canRetry: false,
        })

        // Update local state
        if (question.status === 'PROCESSING' || question.status === 'APPROVED') {
          question.status = 'APPROVED'
        }
        return
      }

      // CASO 3: Erro ao enviar para ML
      setApprovalFeedback({
        type: 'error',
        message: 'Falha ao Enviar',
        details: failureReason || 'Não foi possível publicar a resposta no Mercado Livre. Verifique sua conexão e tente novamente.',
        errorCode: errorType,
        canRetry: canRetryNow !== false,
      })

      // Update local state se necessário (mas só se não for pra manter status)
      if (!keepStatus && (question.status === 'PROCESSING' || question.status === 'APPROVED')) {
        question.status = 'FAILED'
      }
    }

    // 🔴 FIX: Registrar listener ÚNICO para todos os tipos de erro
    window.addEventListener('websocket:question:error' as any, handleQuestionError)
    window.addEventListener('websocket:question:revision-error' as any, handleQuestionError)

    return () => {
      window.removeEventListener('websocket:question:error' as any, handleQuestionError)
      window.removeEventListener('websocket:question:revision-error' as any, handleQuestionError)
    }
  }, [question.mlQuestionId, question.id, question])

  // Listen for answer edited events (atualização em tempo real quando edição é salva)
  useEffect(() => {
    const handleAnswerEdited = (event: CustomEvent) => {
      const { questionId, mlQuestionId, editedAnswer } = event.detail

      // Check if this edit is for current question
      if (question.mlQuestionId === mlQuestionId || question.id === questionId) {
        // Atualizar resposta localmente sem recarregar
        question.aiSuggestion = editedAnswer
        setEditedResponse(editedAnswer)

        // Se estiver editando e a edição veio de outro lugar, sair do modo edição
        if (isEditing) {
          setIsEditing(false)
        }
      }
    }

    // Listen for revision success
    const handleRevisionSuccess = (event: CustomEvent) => {
      const { questionId, mlQuestionId, revisedAnswer } = event.detail

      if (question.mlQuestionId === mlQuestionId || question.id === questionId) {
        // Atualizar resposta com a revisão
        question.aiSuggestion = revisedAnswer
        question.status = 'AWAITING_APPROVAL'
        setEditedResponse(revisedAnswer)
        setIsRevising(false) // 🔴 INLINE: Fechar revisão inline
        setIsProcessing(false)
        setRevisionFeedback('') // Limpar feedback

        // 🔊 Feedback sensorial de sucesso na revisão
        playNotificationSound('success')
        triggerHapticFeedback('success')

        console.log('[Question] Revision completed successfully')
      }
    }

    // 🎯 NOVO: Listen for question answered successfully (enviada ao ML com sucesso)
    const handleQuestionAnswered = (event: CustomEvent) => {
      const { questionId, mlQuestionId, status } = event.detail

      if (question.mlQuestionId === mlQuestionId || question.id === questionId) {
        if (status === 'RESPONDED' || status === 'COMPLETED') {
          // 🔊 Feedback sensorial de SUCESSO ao enviar ao ML
          playNotificationSound('success')
          triggerHapticFeedback('success')

          // 🎯 NOVO: Mostrar animação de sucesso premium via WebSocket
          setApprovalAnimationState('success')
          setApprovalAnimationMessage('Publicado!')
          setApprovalAnimationDetails('Sua resposta está visível no Mercado Livre')

          // Limpar qualquer feedback anterior
          setApprovalFeedback(null)

          // 🔴 INLINE: Fechar animação após 4 segundos (UX otimizada)
          setTimeout(() => {
            setApprovalAnimationState(null)
          }, 4000) // 🎯 AUMENTADO: 4s para melhor visualização da confirmação

          console.log('[Question] ✅ Resposta enviada ao ML com sucesso!')
        }
      }
    }

    window.addEventListener('websocket:question:answer-edited' as any, handleAnswerEdited)
    window.addEventListener('websocket:question:revision-success' as any, handleRevisionSuccess)
    window.addEventListener('websocket:question:updated' as any, handleQuestionAnswered)

    return () => {
      window.removeEventListener('websocket:question:answer-edited' as any, handleAnswerEdited)
      window.removeEventListener('websocket:question:revision-success' as any, handleRevisionSuccess)
      window.removeEventListener('websocket:question:updated' as any, handleQuestionAnswered)
    }
  }, [question.mlQuestionId, question.id, question, isEditing])

  // 🔴 INLINE: Monitor status changes e streaming para fechar revisão inline quando completa ou quando streaming inicia
  const prevStatusRef = useRef(question.status)
  useEffect(() => {
    const prevStatus = prevStatusRef.current
    const currentStatus = question.status

    // Fechar formulário inline quando status muda para AWAITING_APPROVAL após revisão
    if (currentStatus === 'AWAITING_APPROVAL' &&
        (prevStatus === 'REVISING' || prevStatus === 'REVIEWING') &&
        isRevising) {
      setIsRevising(false)
      setRevisionFeedback('') // Limpar feedback
      console.log('[QuestionCard] ✅ Revision completed, closing inline form')
    }

    // Atualizar referência do status anterior
    prevStatusRef.current = currentStatus
  }, [question.status, isRevising])

  // 🔴 NOVO: Fechar formulário inline quando streaming da revisão INICIAR
  useEffect(() => {
    // Se streaming iniciou durante revisão E o formulário ainda está aberto
    if (agentStream.isStreaming && isRevising && question.status === 'REVISING') {
      setIsRevising(false)
      console.log('[QuestionCard] ✅ Streaming started, closing inline revision form')
    }
  }, [agentStream.isStreaming, isRevising, question.status])

  // Limpa o estado de reprocessamento quando a resposta chega ou falha
  useEffect(() => {
    // IMPORTANTE: Nunca mostrar processando se já tem resposta
    if (question.aiSuggestion) {
      setIsReprocessing(false)
      setIsProcessing(false)

      // Se tem aiSuggestion mas status está errado, não iniciar processamento
      if (question.status === 'PROCESSING') {
        // Status incorreto - não deveria estar PROCESSING com aiSuggestion
        return
      }
    }

    // Status finais - não processar
    if (['RESPONDED', 'COMPLETED', 'SENT_TO_ML', 'APPROVED'].includes(question.status)) {
      setIsReprocessing(false)
      setIsProcessing(false)
      return
    }

    // Garante que não inicia processando do nada ao recarregar
    if (question.status === 'AWAITING_APPROVAL' && question.aiSuggestion) {
      setIsReprocessing(false)
      setIsProcessing(false)
      return
    }

    if (isReprocessing) {
      // Se a resposta chegou com sucesso
      if (question.aiSuggestion && (question.status === 'AWAITING_APPROVAL' || question.status === 'PROCESSING')) {
        setIsReprocessing(false)
        setIsProcessing(false)
        // Para o polling se ainda estiver rodando
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        // Removido toast - apenas notificações do dispositivo
        console.log('[Question] AI processing completed')
      }
      // Se falhou o processamento
      else if (question.status === 'FAILED' || question.status === 'ERROR' || question.status === 'TOKEN_ERROR') {
        setIsReprocessing(false)
        setIsProcessing(false)
        // Para o polling se ainda estiver rodando
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }
  }, [question.aiSuggestion, question.status, isReprocessing])

  // 🤖 AUTO-START: Iniciar streaming automaticamente quando pergunta entra em PROCESSING ou REVISING
  // Este é o coração da experiência real-time - inicia streaming assim que o backend começa processar
  // 🔴 FIX: Extrair valores primitivos do agentStream para evitar loops (objeto muda a cada token)
  const isStreaming = agentStream.isStreaming
  const streamIsDone = agentStream.isDone
  const startStreamFn = agentStream.startStream

  useEffect(() => {
    // ✅ VALIDAÇÃO 1: organizationId é obrigatório
    if (!organizationId || organizationId === '') {
      // 🔴 FIX: Log apenas uma vez, não em cada render
      logger.error('[QuestionCard] Cannot start stream without organizationId!')
      return
    }

    // ✅ VALIDAÇÃO 2: WebSocket deve estar conectado e pronto
    if (!socket || !socket.connected) {
      // 🔴 FIX: Não logar warning repetidamente durante reconnect
      // O useWebSocket já lida com reconexão, apenas aguardar silenciosamente
      return
    }

    // ✅ VALIDAÇÃO 3: Verificar se deve iniciar streaming AUTOMATICAMENTE
    // IMPORTANTE: Este useEffect é apenas para perguntas NOVAS que entram em PROCESSING
    // Para REVISING, o handleRevise() já inicia o streaming manualmente

    // Só auto-start para PROCESSING (perguntas novas) - NÃO para REVISING
    // REVISING é controlado manualmente pelo handleRevise()
    const isNewQuestionProcessing = question.status === 'PROCESSING' ||
                                    question.status === 'REVIEWING'

    const hasValidResponse = question.aiSuggestion &&
      question.aiSuggestion.length > 50 && // Resposta deve ter conteúdo significativo
      question.aiSuggestion !== 'Processando pergunta recebida do Mercado Livre' &&
      question.aiSuggestion !== 'Pergunta sem texto' &&
      question.aiSuggestion !== 'Erro ao processar pergunta' &&
      !question.aiSuggestion.startsWith('Erro:') &&
      !question.aiSuggestion.startsWith('ERRO:')

    // Auto-start streaming APENAS para perguntas novas em PROCESSING
    const shouldAutoStartStream = isNewQuestionProcessing &&
      !hasValidResponse &&
      !isStreaming &&
      !streamIsDone &&
      !isErasing

    if (shouldAutoStartStream) {
      logger.info('[QuestionCard] AUTO-START: Iniciando streaming para nova pergunta', {
        questionId: question.id,
        mlQuestionId: question.mlQuestionId,
        status: question.status,
      })

      startStreamFn(question.id)
    }
    // 🔴 FIX: Removidos logs desnecessários que causavam spam
    // Estado "inconsistente" durante REVISING é ESPERADO e controlado pelo handleRevise
  }, [
    question.status,
    question.aiSuggestion,
    question.id,
    question.mlQuestionId,
    // 🔴 FIX: Usar valores primitivos em vez do objeto agentStream inteiro
    // Isso evita re-execução a cada token recebido durante streaming
    isStreaming,
    streamIsDone,
    startStreamFn,
    socket?.connected,
    organizationId,
    isErasing
  ])

  // 🤖 NOVO: Atualizar editedResponse quando aiSuggestion muda
  useEffect(() => {
    if (question.aiSuggestion && question.aiSuggestion !== editedResponse) {
      setEditedResponse(question.aiSuggestion)
      logger.info('[Question Card] AI Suggestion updated', {
        questionId: question.id,
        responseLength: question.aiSuggestion.length,
      })
    }
  }, [question.aiSuggestion]) // eslint-disable-line react-hooks/exhaustive-deps

  // 🤖 NOVO: Auto-scroll para acompanhar streaming
  const responseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (agentStream.isStreaming && responseRef.current) {
      // Smooth scroll para o final da resposta durante streaming
      responseRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      })
    }
  }, [agentStream.fullResponse, agentStream.isStreaming])

  // 🧹 CLEANUP: Limpar estados e recursos ao desmontar componente
  // Isso garante que não haja memory leaks ou estados pendentes
  useEffect(() => {
    return () => {
      // Limpar polling interval se ainda estiver rodando
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
        console.log('[QuestionCard] 🧹 Cleanup: Polling interval cleared')
      }

      // Resetar stream ao desmontar (evita estados pendentes)
      if (agentStream.isStreaming) {
        agentStream.resetStream()
        console.log('[QuestionCard] 🧹 Cleanup: Agent stream reset')
      }

      // Limpar estados locais
      if (isErasing) {
        setIsErasing(false)
        setErasingText('')
        console.log('[QuestionCard] 🧹 Cleanup: Erasing state cleared')
      }

      console.log('[QuestionCard] 🧹 Component unmounted, cleanup completed', {
        questionId: question.id
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 🤖 NOVO: Atualizar editedResponse quando streaming completa (inicial ou revisão)
  useEffect(() => {
    if (agentStream.isDone && agentStream.fullResponse) {
      // Atualizar resposta editável com resultado do streaming
      setEditedResponse(agentStream.fullResponse)

      // Se foi uma revisão, a aiSuggestion será atualizada via WebSocket pelo backend
      // Aqui apenas sincronizamos o estado local para exibição imediata
      logger.info('[QuestionCard] Stream completed, response ready', {
        questionId: question.id,
        responseLength: agentStream.fullResponse.length,
        confidence: agentStream.confidence,
        isRevision: isErasing || question.status === 'REVISING',
      })

      // Limpar estado de erasing se estava ativo
      if (isErasing) {
        setIsErasing(false)
        setErasingText('')
      }
    }
  }, [agentStream.isDone, agentStream.fullResponse, question.id, agentStream.confidence, isErasing, question.status])

  // Limpa os intervals quando o componente é desmontado
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      // ✅ FIX: Limpar eraseInterval para evitar memory leak
      if (eraseIntervalRef.current) {
        clearInterval(eraseIntervalRef.current)
        eraseIntervalRef.current = null
      }
      // Reseta estados ao desmontar para evitar loops
      setIsReprocessing(false)
      setIsProcessing(false)
      setIsErasing(false)
      setErasingText('')
    }
  }, [])

  // 🎯 NOVO: Detectar perguntas travadas (sem dados após 5 minutos)
  useEffect(() => {
    // Verificar se a pergunta está travada:
    // 1. Status RECEIVED ou PROCESSING
    // 2. Sem resposta da IA
    // 3. Recebida há mais de 5 minutos
    // 4. Texto genérico (indica que não conseguiu buscar dados do ML)

    const checkIfStuck = () => {
      const isInLimboStatus = ['RECEIVED', 'PROCESSING'].includes(question.status)
      const hasNoAiResponse = !question.aiSuggestion
      const hasGenericText = question.text?.includes('Processando') ||
                            question.text?.includes('dados pendentes') ||
                            question.text?.includes('Clique em "Reprocessar"')

      if (!isInLimboStatus || !hasNoAiResponse) {
        setIsStuckQuestion(false)
        return
      }

      // Calcular tempo desde que foi recebida
      const receivedDate = question.receivedAt || question.dateCreated || question.createdAt
      if (!receivedDate) {
        setIsStuckQuestion(false)
        return
      }

      const timeSinceReceived = Date.now() - new Date(receivedDate).getTime()
      const fiveMinutesInMs = 5 * 60 * 1000

      // Marcar como travada se passou 5 minutos
      if (timeSinceReceived > fiveMinutesInMs || hasGenericText) {
        setIsStuckQuestion(true)
        logger.info('[Question Card] Detected stuck question', {
          questionId: question.mlQuestionId,
          status: question.status,
          timeSinceReceived: Math.floor(timeSinceReceived / 1000 / 60) + ' minutes',
          hasGenericText
        })
      } else {
        setIsStuckQuestion(false)
      }
    }

    // Verificar imediatamente
    checkIfStuck()

    // Verificar a cada 30 segundos
    const interval = setInterval(checkIfStuck, 30000)

    return () => clearInterval(interval)
  }, [question.status, question.aiSuggestion, question.text, question.receivedAt, question.dateCreated, question.createdAt, question.mlQuestionId])

  // Status configuration with premium design
  const getStatusConfig = () => {
    // Se tem resposta da IA mas status está incorreto como PROCESSING, mostrar como AWAITING_APPROVAL
    if (question.aiSuggestion && question.status === 'PROCESSING') {
      return {
        gradient: 'from-amber-500/20 to-yellow-500/20',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        icon: AlertCircle,
        label: 'Pendente',
        pulse: true,
        glow: true
      }
    }

    switch (question.status) {
      // Aguardando aprovação do usuário (pergunta processada pela IA, esperando aprovação)
      case 'AWAITING_APPROVAL':
      case 'PENDING':
      case 'RECEIVED': // Legado
        return {
          gradient: 'from-amber-500/20 to-yellow-500/20',
          border: 'border-amber-500/30',
          text: 'text-amber-400',
          icon: AlertCircle,
          label: 'Pendente',
          pulse: true,
          glow: true
        }
      // Processando no N8N - GOLD (cor da marca)
      case 'PROCESSING':
        return {
          gradient: 'from-gold/20 to-gold-light/20',
          border: 'border-gold/40',
          text: 'text-gold',
          icon: Zap,
          label: 'Processando',
          pulse: true,
          spin: false // Zap não gira, apenas pulsa
        }
      // Revisando com Gemini Agent
      case 'REVIEWING':
      case 'REVISING': // Legado
        return {
          gradient: 'from-gold/20 to-gold-light/20',
          border: 'border-gold/30',
          text: 'text-gold',
          icon: Sparkles,
          label: 'Revisando',
          pulse: true,
          spin: false // ✅ FIX: Removido spin para UX mais limpa
        }
      // Respondida (aprovada e enviada ao Mercado Livre)
      case 'RESPONDED':
      case 'COMPLETED': // Legado
      case 'APPROVED': // Legado
      case 'SENT_TO_ML': // Legado
        return {
          gradient: 'from-emerald-500/20 to-green-600/20',
          border: 'border-emerald-500/30',
          text: 'text-emerald-400',
          icon: CheckCircle2,
          label: 'Respondida',
          glow: true
        }
      case 'FAILED':
        return {
          gradient: 'from-red-500/20 to-rose-500/20',
          border: 'border-red-500/30',
          text: 'text-red-400',
          icon: XCircle,
          label: 'Erro - Ação Necessária'
        }
      case 'ERROR':
      case 'TOKEN_ERROR':
        return {
          gradient: 'from-red-500/20 to-orange-500/20',
          border: 'border-orange-500/30',
          text: 'text-orange-400',
          icon: AlertCircle,
          label: 'Erro',
          pulse: true
        }
      default:
        return {
          gradient: 'from-gray-500/20 to-gray-600/20',
          border: 'border-gray-500/30',
          text: 'text-gray-400',
          icon: Clock,
          label: question.status
        }
    }
  }

  const statusConfig = getStatusConfig()
  const StatusIcon = statusConfig.icon

  // Format date
  const formatDate = (date: Date | string | null) => {
    if (!date) return ''
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Agora mesmo'
    if (diffMins === 1) return 'há 1 minuto'
    if (diffMins < 60) return `há ${diffMins} minutos`

    const hours = Math.floor(diffMins / 60)
    if (hours === 1) return 'há 1 hora'
    if (hours < 24) return `há ${hours} horas`

    const days = Math.floor(hours / 24)
    if (days === 1) return 'há 1 dia'
    if (days < 7) return `há ${days} dias`

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d)
  }

  // 🔴 INLINE: Handle approve com animação inline (não fullscreen)
  const handleApprove = async () => {
    if (isProcessing) return // Previne cliques múltiplos
    setIsProcessing(true)
    setApprovalFeedback(null) // Limpar feedback anterior

    // 🎯 NOVO: Mostrar animação de loading premium
    setApprovalAnimationState('loading')
    setApprovalAnimationMessage('Enviando ao Mercado Livre...')
    setApprovalAnimationDetails('Aguarde enquanto publicamos sua resposta')

    try {
      // Usar sempre a aiSuggestion que já foi salva no banco
      const responseToSend = question.aiSuggestion

      // Use prop callback if provided, otherwise make API call
      if (onApprove) {
        const result = await onApprove(responseToSend || '')

        // 🎯 FIX: Verificar resultado e mostrar feedback apropriado
        if (result?.success && result?.mlAnswerId) {
          // ✅ SUCESSO: Resposta enviada ao ML
          playNotificationSound('success')
          triggerHapticFeedback('success')

          setApprovalAnimationState('success')
          setApprovalAnimationMessage('Publicado!')
          setApprovalAnimationDetails('Sua resposta está visível no Mercado Livre')

          setTimeout(() => {
            setApprovalAnimationState(null)
          }, 4000)

          console.log('✅ Resposta Enviada ao Mercado Livre')
        } else if (result?.isRateLimit) {
          // ⚠️ RATE LIMIT
          playNotificationSound('error')
          triggerHapticFeedback('error')

          setApprovalAnimationState('warning')
          setApprovalAnimationMessage('Rate Limit Ativo')
          setApprovalAnimationDetails('O Mercado Livre está limitando requisições. Aguarde e tente novamente.')

          setTimeout(() => {
            setApprovalAnimationState(null)
          }, 4000)
        } else if (!result?.success) {
          // ❌ ERRO
          playNotificationSound('error')
          triggerHapticFeedback('error')

          setApprovalAnimationState('error')
          setApprovalAnimationMessage('Falha no Envio')
          setApprovalAnimationDetails(result?.error || 'Não foi possível publicar no Mercado Livre. Tente novamente.')

          setTimeout(() => {
            setApprovalAnimationState(null)
          }, 4000)

          console.error('❌ Erro ao aprovar:', result?.error)
        }
      } else {
        const response = await fetch('/api/agent/approve-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: question.id,
            action: 'approve',
            response: responseToSend
          })
        })

        if (response.ok) {
          // 🔊 Feedback sensorial de sucesso
          playNotificationSound('success')
          triggerHapticFeedback('success')

          // 🎯 NOVO: Mostrar animação de sucesso premium
          setApprovalAnimationState('success')
          setApprovalAnimationMessage('Publicado!')
          setApprovalAnimationDetails('Sua resposta está visível no Mercado Livre')

          // 🔴 INLINE: Fechar animação e card após 4 segundos (UX otimizada)
          setTimeout(() => {
            setApprovalAnimationState(null)
            // Card vai desaparecer via animação no parent (multi-account-questions)
          }, 4000) // 🎯 AUMENTADO: 4s para melhor visualização da confirmação

          console.log('✅ Resposta Enviada ao Mercado Livre')
        } else {
          const error = await response.json()

          // 🔊 Feedback sensorial de erro
          playNotificationSound('error')
          triggerHapticFeedback('error')

          // 🎯 NOVO: Mostrar animação de erro premium
          if (error.isRateLimit) {
            setApprovalAnimationState('warning')
            setApprovalAnimationMessage('Rate Limit Ativo')
            setApprovalAnimationDetails('O Mercado Livre está limitando requisições. Aguarde, tentaremos enviar automaticamente.')
          } else {
            setApprovalAnimationState('error')
            setApprovalAnimationMessage('Falha no Envio')
            setApprovalAnimationDetails(error.error || 'Não foi possível publicar no Mercado Livre. Tente novamente.')
          }

          // Fechar animação após 4 segundos (erro persiste mais tempo)
          setTimeout(() => {
            setApprovalAnimationState(null)
          }, 4000)

          console.error('❌ Erro ao aprovar:', error.error)
        }
      }
    } catch (_error) {
      // 🔊 Feedback sensorial de erro de network
      playNotificationSound('error')
      triggerHapticFeedback('error')

      // 🎯 NOVO: Mostrar animação de erro de conexão premium
      setApprovalAnimationState('error')
      setApprovalAnimationMessage('Erro de Conexão')
      setApprovalAnimationDetails('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.')

      // Fechar animação após 4 segundos
      setTimeout(() => {
        setApprovalAnimationState(null)
      }, 4000)

      console.error('❌ Erro ao processar aprovação')
    } finally {
      setIsProcessing(false)
    }
  }

  // 🎯 NOVO: Handle retry after error
  const handleRetry = async () => {
    if (isRetrying || isProcessing) return
    setIsRetrying(true)
    setApprovalFeedback(null)

    // Mostrar loading
    setApprovalFeedback({
      type: 'loading',
      message: 'Reenviando...',
      details: 'Tentando publicar novamente no Mercado Livre'
    })

    try {
      logger.info('[Question Card] Retrying failed question', {
        questionId: question.id,
        mlQuestionId: question.mlQuestionId
      })

      const response = await fetch('/api/agent/retry-failed-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id
        })
      })

      const result = await response.json()

      if (response.ok) {
        // 🔊 Feedback sensorial de sucesso
        playNotificationSound('success')
        triggerHapticFeedback('success')

        setApprovalFeedback({
          type: 'success',
          message: 'Reenvio Iniciado',
          details: 'Aguardando confirmação do Mercado Livre...'
        })

        console.log('✅ Retry enviado com sucesso')
      } else {
        // 🔊 Feedback sensorial de erro
        playNotificationSound('error')
        triggerHapticFeedback('error')

        setApprovalFeedback({
          type: 'error',
          message: 'Falha ao Reenviar',
          details: result.error || 'Não foi possível tentar novamente. Tente mais tarde.',
          canRetry: true,
        })

        console.error('❌ Erro no retry:', result.error)
      }
    } catch (_error) {
      // 🔊 Feedback sensorial de erro de network
      playNotificationSound('error')
      triggerHapticFeedback('error')

      setApprovalFeedback({
        type: 'error',
        message: 'Erro de Conexão',
        details: 'Não foi possível conectar ao servidor.',
        canRetry: true,
      })

      console.error('❌ Erro ao processar retry')
    } finally {
      setIsRetrying(false)
    }
  }

  // 🔴 INLINE: Handle revision inline (sem modal)
  const handleRevise = async () => {
    if (isProcessing || !revisionFeedback.trim()) {
      triggerHapticFeedback('warning')
      setRevisionError('Por favor, descreva as alterações que deseja fazer')
      setTimeout(() => setRevisionError(null), 3000)
      return
    }

    if (revisionFeedback.trim().length < 10) {
      triggerHapticFeedback('warning')
      setRevisionError('O feedback deve ter pelo menos 10 caracteres')
      setTimeout(() => setRevisionError(null), 3000)
      return
    }

    setIsProcessing(true)
    setRevisionError(null)

    try {
      const response = await fetch('/api/agent/revise-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          feedback: revisionFeedback,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao revisar resposta')
      }

      const data = await response.json()

      // ✅ API retorna imediatamente - streaming via WebSocket já foi iniciado pelo backend
      if (data.success) {
        // ✅ PASSO 1: Fechar formulário inline IMEDIATAMENTE
        setIsRevising(false)
        setRevisionFeedback('')

        // ✅ PASSO 2: Resetar e iniciar streaming IMEDIATAMENTE
        // CRÍTICO: O backend já começou a enviar tokens via WebSocket
        // Precisamos registrar o listener ANTES de fazer qualquer animação visual
        agentStream.resetStream()
        agentStream.startStream(question.id)

        logger.info('[Revision] Streaming iniciado - capturando tokens', {
          questionId: question.id,
          organizationId: question.mlAccount?.organizationId
        })

        // ✅ PASSO 3: Iniciar animação de "apagar letra por letra" EM PARALELO
        // Tokens são capturados pelo agentStream enquanto a animação acontece
        // Quando erasing terminar, UI automaticamente mostra o streaming
        const currentResponse = question.aiSuggestion || ''
        if (currentResponse && currentResponse.length > 0) {
          setErasingText(currentResponse)
          setIsErasing(true)

          // 🎬 Efeito de "erasing" Premium - Suave e Natural
          // Configurações para uma experiência de apagamento mais humana
          const ERASE_CONFIG = {
            MIN_CHARS: 2,      // Mínimo de chars por vez
            MAX_CHARS: 4,      // Máximo de chars por vez
            MIN_DELAY: 15,     // Delay mínimo (ms)
            MAX_DELAY: 35,     // Delay máximo (ms)
            WORD_PAUSE: 60,    // Pausa extra ao encontrar espaço/pontuação
          }

          let currentLength = currentResponse.length

          // Limpar interval anterior se existir (evita memory leak)
          if (eraseIntervalRef.current) {
            clearInterval(eraseIntervalRef.current)
          }

          // Função para apagar com variação natural
          const eraseNext = () => {
            if (currentLength <= 0) {
              if (eraseIntervalRef.current) {
                clearInterval(eraseIntervalRef.current)
                eraseIntervalRef.current = null
              }
              setErasingText('')
              setIsErasing(false)
              return
            }

            // Quantidade variável de chars para apagar (mais natural)
            const charsToErase = ERASE_CONFIG.MIN_CHARS +
              Math.floor(Math.random() * (ERASE_CONFIG.MAX_CHARS - ERASE_CONFIG.MIN_CHARS + 1))

            currentLength = Math.max(0, currentLength - charsToErase)
            setErasingText(currentResponse.substring(0, currentLength))

            // Delay variável para parecer mais humano
            let nextDelay = ERASE_CONFIG.MIN_DELAY +
              Math.random() * (ERASE_CONFIG.MAX_DELAY - ERASE_CONFIG.MIN_DELAY)

            // Pausa extra ao encontrar espaço ou pontuação (simula hesitação)
            if (currentLength > 0) {
              const lastChar = currentResponse.charAt(currentLength - 1)
              if ([' ', '.', ',', '!', '?', '\n'].includes(lastChar)) {
                nextDelay += ERASE_CONFIG.WORD_PAUSE
              }
            }

            // Agendar próxima iteração
            eraseIntervalRef.current = setTimeout(eraseNext, nextDelay)
          }

          // Iniciar erasing com pequeno delay para transição suave
          eraseIntervalRef.current = setTimeout(eraseNext, 200)
        }
        // Se não tinha resposta anterior, streaming já está ativo e será mostrado imediatamente

        // 🔊 Feedback sensorial de sucesso
        playNotificationSound('success')
        triggerHapticFeedback('success')
      }
    } catch (err: any) {
      setRevisionError(err.message || 'Erro ao revisar resposta')
      agentStream.resetStream()
      setIsProcessing(false)
      setIsErasing(false)
      setErasingText('')
      playNotificationSound('error')
      triggerHapticFeedback('error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle manual edit save (salva APENAS no banco de dados, NÃO envia ao ML)
  const handleSaveEdit = async () => {
    if (isProcessing) return // Previne cliques múltiplos
    if (!editedResponse.trim()) {
      // 🔊 Feedback sensorial de validação
      triggerHapticFeedback('warning')

      setApprovalFeedback({
        type: 'warning',
        message: 'Resposta Vazia',
        details: 'Digite uma resposta antes de salvar',
        canRetry: false
      })

      setTimeout(() => setApprovalFeedback(null), 3000)
      console.warn('⚠️ Campo vazio: A resposta não pode estar vazia')
      return
    }

    // Validar tamanho da resposta (limite ML: 2000 caracteres)
    if (editedResponse.length > 2000) {
      // 🔊 Feedback sensorial de validação
      triggerHapticFeedback('warning')

      setApprovalFeedback({
        type: 'warning',
        message: 'Resposta Muito Longa',
        details: `A resposta tem ${editedResponse.length} caracteres. O limite do Mercado Livre é 2000.`,
        canRetry: false
      })

      setTimeout(() => setApprovalFeedback(null), 4000)
      console.warn(`⚠️ Resposta muito longa: ${editedResponse.length} caracteres. Máximo permitido: 2000`)
      return
    }

    setIsProcessing(true)
    try {
      // Use prop callback if provided, otherwise make API call
      if (onEdit) {
        // Callback externo para página de aprovação única
        await onEdit(editedResponse)
        // Atualiza a sugestão da IA localmente
        question.aiSuggestion = editedResponse
        // Garante que o status permaneça AWAITING_APPROVAL
        question.status = 'AWAITING_APPROVAL'
        // 🔄 Reset do stream para evitar typewriter effect
        agentStream.resetStream()
        setIsEditing(false)
        // 🔊 Feedback sensorial
        playNotificationSound('success')
        triggerHapticFeedback('success')
        console.log('✅ Resposta Salva no banco de dados')
      } else {
        // Chama o novo endpoint que APENAS salva no banco (não envia ao ML)
        const response = await fetch('/api/agent/save-answer-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: question.id,
            editedAnswer: editedResponse
          })
        })

        if (response.ok) {
          const data = await response.json()

          // Atualiza a sugestão da IA localmente com a resposta do servidor
          question.aiSuggestion = data.question.aiSuggestion || editedResponse
          // Garante que o status permaneça AWAITING_APPROVAL
          question.status = data.question.status || 'AWAITING_APPROVAL'

          // 🔄 Reset do stream para evitar typewriter effect na resposta editada
          agentStream.resetStream()

          // Fecha o modo de edição
          setIsEditing(false)

          // 🔊 Feedback sensorial de sucesso (apenas som/vibração, sem popup)
          playNotificationSound('success')
          triggerHapticFeedback('success')

          console.log('✅ Resposta Salva com Sucesso no banco de dados')
        } else {
          const errorData = await response.json()

          // 🔊 Feedback sensorial de erro
          playNotificationSound('error')
          triggerHapticFeedback('error')

          // Feedback de erro
          setApprovalFeedback({
            type: 'error',
            message: 'Erro ao Salvar',
            details: errorData.error || 'Não foi possível salvar suas alterações',
            canRetry: true
          })

          console.error('❌ Erro ao salvar:', errorData.error)
        }
      }
    } catch (_error) {
      // 🔊 Feedback sensorial de erro de network
      playNotificationSound('error')
      triggerHapticFeedback('error')

      // Feedback de erro de conexão
      setApprovalFeedback({
        type: 'error',
        message: 'Erro de Conexão',
        details: 'Não foi possível conectar ao servidor',
        errorCode: 'NETWORK_ERROR',
        canRetry: true
      })

      console.error('❌ Erro ao salvar edição')
    } finally {
      setIsProcessing(false)
    }
  }


  // Handle reprocess
  const handleReprocess = async () => {
    if (isProcessing || isReprocessing) return // Previne cliques múltiplos

    // Limpa polling anterior se existir
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    setIsProcessing(true)
    setIsReprocessing(true) // Marca que está reprocessando

    try {
      const response = await fetch('/api/agent/reprocess-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id })
      })

      if (response.ok) {
        // 🔊 Feedback sensorial leve (solicitação aceita)
        triggerHapticFeedback('success')

        console.log('🔄 Reprocessando com IA - Aguarde enquanto o ML Agent processa')

        // Inicia polling mais agressivo durante o reprocessamento
        let attempts = 0
        const maxAttempts = 30 // 1 minuto max (30 * 2 segundos)

        // Timeout principal de 1 minuto
        const timeoutId = setTimeout(async () => {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          setIsReprocessing(false)

          // Atualizar status da pergunta para erro se ainda estiver processando
          if (question.status === 'PROCESSING' || question.status === 'REVIEWING') {
            try {
              await fetch('/api/agent/update-question-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  questionId: question.id,
                  status: 'FAILED',
                  failureReason: 'Timeout: processamento excedeu 1 minuto'
                })
              })
            } catch (error) {
              console.error('Erro ao atualizar status após timeout:', error)
            }
          }

          // 🔊 Feedback sensorial de timeout
          playNotificationSound('error')
          triggerHapticFeedback('warning')

          console.warn('⏱️ Tempo Esgotado - O processamento excedeu o limite de 1 minuto')
        }, 60000) // 60 segundos

        pollingIntervalRef.current = setInterval(() => {
          attempts++

          // Para o polling se exceder tentativas
          if (attempts >= maxAttempts) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = null
            }
            clearTimeout(timeoutId) // Limpar timeout se parar por tentativas
            return
          }

          // Atualização em tempo real via SSE

        }, 2000) // Verifica a cada 2 segundos

      } else {
        const error = await response.json()

        // Mensagens específicas para diferentes erros
        let errorMessage = error.error || 'Erro ao processar pergunta'
        if (error.error?.includes('No valid ML token')) {
          errorMessage = 'Nenhuma conta ativa encontrada. Por favor, faça login novamente em pelo menos uma conta.'
        } else if (error.error?.includes('No active ML accounts')) {
          errorMessage = 'Nenhuma conta ativa na organização. Adicione ou ative uma conta.'
        }

        // 🔊 Feedback sensorial de erro
        playNotificationSound('error')
        triggerHapticFeedback('error')

        // Feedback de erro
        setApprovalFeedback({
          type: 'error',
          message: 'Erro ao Reprocessar',
          details: errorMessage,
          canRetry: true
        })

        console.error('❌ Erro ao Reprocessar:', errorMessage)
        setIsReprocessing(false)
      }
    } catch (_error) {
      // 🔊 Feedback sensorial de erro de network
      playNotificationSound('error')
      triggerHapticFeedback('error')

      // Feedback de erro de conexão
      setApprovalFeedback({
        type: 'error',
        message: 'Erro de Conexão',
        details: 'Não foi possível conectar ao servidor',
        errorCode: 'NETWORK_ERROR',
        canRetry: true
      })

      console.error('❌ Erro de Conexão ao reprocessar')
      setIsReprocessing(false)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className={`
      relative overflow-hidden
      bg-gradient-to-br from-white/[0.04] to-white/[0.02]
      border border-white/[0.08]
      backdrop-blur-xl
      hover:bg-white/[0.05]
      hover:border-white/[0.12]
      transition-all duration-300
      group
      rounded-xl lg:rounded-2xl
      shadow-[0_4px_16px_rgba(0,0,0,0.2)]
      hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]
      ${statusConfig.glow ? 'shadow-xl shadow-gold/30 border-gold/30' : ''}
      ${false ? 'scale-[0.98] opacity-90' : ''}
    `}>

      {/* Animação Premium de Aprovação - REMOVIDA para evitar duplicação */}
      {false && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          {/* Backdrop suave */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-500" />

          <div className="relative flex flex-col items-center gap-6">
            {/* Logo ML Agent com efeito premium */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-gold/30 to-yellow-500/30 rounded-full blur-3xl scale-150 animate-pulse" />
              <div className="relative bg-gradient-to-br from-black to-gray-900 rounded-full p-1 border border-gold/20">
                <div className="bg-black rounded-full p-4">
                  <Image
                    src="/mlagent-logo-3d.png"
                    alt="ML Agent"
                    width={40}
                    height={40}
                    className="relative"
                    style={{
                      filter: 'drop-shadow(0 0 20px rgba(255, 230, 0, 0.4))'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Status de processamento elegante */}
            <div className="text-center space-y-2">
              <h3 className="text-white font-light tracking-wide text-sm">
                Processando Aprovação
              </h3>

              {/* Barra de progresso minimalista */}
              <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold via-yellow-500 to-gold rounded-full"
                     style={{
                       backgroundSize: '200% 100%',
                       animation: 'shimmer 1.5s ease-in-out infinite'
                     }} />
              </div>

              <p className="text-gray-400 text-xs font-light">
                Enviando resposta ao Mercado Livre
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Background Glow for Important States */}
      {statusConfig.glow && (
        <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-50 pointer-events-none" />
      )}

      {/* Main Content - Premium Responsive */}
      <div className="relative p-4 lg:p-5 space-y-3 lg:space-y-4">
        {/* Premium Header Section - Mobile Responsive */}
        <div className="space-y-4">
          {/* Top Info Bar - Seller, Date & Status Badges */}
          <div className="flex items-center justify-between gap-3 pb-3 lg:pb-4 border-b border-white/[0.06]">
            {/* Seller Info with Date */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {question.mlAccount && (
                <div className="flex items-center gap-2 lg:gap-2.5 px-2.5 lg:px-3 py-1.5 rounded-lg lg:rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08]">
                  {/* Seller Profile Photo - Smaller on Mobile */}
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/30 to-gold/10 blur-sm rounded-full" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={question.mlAccount.thumbnail || '/mlagent-logo-3d.png'}
                      alt={question.mlAccount.nickname}
                      className="relative w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full border border-gold/40 ring-1 ring-gold/20 object-cover shadow-lg shadow-gold/10"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = '/mlagent-logo-3d.png'
                      }}
                    />
                  </div>

                  {/* Seller Name with Time - Mobile Text Sizes */}
                  <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                    <span className="text-xs sm:text-sm font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent truncate max-w-[100px] sm:max-w-none">
                      {question.mlAccount.nickname}
                    </span>
                    <span className="text-xs text-gray-400 hidden sm:inline">•</span>
                    <span className="text-xs font-medium text-gold/80 hidden sm:inline">
                      {formatDate((question as any).dateCreated || (question as any).receivedAt || (question as any).createdAt)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Premium Status Badges - Compact on Mobile */}
            <div className="flex flex-col gap-2 items-end flex-shrink-0">
              <div className={`
                flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl
                bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90
                backdrop-blur-xl border ${statusConfig.border}
                ${statusConfig.pulse ? 'animate-pulse' : ''}
                shadow-lg min-w-[100px] sm:min-w-[140px] justify-center
              `}>
                <StatusIcon className={`
                  w-3.5 h-3.5 sm:w-4 sm:h-4 ${statusConfig.text}
                  ${statusConfig.spin ? 'animate-spin' : ''}
                  drop-shadow-lg
                `} />
                <span className={`text-[10px] sm:text-xs font-semibold ${statusConfig.text} uppercase tracking-wide sm:tracking-wider`}>
                  {statusConfig.label}
                </span>
              </div>

              {/* Badge de Confirmação quando enviado ao ML com sucesso */}
              {question.status === 'RESPONDED' && question.mlAnswerId && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-gradient-to-br from-emerald-900/40 to-green-900/40 border border-emerald-500/30 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[8px] sm:text-[9px] text-emerald-400/70 font-medium leading-tight">
                        ML ID
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-emerald-300 font-mono font-semibold leading-tight">
                        {question.mlAnswerId}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Premium Product Title with Price - Mobile Optimized - Full Width */}
          <div className="relative w-full p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/5 group hover:border-gold/10 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg sm:rounded-xl" />
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3">
              <div className="flex items-start sm:items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
                {/* Product Image - Real thumbnail from Mercado Livre - ALINHAMENTO VERTICAL CENTRALIZADO NO DESKTOP */}
                <div className="relative flex-shrink-0 self-start sm:self-center">
                  <div className="absolute inset-0 bg-gold/10 blur-sm rounded" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={question.itemThumbnail || '/mlagent-logo-3d.png'}
                    alt={question.itemTitle || 'Produto'}
                    className="relative w-8 h-8 sm:w-10 sm:h-10 rounded object-cover border border-gold/30 ring-1 ring-gold/20 shadow-md"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = '/mlagent-logo-3d.png'
                    }}
                  />
                </div>
                <h3 className="font-bold text-white text-sm sm:text-base leading-tight line-clamp-2 self-start sm:self-center">
                  {question.itemTitle || 'Produto'}
                </h3>
              </div>

              {/* Price - Mobile Optimized */}
              {question.itemPrice && (
                <div className="relative self-start sm:self-auto rounded-md sm:rounded-lg bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-xl border border-gold/20 overflow-hidden px-2 py-1 sm:px-3 sm:py-1.5 group/price hover:border-gold/30 transition-all duration-300 shadow-lg shadow-gold/5 flex-shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-gold/10 opacity-50 pointer-events-none" />
                  <div className="relative flex items-center gap-0.5 sm:gap-1">
                    <span className="text-[10px] sm:text-[11px] text-gold/70 font-semibold">R$</span>
                    <span className="text-sm sm:text-base font-bold bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
                      {question.itemPrice.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Premium Question Box - Mobile Optimized - Full Width - Mesmo padding da resposta */}
          <div className="relative w-full p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-gray-900/50 via-black/50 to-gray-900/50 border border-white/5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-gold/10 blur-md" />
                <div className="relative w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center border border-gold/30">
                  <span className="text-[10px] sm:text-xs font-bold text-gold">?</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-medium flex-1 min-w-0">
                {question.text}
              </p>
            </div>
          </div>
        </div>

        {/* AI Response Section - Streaming real-time ou resposta salva */}
        {(question.aiSuggestion || question.status === 'AWAITING_APPROVAL' || question.status === 'PROCESSING' || question.status === 'REVISING' || isReprocessing || agentStream.isStreaming || agentStream.fullResponse) && (
          <div className="mt-4 relative">
            {/* ✅ REMOVIDO: Overlay de desfoque - Agora streaming aparece em tempo real */}

            {/* 🎯 HEADER: Status da Resposta - Clean & Highend
                ESTADOS:
                1. REVISANDO (ERASING/REVISING sem resposta): "ML Agent está revisando" + 3 pontinhos
                2. PENSANDO (PROCESSING sem resposta): "ML Agent está pensando" + 3 pontinhos
                3. RESPOSTA (tem texto sendo exibido ou salvo): "Resposta sugerida" + ícone
            */}
            <div className="flex items-center gap-2.5 mb-3">
              {/* 🔥 ESTADO 1: REVISANDO - Durante erasing ou revising sem resposta visível */}
              {(isErasing || (question.status === 'REVISING' && !agentStream.fullResponse)) ? (
                <div className="flex items-center gap-2">
                  {/* Ícone minimalista com brilho */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gold/20 blur-md rounded-full" />
                    <motion.div
                      animate={{ rotate: [0, 180, 360] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="relative w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 border border-gold/40 flex items-center justify-center"
                    >
                      <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gold" />
                    </motion.div>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gold">
                    ML Agent está revisando
                  </span>
                  {/* 3 pontinhos animados */}
                  <div className="flex items-center gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: i * 0.2
                        }}
                        className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-gold rounded-full"
                      />
                    ))}
                  </div>
                </div>
              )

              /* 🔥 ESTADO 2: PENSANDO - Durante processamento inicial sem resposta */
              : (question.status === 'PROCESSING' || question.status === 'REVIEWING' || isReprocessing) && !agentStream.fullResponse && !question.aiSuggestion ? (
                <div className="flex items-center gap-2">
                  {/* Ícone minimalista com brilho */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gold/20 blur-md rounded-full" />
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 border border-gold/40 flex items-center justify-center"
                    >
                      <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gold" />
                    </motion.div>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gold">
                    ML Agent está pensando
                  </span>
                  {/* 3 pontinhos animados */}
                  <div className="flex items-center gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: i * 0.2
                        }}
                        className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-gold rounded-full"
                      />
                    ))}
                  </div>
                </div>
              )

              /* 🔥 ESTADO 3: RESPOSTA SUGERIDA - Quando tem texto sendo exibido ou salvo */
              : (agentStream.fullResponse || question.aiSuggestion) ? (
                <div className="flex items-center gap-2">
                  {/* Ícone estático elegante */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gold/15 blur-sm rounded-md" />
                    <div className="relative p-1 sm:p-1.5 rounded-md bg-gradient-to-br from-gold/20 to-gold/10 border border-gold/30">
                      <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gold" />
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gold">
                    Resposta sugerida
                  </span>
                </div>
              ) : null}
            </div>

            {/* 🤖 Erro do Agente (Limpo e Informativo) */}
            {agentStream.error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-gradient-to-br from-red-950/20 to-red-900/10 border border-red-500/30"
              >
                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-lg bg-red-500/20 border border-red-500/30">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-400 mb-1">Erro ao Gerar Resposta</p>
                    <p className="text-xs text-red-300/80">{agentStream.error}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 🎯 MODO: Edição manual */}
            {isEditing ? (
              <div className="space-y-3">
                <div className="relative">
                  <Textarea
                    value={editedResponse}
                    onChange={(e) => setEditedResponse(e.target.value)}
                    className="min-h-[140px] lg:min-h-[160px] bg-black/40 border-white/[0.08] text-gray-100 text-sm lg:text-base focus:border-gold/40 focus:ring-2 focus:ring-gold/20 rounded-xl placeholder:text-gray-600 resize-none"
                    placeholder="Edite sua resposta aqui..."
                  />
                  {/* Character count */}
                  <div className="absolute bottom-2 right-2 text-[10px] text-gray-600 font-mono">
                    {editedResponse.length}/2000 caracteres
                  </div>
                </div>

                {/* Action buttons - Premium */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={isProcessing || !editedResponse.trim()}
                    className="flex-1 bg-gradient-to-br from-gold to-gold-light hover:shadow-xl hover:shadow-gold/40 text-black font-bold text-sm rounded-xl transition-all active:scale-95"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                        <span>Salvar</span>
                      </div>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      setEditedResponse(question.aiSuggestion || '')
                    }}
                    className="border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.05] hover:border-white/20 rounded-xl transition-all"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : null}

            {/* 🎯 RENDERIZAÇÃO UNIFICADA DE RESPOSTA - SIMPLIFICADA
                =========================================
                Container único com 4 estados mutuamente exclusivos:
                1. ERASING: Texto sendo apagado letra por letra
                2. AGUARDANDO: Skeleton loader (sem tokens ainda)
                3. STREAMING: Tokens aparecendo com efeito typewriter
                4. COMPLETA: Resposta final (do banco ou recém gerada)
            */}
            {(agentStream.isStreaming || agentStream.fullResponse || question.aiSuggestion || question.status === 'PROCESSING' || question.status === 'REVISING' || isReprocessing || isErasing) && !isEditing && (
              <div className="relative min-h-[80px] transition-all duration-500 ease-out">
                <AnimatePresence mode="wait">
                  {/* 🔥 ESTADO 1: ERASING - Apagando resposta anterior */}
                  {isErasing && erasingText ? (
                    <motion.div
                      key="erasing"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="relative p-3 sm:p-4 lg:p-5 rounded-xl lg:rounded-2xl bg-gradient-to-br from-gray-900/30 via-black/30 to-gray-900/30 backdrop-blur-xl border border-gold/20 overflow-hidden"
                    >
                      <p className="text-sm sm:text-base leading-relaxed text-gray-300 whitespace-pre-wrap opacity-60">
                        {erasingText}
                        <motion.span
                          className="inline-block w-0.5 h-[1em] ml-0.5 bg-gold/70 rounded-full align-middle"
                          animate={{ opacity: [1, 0.2, 1] }}
                          transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </p>
                    </motion.div>
                  )

                  /* 🔥 ESTADO 2: AGUARDANDO - Skeleton loader (sem tokens, processando/revisando) */
                  : ((isErasing && !erasingText) ||
                     ((question.status === 'PROCESSING' || question.status === 'REVISING' || question.status === 'REVIEWING' || isReprocessing) &&
                      !agentStream.fullResponse && !agentStream.isStreaming)) ? (
                    <motion.div
                      key="waiting"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-gradient-to-br from-gray-900/30 via-black/30 to-gray-900/30 backdrop-blur-xl border border-white/[0.06] p-3 sm:p-4 lg:p-5 rounded-xl lg:rounded-2xl overflow-hidden"
                    >
                      <StreamingResponse
                        isStreaming={false}
                        fullResponse=""
                        isDone={false}
                        error={null}
                        isErasing={isErasing}
                      />
                    </motion.div>
                  )

                  /* 🔥 ESTADO 3: STREAMING - Tokens aparecendo com typewriter effect */
                  : (agentStream.isStreaming || agentStream.fullResponse) ? (
                    <motion.div
                      key="streaming"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-gradient-to-br from-gray-900/30 via-black/30 to-gray-900/30 backdrop-blur-xl border border-white/[0.06] p-3 sm:p-4 lg:p-5 rounded-xl lg:rounded-2xl overflow-hidden"
                    >
                      <StreamingResponse
                        isStreaming={agentStream.isStreaming}
                        fullResponse={agentStream.fullResponse}
                        isDone={agentStream.isDone}
                        error={agentStream.error}
                      />
                    </motion.div>
                  )

                  /* 🔥 ESTADO 4: RESPOSTA SALVA - Texto do banco de dados */
                  : question.aiSuggestion ? (
                    <motion.div
                      key="saved"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-gradient-to-br from-gray-900/30 via-black/30 to-gray-900/30 backdrop-blur-xl border border-white/[0.06] p-3 sm:p-4 lg:p-5 rounded-xl lg:rounded-2xl overflow-hidden"
                    >
                      <div ref={responseRef} className="whitespace-pre-wrap text-sm sm:text-base text-gray-100 leading-relaxed">
                        {question.aiSuggestion}
                      </div>
                    </motion.div>
                  )

                  : null}
                </AnimatePresence>
              </div>
            )}

            {/* ✨ INLINE: UI de Revisão Premium - Mobile First */}
            <AnimatePresence>
              {isRevising && !isEditing && !isErasing && !agentStream.isStreaming && (question.aiSuggestion || agentStream.fullResponse) && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="p-3 xs:p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl bg-black/40 backdrop-blur-2xl border border-gold/20 shadow-lg shadow-gold/10 space-y-3 sm:space-y-4 will-change-[height,opacity]">
                    {/* Header Premium - Mobile First */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
                        <motion.div
                          animate={{
                            rotate: [0, 10, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className="p-1.5 rounded-lg sm:rounded-xl bg-gold/20 border border-gold/30 flex-shrink-0"
                        >
                          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold" />
                        </motion.div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm md:text-base font-bold text-gold truncate">Revisar com ML Agent</h4>
                          <p className="text-[10px] sm:text-xs text-gray-400 truncate">Agente irá melhorar sua resposta</p>
                        </div>
                      </div>
                      {/* Touch-friendly close button - 44px+ */}
                      <button
                        onClick={() => {
                          setIsRevising(false)
                          setRevisionFeedback('')
                          setRevisionError(null)
                          agentStream.resetStream()
                        }}
                        disabled={isProcessing || agentStream.isStreaming}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 rounded-full transition-all active:scale-95 disabled:opacity-50 touch-manipulation flex-shrink-0"
                        aria-label="Fechar revisão"
                      >
                        <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 hover:text-white transition-colors" />
                      </button>
                    </div>

                    {/* Feedback Input - Premium */}
                    {!agentStream.isStreaming && !agentStream.isDone && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2 sm:space-y-2.5"
                      >
                        <Textarea
                          value={revisionFeedback}
                          onChange={(e) => {
                            setRevisionFeedback(e.target.value)
                            setRevisionError(null)
                          }}
                          placeholder="Ex: Deixar mais formal, adicionar informação sobre garantia, tornar mais conciso..."
                          className="min-h-[100px] xs:min-h-[110px] sm:min-h-[120px] bg-black/60 border-white/[0.08] text-white text-sm xs:text-base sm:text-base placeholder:text-gray-500 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 rounded-xl sm:rounded-2xl resize-none transition-colors touch-manipulation"
                          disabled={isProcessing}
                          maxLength={500}
                          autoFocus
                          rows={4}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] sm:text-xs text-gray-500">
                            {revisionFeedback.length}/500
                          </span>
                          {revisionError && (
                            <motion.div
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-1 text-red-400"
                            >
                              <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span className="text-[10px] sm:text-xs font-medium">{revisionError}</span>
                            </motion.div>
                          )}
                        </div>

                        {/* Botão Enviar Revisão - Premium Touch-Friendly */}
                        <Button
                          onClick={handleRevise}
                          disabled={isProcessing || !revisionFeedback.trim() || revisionFeedback.trim().length < 10}
                          className="w-full min-h-[48px] bg-gradient-to-r from-gold via-gold-light to-gold text-black font-bold shadow-lg shadow-gold/30 hover:shadow-xl hover:shadow-gold/40 rounded-xl sm:rounded-2xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm xs:text-base sm:text-base touch-manipulation transition-all duration-200"
                          aria-label="Enviar feedback de revisão para IA"
                        >
                          {isProcessing ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                              <span>Iniciando...</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                              <span>Revisar com IA</span>
                            </div>
                          )}
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
        )}

        {/* ✅ Success Confirmation - Shows when successfully sent to ML - MINIMALISTA */}
        {question.status === 'RESPONDED' && question.sentToMLAt && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <div className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-lg bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/30 backdrop-blur-sm">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="p-1 rounded bg-emerald-500/20 border border-emerald-500/30 flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-emerald-400 truncate">
                    Resposta Publicada no ML
                  </span>
                  <span className="text-[10px] sm:text-xs text-emerald-300/60 font-medium whitespace-nowrap">
                    {new Date(question.sentToMLAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 🎯 Feedback de Aprovação Enterprise */}
        {approvalFeedback && (
          <div className="mt-4">
            {approvalFeedback.type === 'loading' ? (
              <LoadingState
                isVisible={true}
                message={approvalFeedback.message}
                subMessage={approvalFeedback.details}
              />
            ) : (
              <ErrorFeedback
                isVisible={true}
                title={approvalFeedback.message}
                description={approvalFeedback.details || ''}
                errorCode={approvalFeedback.errorCode}
                isRateLimit={approvalFeedback.isRateLimit}
                canRetry={approvalFeedback.canRetry}
                onRetry={approvalFeedback.canRetry ? handleRetry : undefined}
                onDismiss={() => setApprovalFeedback(null)}
              />
            )}
          </div>
        )}

        {/* Error Message with Enhanced Visual */}
        {(question.status === 'FAILED' || question.status === 'ERROR' || question.status === 'TOKEN_ERROR' || question.status === 'TIMEOUT') && (
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-red-600/10 border border-red-500/30">
            <div className="flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-400 mb-1">
                  {question.answer || question.aiSuggestion ? 'Erro ao Enviar ao Mercado Livre' : 'Erro no Processamento'}
                </p>
                <p className="text-sm text-red-300/80">
                  {(() => {
                    // Mensagens específicas por tipo de erro
                    if (question.failureReason?.includes('Error in workflow')) {
                      return '🤖 Erro no processamento da IA. Clique em "Tentar Novamente" para reprocessar.'
                    }
                    if (question.failureReason?.includes('N8N error: 500')) {
                      return '🔧 Erro interno no serviço de IA. Aguarde alguns instantes e tente novamente.'
                    }
                    if (question.failureReason?.includes('Timeout') || question.status === 'TIMEOUT') {
                      return '⏱️ O processamento excedeu o tempo limite. Clique em "Tentar Novamente".'
                    }
                    if (question.failureReason?.includes('Token')) {
                      return '🔑 Erro de autenticação. Faça login novamente na conta do Mercado Livre.'
                    }
                    if (question.failureReason?.includes('Rate limit')) {
                      return '⚠️ Limite de requisições atingido. Aguarde 1 minuto e tente novamente.'
                    }
                    // Mensagem padrão
                    return question.failureReason ||
                           (question.answer || question.aiSuggestion
                             ? 'Erro ao enviar resposta ao Mercado Livre. Tente aprovar novamente.'
                             : 'Erro ao processar a pergunta. Clique em "Tentar Novamente".')
                  })()}
                </p>
                {/* Data e hora do erro para debug */}
                {question.failedAt && (
                  <p className="text-xs text-red-300/40 mt-2">
                    Erro ocorrido em: {new Date(question.failedAt).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons Section e Revision Input */}
        {!isEditing && (
          <>
            {/* Botões de ação - Premium Mobile First */}
            {question.status !== 'REVISING' && question.status !== 'REVIEWING' && !agentStream.isStreaming && !isErasing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="space-y-2 pt-3 sm:pt-4 border-t border-white/[0.06]"
              >
                {/* 🔴 FIX: Mostrar botões SOMENTE quando TEM resposta E streaming completo E NÃO está revisando/apagando */}
                {((question.status === 'AWAITING_APPROVAL' && question.aiSuggestion) ||
                  (question.status === 'PROCESSING' && question.aiSuggestion) ||
                  (question.status === 'PENDING' && question.aiSuggestion) ||
                  (question.status === 'RECEIVED' && question.aiSuggestion) ||
                  (agentStream.isDone && agentStream.fullResponse)) &&
                  !isRevising &&
                  !isErasing &&
                  question.status !== 'REVISING' && (
                  <>
                    {/* Container dos botões - Desktop/Tablet: mesma linha | Mobile: stacked */}
                    <div className="space-y-2">
                      {/* Linha principal de ações */}
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        {/* 3 botões principais - Mobile: grid | Desktop: flex */}
                        <div className="grid grid-cols-3 md:flex md:flex-wrap gap-1.5 md:gap-2">
                          <Button
                            size="sm"
                            onClick={handleApprove}
                            disabled={isProcessing}
                            className="flex items-center justify-center bg-gradient-to-br from-gold to-gold-light hover:shadow-xl hover:shadow-gold/40 text-black font-bold text-[10px] md:text-sm px-1.5 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl transition-all active:scale-95 border-none gap-1 md:gap-1.5"
                          >
                            <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" strokeWidth={2.5} />
                            <span className="leading-tight truncate">Aprovar</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsEditing(true)
                              setEditedResponse(question.aiSuggestion || '')
                            }}
                            disabled={isProcessing}
                            className="flex items-center justify-center border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.05] hover:border-gold/30 text-[10px] md:text-sm px-1.5 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl transition-all active:scale-95 gap-1 md:gap-1.5"
                          >
                            <Edit2 className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" strokeWidth={2.5} />
                            <span className="leading-tight truncate">Editar</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // 🔴 FIX: Resetar stream anterior ANTES de abrir formulário
                              agentStream.resetStream()
                              setIsRevising(true)
                              setRevisionFeedback('')
                              setRevisionError(null)
                            }}
                            disabled={isProcessing}
                            className="flex items-center justify-center border-white/[0.08] text-gray-400 hover:text-gold hover:bg-gold/10 hover:border-gold/30 text-[10px] md:text-sm px-1.5 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl transition-all active:scale-95 gap-1 md:gap-1.5"
                          >
                            <Sparkles className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" strokeWidth={2.5} />
                            <span className="leading-tight truncate">Revisar</span>
                          </Button>
                        </div>

                        {/* Ver no Mercado Livre - Desktop/Tablet: direita na mesma linha | Mobile: abaixo */}
                        {question.itemPermalink && (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="w-full md:w-auto border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.05] hover:border-white/20 text-xs md:text-sm px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl transition-all whitespace-nowrap"
                          >
                            <a href={question.itemPermalink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                              <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={2} />
                              <span>Ver no Mercado Livre</span>
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}

          {/* 🎯 NOVO: Botão de reprocessar para perguntas travadas (sem dados após 5min) */}
          {isStuckQuestion && !question.aiSuggestion && (
            <div className="w-full space-y-3">
              {/* Alerta visual de pergunta travada */}
              <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-400 mb-1">
                      Pergunta Aguardando Processamento
                    </p>
                    <p className="text-xs text-amber-300/80">
                      Esta pergunta está há mais de 5 minutos aguardando dados. Clique no botão abaixo para reprocessar.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botão de reprocessar */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  size="sm"
                  onClick={handleReprocess}
                  disabled={isProcessing || isReprocessing}
                  className="
                    w-full relative overflow-hidden group
                    bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600
                    hover:from-amber-500 hover:via-orange-500 hover:to-amber-500
                    border border-amber-500/30 hover:border-amber-400/50
                    text-white font-semibold
                    shadow-xl shadow-amber-950/50
                    transition-all duration-500
                    backdrop-blur-sm
                    h-10
                  "
                  title="Reprocessar pergunta para buscar dados do ML"
                >
                  {/* Glow effect on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 via-orange-400/20 to-amber-400/20 blur-xl" />
                  </div>

                  {/* Premium animated background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

                  {/* Content */}
                  <div className="relative flex items-center justify-center gap-2">
                    {(isProcessing || isReprocessing) ? (
                      <>
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm font-semibold">Reprocessando...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                        <span className="text-sm font-semibold">
                          Reprocessar Pergunta
                        </span>
                      </>
                    )}
                  </div>
                </Button>
              </motion.div>
            </div>
          )}

          {/* Botão de Retry para perguntas com erro */}
          {(question.status === 'FAILED' || question.status === 'TOKEN_ERROR' || question.status === 'ERROR' || question.status === 'TIMEOUT') && !isStuckQuestion && (
            <>
              {/* Se não tem resposta da IA: botão de reprocessar (primeiro processamento) */}
              {!question.aiSuggestion && (
                <div className="flex gap-2 w-full">
                  <motion.div
                    className="flex-1"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      size="sm"
                      onClick={handleReprocess}
                      disabled={isProcessing || isReprocessing}
                      className="
                        w-full relative overflow-hidden group
                        bg-gradient-to-r from-red-950 via-red-900 to-red-950
                        hover:from-red-900 hover:via-red-800 hover:to-red-900
                        border border-red-500/20 hover:border-red-400/40
                        text-white font-medium
                        shadow-xl shadow-red-950/50
                        transition-all duration-500
                        backdrop-blur-sm
                        h-10
                      "
                      title="Reenviar pergunta para processamento com IA"
                    >
                      {/* Glow effect on hover */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-red-400/10 to-red-500/10 blur-xl" />
                      </div>

                      {/* Premium animated background */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

                      {/* Content */}
                      <div className="relative flex items-center justify-center gap-2">
                        {(isProcessing || isReprocessing) ? (
                          <>
                            <div className="flex gap-1">
                              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-sm text-red-300 font-semibold">Reprocessando com IA</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 text-red-400 group-hover:rotate-180 transition-transform duration-500" />
                            <span className="text-sm font-semibold bg-gradient-to-r from-red-300 to-red-400 bg-clip-text text-transparent">
                              Tentar Novamente
                            </span>
                          </>
                        )}
                      </div>
                    </Button>
                  </motion.div>
                </div>
              )}

              {/* Se tem resposta mas falhou ao enviar: mostrar botões de ação */}
              {(question.aiSuggestion || question.answer) && (
                <>
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="w-full sm:w-auto text-xs sm:text-sm bg-gradient-to-r from-gold via-gold-light to-gold hover:from-gold-dark hover:via-gold hover:to-gold-dark text-black font-bold shadow-lg shadow-gold/20 transition-all duration-300 py-2 sm:py-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                    Tentar Enviar Novamente
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsRevising(true)
                      setRevisionFeedback('')
                      setRevisionError(null)
                    }}
                    disabled={isProcessing}
                    className="w-full sm:w-auto text-xs sm:text-sm border-white/[0.08] text-gray-400 hover:text-gold hover:bg-gold/10 hover:border-gold/30 transition-all duration-300 py-2 sm:py-1.5 rounded-lg active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" strokeWidth={2.5} />
                    Revisar
                  </Button>
                </>
              )}
            </>
          )}

              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Premium Hover Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent group-hover:from-gold/5 group-hover:to-transparent transition-all duration-500 pointer-events-none opacity-30" />

      {/* 🎯 NOVO: Animação Premium Enterprise de Aprovação - Inline com Logo 3D */}
      <ApprovalAnimation
        state={approvalAnimationState}
        message={approvalAnimationMessage}
        details={approvalAnimationDetails}
        onComplete={() => {
          setApprovalAnimationState(null)
        }}
        onRetry={handleApprove}
        showRetry={approvalAnimationState === 'error'}
      />
    </Card>
  )
}