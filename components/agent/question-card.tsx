'use client'

import { useState, useEffect, useRef } from 'react'
import { Question, MLAccount } from '@prisma/client'
import Image from 'next/image'
import { motion } from 'framer-motion'
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
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { logger } from '@/lib/logger'
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
  onApprove?: (answer: string) => Promise<void>
  onRevise?: (feedback: string) => Promise<void>
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

export function QuestionCard({ question, onApprove, onRevise, onEdit }: QuestionCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedResponse, setEditedResponse] = useState(question.aiSuggestion || question.answer || '')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isReprocessing, setIsReprocessing] = useState(false) // Estado específico para reprocessamento
  const [showRevisionInput, setShowRevisionInput] = useState(false)
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [revisionError, setRevisionError] = useState<string | null>(null) // Estado para erro de revisão
  const [showRevisionError, setShowRevisionError] = useState(false) // Controle de visibilidade do erro
  // 🎯 NOVO: Estados para erro de aprovação/envio ao ML
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [showApprovalError, setShowApprovalError] = useState(false)
  const [canRetryNow, setCanRetryNow] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // 🎯 NOVO: Detectar perguntas travadas (sem dados após 5 minutos)
  const [isStuckQuestion, setIsStuckQuestion] = useState(false)

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

  // Listen for revision error events
  useEffect(() => {
    const handleRevisionError = (event: CustomEvent) => {
      const { questionId, failureReason } = event.detail

      // Check if this error is for current question
      if (question.mlQuestionId === questionId || question.id === questionId) {
        setRevisionError(failureReason || 'Erro ao revisar resposta com IA')
        setShowRevisionError(true)
        setIsProcessing(false)
        setShowRevisionInput(false) // Fechar input de revisão ao receber erro
        setRevisionFeedback('') // Limpar feedback

        // 🔊 Feedback sensorial de erro
        playNotificationSound('error')
        triggerHapticFeedback('error')

        // Hide revision error after 10 seconds
        setTimeout(() => {
          setShowRevisionError(false)
        }, 10000)

        // Update local state to reflect AWAITING_APPROVAL
        question.status = 'AWAITING_APPROVAL'
      }
    }

    window.addEventListener('websocket:question:revision-error' as any, handleRevisionError)

    return () => {
      window.removeEventListener('websocket:question:revision-error' as any, handleRevisionError)
    }
  }, [question.mlQuestionId, question.id, question])

  // 🎯 NOVO: Listen for approval/sending errors (erro ao enviar para ML)
  useEffect(() => {
    const handleQuestionError = (event: CustomEvent) => {
      const { questionId, failureReason, errorType, canRetryNow, isRateLimit } = event.detail

      // Check if this error is for current question
      if (question.mlQuestionId === questionId || question.id === questionId) {
        logger.info('[Question Card] ⚠️ Error received via WebSocket', {
          questionId,
          errorType,
          failureReason,
          canRetryNow,
          isRateLimit
        })

        // Determinar mensagem de erro apropriada
        let errorMessage = failureReason || 'Erro ao enviar resposta ao Mercado Livre'

        if (isRateLimit) {
          errorMessage = '⏳ Rate limit do ML. Aguardando para reenviar automaticamente...'
        } else if (errorType === 'ML_API_ERROR') {
          errorMessage = '❌ ' + errorMessage + ' - Clique para tentar novamente'
        }

        setApprovalError(errorMessage)
        setShowApprovalError(true)
        setCanRetryNow(canRetryNow !== false && !isRateLimit) // Pode retry imediato se não for rate limit
        setIsProcessing(false)
        setIsRetrying(false)

        // 🔊 Feedback sensorial de erro
        playNotificationSound('error')
        triggerHapticFeedback(isRateLimit ? 'warning' : 'error')

        // Se é rate limit, ocultar erro após 15 segundos
        // Se é outro erro, manter visível até usuário clicar retry
        if (isRateLimit) {
          setTimeout(() => {
            setShowApprovalError(false)
          }, 15000)
        }

        // Update local state se necessário
        if (question.status === 'PROCESSING' || question.status === 'APPROVED') {
          question.status = isRateLimit ? 'APPROVED' : 'FAILED'
        }
      }
    }

    window.addEventListener('websocket:question:error' as any, handleQuestionError)

    return () => {
      window.removeEventListener('websocket:question:error' as any, handleQuestionError)
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
        setShowRevisionInput(false)
        setRevisionFeedback('')
        setIsProcessing(false)

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

          // Ocultar qualquer erro de aprovação que estava mostrando
          setShowApprovalError(false)
          setApprovalError(null)

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

  // Monitor status changes to close revision modal when revision completes
  const prevStatusRef = useRef(question.status)
  useEffect(() => {
    // Só fechar o modal se o status MUDOU de REVISING/REVIEWING para AWAITING_APPROVAL
    // Não fechar se já estava em AWAITING_APPROVAL (usuário acabou de abrir o modal)
    const prevStatus = prevStatusRef.current
    const currentStatus = question.status

    if (currentStatus === 'AWAITING_APPROVAL' &&
        (prevStatus === 'REVISING' || prevStatus === 'REVIEWING') &&
        showRevisionInput) {
      setShowRevisionInput(false)
      setRevisionFeedback('')
    }

    // Atualizar referência do status anterior
    prevStatusRef.current = currentStatus
  }, [question.status, showRevisionInput])

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
      // IMPORTANTE: Fechar modal de revisão quando voltar para AWAITING_APPROVAL
      setShowRevisionInput(false)
      setRevisionFeedback('')
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

  // Limpa o interval quando o componente é desmontado
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      // Reseta estados ao desmontar para evitar loops
      setIsReprocessing(false)
      setIsProcessing(false)
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
      // Processando no N8N
      case 'PROCESSING':
        return {
          gradient: 'from-blue-500/20 to-cyan-500/20',
          border: 'border-blue-500/30',
          text: 'text-blue-400',
          icon: RefreshCw,
          label: 'Processando',
          pulse: true,
          spin: true
        }
      // Revisando no N8N
      case 'REVIEWING':
      case 'REVISING': // Legado
        return {
          gradient: 'from-gold/20 to-gold-light/20',
          border: 'border-gold/30',
          text: 'text-gold',
          icon: Sparkles,
          label: 'ML Agent Revisando',
          pulse: true,
          spin: true
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

  // Handle approve
  const handleApprove = async () => {
    if (isProcessing) return // Previne cliques múltiplos
    setIsProcessing(true)
    setShowApprovalError(false) // Limpar erro anterior
    try {
      // Usar sempre a aiSuggestion que já foi salva no banco
      const responseToSend = question.aiSuggestion

      // Use prop callback if provided, otherwise make API call
      if (onApprove) {
        await onApprove(responseToSend || '')

        // Animação de sucesso movida para multi-account-questions.tsx para evitar duplicação

        console.log('✅ Resposta Enviada ao Mercado Livre')
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
          // Animação de sucesso movida para multi-account-questions.tsx para evitar duplicação

          // 🔊 Feedback sensorial de sucesso
          playNotificationSound('success')
          triggerHapticFeedback('success')

          console.log('✅ Resposta Enviada ao Mercado Livre')
        } else {
          const error = await response.json()
          const errorMsg = error.error || 'Erro ao enviar resposta'

          // 🔊 Feedback sensorial de erro
          playNotificationSound('error')
          triggerHapticFeedback('error')

          // Mostrar erro na UI
          setApprovalError(errorMsg)
          setShowApprovalError(true)
          setCanRetryNow(!error.isRateLimit)

          console.error('❌ Erro ao aprovar:', errorMsg)
        }
      }
    } catch (_error) {
      // 🔊 Feedback sensorial de erro de network
      playNotificationSound('error')
      triggerHapticFeedback('error')

      // Mostrar erro de conexão na UI
      setApprovalError('❌ Erro de conexão. Verifique sua internet e tente novamente.')
      setShowApprovalError(true)
      setCanRetryNow(true)

      console.error('❌ Erro ao processar aprovação')
    } finally {
      setIsProcessing(false)
    }
  }

  // 🎯 NOVO: Handle retry after error
  const handleRetry = async () => {
    if (isRetrying || isProcessing) return
    setIsRetrying(true)
    setShowApprovalError(false)
    setApprovalError(null)

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

        console.log('✅ Retry enviado com sucesso')
        // WebSocket vai atualizar o status em tempo real
      } else {
        // 🔊 Feedback sensorial de erro
        playNotificationSound('error')
        triggerHapticFeedback('error')

        setApprovalError(result.error || 'Erro ao tentar novamente')
        setShowApprovalError(true)

        console.error('❌ Erro no retry:', result.error)
      }
    } catch (_error) {
      // 🔊 Feedback sensorial de erro de network
      playNotificationSound('error')
      triggerHapticFeedback('error')

      setApprovalError('Erro de conexão. Tente novamente.')
      setShowApprovalError(true)

      console.error('❌ Erro ao processar retry')
    } finally {
      setIsRetrying(false)
    }
  }

  // Handle manual edit save (salva APENAS no banco de dados, NÃO envia ao ML)
  const handleSaveEdit = async () => {
    if (isProcessing) return // Previne cliques múltiplos
    if (!editedResponse.trim()) {
      // 🔊 Feedback sensorial de validação
      triggerHapticFeedback('warning')

      setApprovalError('⚠️ A resposta não pode estar vazia')
      setShowApprovalError(true)
      setTimeout(() => setShowApprovalError(false), 3000)

      console.warn('⚠️ Campo vazio: A resposta não pode estar vazia')
      return
    }

    // Validar tamanho da resposta (limite ML: 2000 caracteres)
    if (editedResponse.length > 2000) {
      // 🔊 Feedback sensorial de validação
      triggerHapticFeedback('warning')

      setApprovalError(`⚠️ Resposta muito longa: ${editedResponse.length}/2000 caracteres`)
      setShowApprovalError(true)
      setTimeout(() => setShowApprovalError(false), 3000)

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
        setIsEditing(false)
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

          // Fecha o modo de edição
          setIsEditing(false)

          // 🔊 Feedback sensorial de sucesso
          playNotificationSound('success')
          triggerHapticFeedback('success')

          console.log('✅ Resposta Salva com Sucesso no banco de dados')

          // A atualização em tempo real será feita via WebSocket automaticamente
          // pelo evento emitido no backend
        } else {
          const errorData = await response.json()

          // 🔊 Feedback sensorial de erro
          playNotificationSound('error')
          triggerHapticFeedback('error')

          // Mostrar erro na UI
          setApprovalError(errorData.error || 'Não foi possível salvar a edição')
          setShowApprovalError(true)

          console.error('❌ Erro ao salvar:', errorData.error || 'Não foi possível salvar a edição')
        }
      }
    } catch (_error) {
      // 🔊 Feedback sensorial de erro de network
      playNotificationSound('error')
      triggerHapticFeedback('error')

      // Mostrar erro de conexão na UI
      setApprovalError('❌ Erro de conexão ao salvar edição.')
      setShowApprovalError(true)

      console.error('❌ Erro ao salvar edição')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle revision request
  const handleRevise = async (feedback?: string) => {
    const feedbackToUse = feedback || revisionFeedback
    if (!feedbackToUse.trim()) {
      // 🔊 Feedback sensorial de validação
      triggerHapticFeedback('warning')

      setRevisionError('⚠️ Por favor, descreva como gostaria de melhorar a resposta')
      setShowRevisionError(true)
      setTimeout(() => setShowRevisionError(false), 3000)

      console.warn('⚠️ Feedback necessário para revisão da IA')
      return
    }

    setIsProcessing(true)
    try {
      // Use prop callback if provided, otherwise make API call
      if (onRevise) {
        await onRevise(feedbackToUse)
        console.log('🤖 Revisão Solicitada - A IA está revisando a resposta')
        setShowRevisionInput(false)
        setRevisionFeedback('')
      } else {
        const response = await fetch('/api/agent/revise-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: question.id,
            feedback: feedbackToUse
          })
        })

        if (response.ok) {
          // 🔊 Feedback sensorial leve (é só solicitação, não resultado final)
          triggerHapticFeedback('success')

          console.log('🤖 Revisão Solicitada - A IA está revisando a resposta')
          setShowRevisionInput(false)
          setRevisionFeedback('')
        } else {
          const errorData = await response.json()

          // 🔊 Feedback sensorial de erro
          playNotificationSound('error')
          triggerHapticFeedback('error')

          // Mostrar erro na UI
          setRevisionError(errorData.error || 'Erro ao solicitar revisão')
          setShowRevisionError(true)

          console.error('❌ Erro ao solicitar revisão:', errorData.error)
        }
      }
    } catch (_error) {
      // 🔊 Feedback sensorial de erro de network
      playNotificationSound('error')
      triggerHapticFeedback('error')

      // Mostrar erro na UI
      setRevisionError('❌ Erro de conexão ao solicitar revisão.')
      setShowRevisionError(true)

      console.error('❌ Erro ao processar revisão')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle AI revision - simplified wrapper
  const handleRevision = async () => {
    await handleRevise(revisionFeedback)
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

        // Mostrar erro na UI
        setApprovalError(errorMessage)
        setShowApprovalError(true)

        console.error('❌ Erro ao Reprocessar:', errorMessage)
        setIsReprocessing(false)
      }
    } catch (_error) {
      // 🔊 Feedback sensorial de erro de network
      playNotificationSound('error')
      triggerHapticFeedback('error')

      // Mostrar erro na UI
      setApprovalError('❌ Erro de conexão: Não foi possível conectar ao servidor')
      setShowApprovalError(true)

      console.error('Erro ao reprocessar:', _error)
      console.error('❌ Erro de Conexão: Não foi possível conectar ao servidor')
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
                    src="/mlagent-logo-3d.svg"
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
                      src={question.mlAccount.thumbnail || '/mlagent-logo-3d.svg'}
                      alt={question.mlAccount.nickname}
                      className="relative w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full border border-gold/40 ring-1 ring-gold/20 object-cover shadow-lg shadow-gold/10"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = '/mlagent-logo-3d.svg'
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
                    src={question.itemThumbnail || '/mlagent-logo-3d.svg'}
                    alt={question.itemTitle || 'Produto'}
                    className="relative w-8 h-8 sm:w-10 sm:h-10 rounded object-cover border border-gold/30 ring-1 ring-gold/20 shadow-md"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = '/mlagent-logo-3d.svg'
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

        {/* AI Response Section - Sempre visível quando houver sugestão, processando ou reprocessando */}
        {(question.aiSuggestion || question.status === 'AWAITING_APPROVAL' || question.status === 'PROCESSING' || question.status === 'REVISING' || isReprocessing) && (
          <div className="mt-4 relative">
            {/* Premium Revising Animation Overlay */}
            {(question.status === 'REVISING' || question.status === 'REVIEWING') && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 rounded-xl overflow-hidden"
              >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl" />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  {/* Icon with glow effect - Dourado */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-gold/40 to-gold-light/40 rounded-full blur-xl scale-150 animate-pulse" />
                    <div className="relative bg-gradient-to-br from-black/80 to-gray-900/80 rounded-full p-4 border border-gold/30">
                      {/* ML Agent icon */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/mlagent-logo-3d.svg"
                        alt="ML Agent"
                        className="w-8 h-8"
                        style={{ filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.4))' }}
                      />
                    </div>
                  </div>

                  {/* Status Text */}
                  <div className="text-center space-y-2">
                    <h3 className="text-white font-medium tracking-wide text-sm">
                      ML Agent Aprimorando
                    </h3>

                    {/* Progress bar */}
                    <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-gold via-gold-light to-gold rounded-full"
                        animate={{
                          x: ['-100%', '100%']
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "linear"
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <p className="text-purple-300 text-xs">
                      Aplicando melhorias solicitadas...
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            <div className={`
              p-3 sm:p-4 rounded-lg sm:rounded-xl bg-black/30 border border-white/5
              ${(question.status === 'REVISING' || question.status === 'REVIEWING') ? 'opacity-30' : ''}
            `}>
              <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 flex-wrap">
                <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-gold/10 border border-gold/20 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/icone-amarelo.svg"
                    alt="ML Agent"
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                  />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gold">
                  {/* Se tem resposta, mostrar "Resposta Sugerida", independente do status */}
                  {question.aiSuggestion ? 'Resposta Sugerida pelo ML Agent' :
                   (question.status === 'PROCESSING') ? 'ML Agent processando...' :
                   (question.status === 'REVISING' || question.status === 'REVIEWING') ? 'ML Agent aprimorando...' :
                   isReprocessing ? 'ML Agent reprocessando...' :
                 'Resposta Sugerida pelo ML Agent'}
              </span>
              {/* Animação de loading clean com 3 pontos - SOMENTE se não houver resposta */}
              {!question.aiSuggestion && (question.status === 'PROCESSING' || question.status === 'REVISING' || isReprocessing) && (
                <div className="flex gap-1 ml-2">
                  <div className="w-2 h-2 bg-gold/60 rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-gold/60 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gold/60 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>

            {/* Loading state for PROCESSING, REVISING ou Reprocessing */}
            {((question.status === 'PROCESSING' || question.status === 'REVISING' || isReprocessing) && !question.aiSuggestion && !isEditing) && (
              <div className="relative overflow-hidden">
                <div className="text-gray-400 p-4 bg-white/[0.02] rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="h-3 bg-gray-700/50 rounded-full animate-pulse" style={{ width: '75%' }} />
                      <div className="h-3 bg-gray-700/50 rounded-full animate-pulse" style={{ width: '60%', animationDelay: '150ms' }} />
                      <div className="h-3 bg-gray-700/50 rounded-full animate-pulse" style={{ width: '80%', animationDelay: '300ms' }} />
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    {isReprocessing ? 'Reprocessando pergunta com IA...' :
                     (question.status === 'REVISING' || question.status === 'REVIEWING') ? 'Revisando resposta com IA...' :
                     'Analisando pergunta e contexto do produto...'}
                  </div>
                </div>
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]" />
              </div>
            )}

            {/* Regular content when not processing - Mobile Optimized */}
            {!question.aiSuggestion && !isEditing && question.status !== 'PROCESSING' && question.status !== 'REVISING' && !isReprocessing && (
              <div className="text-gray-400 italic p-2 sm:p-3 text-xs sm:text-sm bg-white/[0.02] rounded-lg border border-white/5">
                Aguardando processamento da IA...
              </div>
            )}

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
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvando...</span>
                      </div>
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
            ) : (
              <div className="space-y-2">
                {/* AI Response - Premium display */}
                <div className="text-sm lg:text-base text-gray-100 leading-relaxed bg-white/[0.03] border border-white/[0.06] p-3 lg:p-4 rounded-xl lg:rounded-2xl transition-all duration-300">
                  {question.aiSuggestion || 'Aguardando resposta da IA...'}
                </div>
              </div>
            )}
            </div>
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

        {/* Revision Error Alert - Shows temporarily when revision fails */}
        {showRevisionError && revisionError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-4 rounded-xl bg-gradient-to-br from-orange-500/15 to-red-500/15 border border-orange-500/30"
          >
            <div className="flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30">
                <AlertCircle className="w-5 h-5 text-orange-400 animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-400 mb-1">
                  Erro na Revisão com IA
                </p>
                <p className="text-sm text-orange-300/80 mb-2">
                  {revisionError}
                </p>
                <p className="text-xs text-orange-300/60">
                  A pergunta voltou para aguardando aprovação. Você pode tentar revisar novamente ou aprovar como está.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRevisionError(false)}
                  className="mt-2 border-orange-500/20 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/30"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Fechar
                </Button>
              </div>
            </div>
          </motion.div>
        )}


        {/* 🎯 NOVO: Erro de Aprovação em Tempo Real (via WebSocket) */}
        {showApprovalError && approvalError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30 flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-orange-400 mb-1">
                    Erro ao Enviar Resposta
                  </p>
                  <p className="text-sm text-orange-300/90">
                    {approvalError}
                  </p>
                  {/* Botão de retry se pode tentar agora */}
                  {canRetryNow && (
                    <Button
                      size="sm"
                      onClick={handleRetry}
                      disabled={isRetrying}
                      className="mt-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold text-xs"
                    >
                      {isRetrying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          Tentando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          Tentar Novamente
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <button
                  onClick={() => setShowApprovalError(false)}
                  className="p-1 rounded hover:bg-white/5 transition-colors flex-shrink-0"
                  title="Fechar"
                >
                  <XCircle className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
              </div>
            </div>
          </motion.div>
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
            {/* Revision Input - Premium */}
            {showRevisionInput && question.status !== 'REVISING' && question.status !== 'REVIEWING' && (
              <div className="mt-4 p-4 lg:p-5 rounded-xl lg:rounded-2xl bg-gradient-to-br from-purple-500/8 to-violet-500/5 border border-purple-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-purple-400" strokeWidth={2.5} />
                  </div>
                  <span className="text-sm lg:text-base font-semibold text-purple-300">
                    Como posso melhorar?
                  </span>
                </div>

                <div className="relative">
                  <Textarea
                    value={revisionFeedback}
                    onChange={(e) => setRevisionFeedback(e.target.value)}
                    className="w-full min-h-[100px] lg:min-h-[120px] bg-black/40 border-purple-500/20 text-gray-100 text-sm lg:text-base focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 rounded-xl placeholder:text-gray-600 resize-none"
                    placeholder="Ex: 'Adicione informações técnicas', 'Seja mais cordial', 'Inclua prazos'..."
                  />
                  {/* Character hint */}
                  <div className="absolute bottom-2 right-2 text-[10px] text-gray-600 font-mono">
                    {revisionFeedback.length} caracteres
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleRevision}
                    disabled={isProcessing || !revisionFeedback.trim()}
                    className="flex-1 bg-gradient-to-br from-purple-500 to-violet-600 hover:shadow-xl hover:shadow-purple-500/40 text-white font-bold text-sm rounded-xl transition-all active:scale-95"
                  >
                    {isProcessing ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processando...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" strokeWidth={2.5} />
                        <span>Revisar</span>
                      </div>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowRevisionInput(false)
                      setRevisionFeedback('')
                    }}
                    className="border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.05] hover:border-white/20 rounded-xl transition-all"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Botões de ação - Premium Mobile First */}
            {!showRevisionInput && question.status !== 'REVISING' && question.status !== 'REVIEWING' && (
              <div className="space-y-2 pt-3 sm:pt-4 border-t border-white/[0.06]">
                {/* 🔴 FIX: Mostrar botões se TEM resposta E não foi enviada ao ML ainda */}
                {((question.status === 'AWAITING_APPROVAL' && question.aiSuggestion) ||
                  (question.status === 'PROCESSING' && question.aiSuggestion) ||
                  (question.status === 'PENDING' && question.aiSuggestion) ||
                  (question.status === 'RECEIVED' && question.aiSuggestion)) && (
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
                            onClick={() => setShowRevisionInput(true)}
                            disabled={isProcessing}
                            className="flex items-center justify-center border-white/[0.08] text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/30 text-[10px] md:text-sm px-1.5 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl transition-all active:scale-95 gap-1 md:gap-1.5"
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
                    onClick={() => setShowRevisionInput(!showRevisionInput)}
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

              </div>
            )}
          </>
        )}
      </div>

      {/* Premium Hover Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent group-hover:from-gold/5 group-hover:to-transparent transition-all duration-500 pointer-events-none opacity-30" />
    </Card>
  )
}