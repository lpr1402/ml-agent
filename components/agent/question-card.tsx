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
  Package,
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

        // Removido toast - apenas notificações do dispositivo
        console.log('[Question] Revision completed successfully')
      }
    }

    window.addEventListener('websocket:question:answer-edited' as any, handleAnswerEdited)
    window.addEventListener('websocket:question:revision-success' as any, handleRevisionSuccess)

    return () => {
      window.removeEventListener('websocket:question:answer-edited' as any, handleAnswerEdited)
      window.removeEventListener('websocket:question:revision-success' as any, handleRevisionSuccess)
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
          gradient: 'from-purple-500/20 to-violet-500/20',
          border: 'border-purple-500/30',
          text: 'text-purple-400',
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

          console.log('✅ Resposta Enviada ao Mercado Livre')
        } else {
          const error = await response.json()
          console.error('❌ Erro ao aprovar:', error.error || 'Erro ao enviar resposta')
        }
      }
    } catch (_error) {
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
        console.log('✅ Retry enviado com sucesso')
        // WebSocket vai atualizar o status em tempo real
      } else {
        console.error('❌ Erro no retry:', result.error)
        setApprovalError(result.error || 'Erro ao tentar novamente')
        setShowApprovalError(true)
      }
    } catch (_error) {
      console.error('❌ Erro ao processar retry')
      setApprovalError('Erro de conexão. Tente novamente.')
      setShowApprovalError(true)
    } finally {
      setIsRetrying(false)
    }
  }

  // Handle manual edit save (salva APENAS no banco de dados, NÃO envia ao ML)
  const handleSaveEdit = async () => {
    if (isProcessing) return // Previne cliques múltiplos
    if (!editedResponse.trim()) {
      console.warn('⚠️ Campo vazio: A resposta não pode estar vazia')
      return
    }

    // Validar tamanho da resposta (limite ML: 2000 caracteres)
    if (editedResponse.length > 2000) {
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

          console.log('✅ Resposta Salva com Sucesso no banco de dados')

          // A atualização em tempo real será feita via WebSocket automaticamente
          // pelo evento emitido no backend
        } else {
          const errorData = await response.json()
          console.error('❌ Erro ao salvar:', errorData.error || 'Não foi possível salvar a edição')
        }
      }
    } catch (_error) {
      console.error('❌ Erro ao salvar edição')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle revision request
  const handleRevise = async (feedback?: string) => {
    const feedbackToUse = feedback || revisionFeedback
    if (!feedbackToUse.trim()) {
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
          console.log('🤖 Revisão Solicitada - A IA está revisando a resposta')
          setShowRevisionInput(false)
          setRevisionFeedback('')
        } else {
          console.error('❌ Erro ao solicitar revisão')
        }
      }
    } catch (_error) {
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

        console.error('❌ Erro ao Reprocessar:', errorMessage)
        setIsReprocessing(false)
      }
    } catch (_error) {
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
      bg-gradient-to-br from-white/[0.03] to-white/[0.01]
      border border-white/5
      backdrop-blur-sm
      hover:bg-white/[0.04]
      transition-all duration-300
      group
      rounded-xl
      ${statusConfig.glow ? 'shadow-lg shadow-gold/20 border-gold/20' : ''}
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

      {/* Main Content - Mobile Optimized */}
      <div className="relative p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
        {/* Premium Header Section - Mobile Responsive */}
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex-1 space-y-4">
            {/* Top Info Bar - Seller & Date */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
              {/* Seller Info with Date */}
              <div className="flex items-center gap-3">
                {question.mlAccount && (
                  <div className="flex items-center gap-2 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-gradient-to-br from-black/40 to-black/20 border border-white/5">
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
            </div>

            {/* Premium Product Title with Price - Mobile Optimized - Full Width */}
            <div className="relative w-full p-3 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/5 group hover:border-gold/10 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg sm:rounded-xl" />
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3">
                <div className="flex items-start gap-2 sm:gap-2.5 flex-1 min-w-0">
                  <div className="relative mt-0.5 flex-shrink-0">
                    <div className="absolute inset-0 bg-gold/20 blur-sm" />
                    <Package className="relative w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold" />
                  </div>
                  <h3 className="font-bold text-white text-sm sm:text-base leading-tight line-clamp-2">
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
            <div className="relative w-full p-3 sm:p-3 lg:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-gray-900/50 via-black/50 to-gray-900/50 border border-white/5">
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

          {/* Premium Status Badge - Mobile Optimized */}
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
                  {/* Icon with glow effect - Using ML Agent icon in white */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/40 to-violet-500/40 rounded-full blur-xl scale-150 animate-pulse" />
                    <div className="relative bg-gradient-to-br from-purple-900/80 to-violet-900/80 rounded-full p-4 border border-purple-500/30">
                      {/* ML Agent icon in white */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/icone-amarelo.svg"
                        alt="ML Agent"
                        className="w-8 h-8 brightness-0 invert"
                        style={{ filter: 'brightness(0) invert(1)' }}
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
                        className="h-full bg-gradient-to-r from-purple-500 via-violet-400 to-purple-500 rounded-full"
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
                <Textarea
                  value={editedResponse}
                  onChange={(e) => setEditedResponse(e.target.value)}
                  className="min-h-[120px] bg-black/30 border-white/10 text-gray-100 focus:border-gold/30 focus:ring-gold/20"
                  placeholder="Edite a resposta..."
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={isProcessing || !editedResponse.trim()}
                    className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/10"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      // Restaura para a sugestão atual
                      setEditedResponse(question.aiSuggestion || '')
                    }}
                    className="border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Smooth transition when AI response arrives - Mobile Optimized */}
                <div className="text-xs sm:text-sm text-gray-100 leading-relaxed bg-white/[0.02] p-2 sm:p-3 rounded-lg border border-white/5 transition-all duration-300">
                  {question.aiSuggestion || 'Aguardando resposta da IA...'}
                </div>
              </div>
            )}
            </div>
          </div>
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
            {/* Revision Input Modal - Mobile Optimized */}
            {showRevisionInput && question.status !== 'REVISING' && question.status !== 'REVIEWING' && (
              <div className="mt-4 p-3 sm:p-4 rounded-xl bg-gradient-to-br from-purple-900/10 via-violet-900/10 to-purple-900/10 border border-purple-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-purple-400 leading-tight">
                    Como você gostaria de melhorar a resposta?
                  </span>
                </div>
                <Textarea
                  value={revisionFeedback}
                  onChange={(e) => setRevisionFeedback(e.target.value)}
                  className="w-full min-h-[80px] bg-black/30 border-purple-500/20 text-gray-100 focus:border-purple-400 focus:ring-purple-400/20 placeholder:text-gray-500 text-xs sm:text-sm"
                  placeholder="Ex: 'Adicione mais detalhes técnicos', 'Seja mais amigável'..."
                />
                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleRevision}
                    disabled={isProcessing}
                    className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold text-xs sm:text-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                    Revisar com ML Agent
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowRevisionInput(false)
                      setRevisionFeedback('')
                    }}
                    className="w-full sm:w-auto border-white/10 text-gray-400 hover:bg-white/5 hover:text-white text-xs sm:text-sm"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Botões de ação - Esconder quando revisão está aberta ou status é REVISING - Mobile Optimized */}
            {!showRevisionInput && question.status !== 'REVISING' && question.status !== 'REVIEWING' && (
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-2 pt-3 sm:pt-4 border-t border-white/5">
                {/* Mostrar botões se status é AWAITING_APPROVAL OU se tem aiSuggestion com status incorreto */}
                {((question.status === 'AWAITING_APPROVAL' && question.aiSuggestion) ||
                  (question.status === 'PROCESSING' && question.aiSuggestion)) && (
                  <>
                    <Button
                      size="sm"
                      onClick={handleApprove}
                      disabled={isProcessing}
                      className="w-full sm:w-auto text-xs sm:text-sm bg-gradient-to-r from-gold via-gold-light to-gold hover:from-gold-dark hover:via-gold hover:to-gold-dark text-black font-bold shadow-lg shadow-gold/20 transition-all duration-300 py-2 sm:py-1.5"
                    >
                      <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                      Aprovar e Enviar
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(true)
                        // Inicia edição com a resposta salva se existir
                        setEditedResponse(question.aiSuggestion || '')
                      }}
                      disabled={isProcessing}
                      className="w-full sm:w-auto text-xs sm:text-sm border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300 transition-all duration-300 py-2 sm:py-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                      Editar Resposta
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowRevisionInput(true)}
                      disabled={isProcessing}
                      className="w-full sm:w-auto text-xs sm:text-sm border-purple-500/20 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-300 transition-all duration-300 py-2 sm:py-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                      Melhorar com o ML Agent
                    </Button>
                  </>
                )}

          {/* Botão de Retry para perguntas com erro - SEM botão manual */}
          {(question.status === 'FAILED' || question.status === 'TOKEN_ERROR' || question.status === 'ERROR' || question.status === 'TIMEOUT') && (
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
                    className="w-full sm:w-auto text-xs sm:text-sm border-purple-500/20 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-300 transition-all duration-300 py-2 sm:py-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                    Revisar com IA
                  </Button>
                </>
              )}
            </>
          )}

          {question.itemPermalink && (
            <Button
              size="sm"
              variant="outline"
              asChild
              className="w-full sm:w-auto sm:ml-auto text-xs sm:text-sm border-white/10 text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all duration-300 py-2 sm:py-1.5"
            >
              <a href={question.itemPermalink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                Ver no ML
              </a>
            </Button>
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