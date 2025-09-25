'use client'

import { useState, useEffect, useRef } from 'react'
import { Question, MLAccount } from '@prisma/client'
import Image from 'next/image'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Edit2,
  MessageSquare,
  AlertCircle,
  Package,
  Sparkles,
  ExternalLink,
  Zap,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'

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
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false) // Animação de sucesso
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

  // Limpa o estado de reprocessamento quando a resposta chega ou falha
  useEffect(() => {
    // IMPORTANTE: Nunca mostrar processando se já tem resposta ou está aguardando aprovação
    if (question.aiSuggestion || question.status === 'AWAITING_APPROVAL' || question.status === 'RESPONDED' || question.status === 'COMPLETED') {
      setIsReprocessing(false)
      setIsProcessing(false)
      return
    }

    // Garante que não inicia processando do nada ao recarregar
    if (question.status !== 'PROCESSING' && question.status !== 'REVIEWING' && question.status !== 'REVISING') {
      setIsReprocessing(false)
      setIsProcessing(false)
    }

    if (isReprocessing) {
      // Se a resposta chegou com sucesso
      if (question.aiSuggestion && question.status === 'AWAITING_APPROVAL') {
        setIsReprocessing(false)
        setIsProcessing(false)
        // Para o polling se ainda estiver rodando
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        toast({
          title: 'Resposta Pronta',
          description: 'A IA concluiu o processamento da pergunta.',
        })
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
          icon: Edit2,
          label: 'Revisando',
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
    try {
      // Usar sempre a aiSuggestion que já foi salva no banco
      const responseToSend = question.aiSuggestion

      // Use prop callback if provided, otherwise make API call
      if (onApprove) {
        await onApprove(responseToSend || '')

        // Ativar animação de sucesso
        setShowSuccessAnimation(true)

        // Aguardar 3 segundos antes de remover o card
        setTimeout(() => {
          setShowSuccessAnimation(false)
        }, 3000)

        toast({
          title: '✅ Resposta Enviada ao Mercado Livre',
          description: 'O cliente receberá a resposta em instantes.',
        })
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
          // Ativar animação de sucesso
          setShowSuccessAnimation(true)

          // Aguardar 3 segundos antes de remover o card
          setTimeout(() => {
            setShowSuccessAnimation(false)
          }, 3000)

          toast({
            title: '✅ Resposta Enviada ao Mercado Livre',
            description: 'O cliente receberá a resposta em instantes.',
          })
        } else {
          const error = await response.json()
          toast({
            title: '❌ Erro ao aprovar',
            description: error.error || 'Erro ao enviar resposta',
            variant: 'destructive'
          })
        }
      }
    } catch (_error) {
      toast({
        title: '❌ Erro',
        description: 'Erro ao processar aprovação',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle manual edit save (salva no banco de dados)
  const handleSaveEdit = async () => {
    if (isProcessing) return // Previne cliques múltiplos
    if (!editedResponse.trim()) {
      toast({
        title: '⚠️ Campo vazio',
        description: 'A resposta não pode estar vazia',
        variant: 'destructive'
      })
      return
    }

    setIsProcessing(true)
    try {
      // Use prop callback if provided, otherwise make API call
      if (onEdit) {
        await onEdit(editedResponse)
        // Atualiza a sugestão da IA
        question.aiSuggestion = editedResponse
        setIsEditing(false)
        toast({
          title: '✅ Resposta Atualizada',
          description: 'Alterações salvas no banco. Use "Aprovar e Enviar" para enviar ao Mercado Livre.',
        })
      } else {
        // Salva a resposta editada no banco de dados SEM enviar ao ML
        const response = await fetch('/api/agent/save-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: question.id,
            response: editedResponse
          })
        })

        if (response.ok) {
          // Atualiza a sugestão da IA
          question.aiSuggestion = editedResponse
          setIsEditing(false)

          toast({
            title: '✅ Resposta Atualizada',
            description: 'Alterações salvas no banco. Use "Aprovar e Enviar" para enviar ao Mercado Livre.',
          })

          // Emitir evento SSE para atualizar em tempo real
          // Atualização em tempo real via SSE
        } else {
          toast({
            title: '❌ Erro ao salvar',
            description: 'Não foi possível salvar a edição',
            variant: 'destructive'
          })
        }
      }
    } catch (_error) {
      toast({
        title: '❌ Erro',
        description: 'Erro ao salvar edição',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle revision request
  const handleRevise = async (feedback?: string) => {
    const feedbackToUse = feedback || revisionFeedback
    if (!feedbackToUse.trim()) {
      toast({
        title: '⚠️ Feedback necessário',
        description: 'Digite o feedback para revisão da IA',
        variant: 'destructive'
      })
      return
    }

    setIsProcessing(true)
    try {
      // Use prop callback if provided, otherwise make API call
      if (onRevise) {
        await onRevise(feedbackToUse)
        toast({
          title: '🤖 Revisão Solicitada',
          description: 'A IA está revisando a resposta.',
        })
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
          toast({
            title: '🤖 Revisão Solicitada',
            description: 'A IA está revisando a resposta.',
          })
          setShowRevisionInput(false)
          setRevisionFeedback('')
        } else {
          toast({
            title: '❌ Erro',
            description: 'Erro ao solicitar revisão',
            variant: 'destructive'
          })
        }
      }
    } catch (_error) {
      toast({
        title: '❌ Erro',
        description: 'Erro ao processar revisão',
        variant: 'destructive'
      })
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
        toast({
          title: 'Reprocessando com IA',
          description: 'Aguarde enquanto o ML Agent processa sua pergunta...',
        })

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

          toast({
            title: '⏱️ Tempo Esgotado',
            description: 'O processamento excedeu o limite de 1 minuto. Clique em "Tentar Novamente" para reprocessar.',
            variant: 'destructive',
            duration: 7000
          })
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

        toast({
          title: '❌ Erro ao Reprocessar',
          description: errorMessage,
          variant: 'destructive'
        })
        setIsReprocessing(false)
      }
    } catch (_error) {
      console.error('Erro ao reprocessar:', _error)
      toast({
        title: '❌ Erro de Conexão',
        description: 'Não foi possível conectar ao servidor. Tente novamente.',
        variant: 'destructive'
      })
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
      ${showSuccessAnimation ? 'scale-[0.98] opacity-90' : ''}
    `}>

      {/* Animação Premium de Aprovação - Ultra Clean */}
      {showSuccessAnimation && (
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
      {statusConfig.glow && !showSuccessAnimation && (
        <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-50 pointer-events-none" />
      )}

      {/* Main Content */}
      <div className="relative p-6 space-y-4">
        {/* Premium Header Section */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-4">
            {/* Top Info Bar - Seller & Date */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
              {/* Seller Info with Date */}
              <div className="flex items-center gap-3">
                {question.mlAccount && (
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-black/40 to-black/20 border border-white/5">
                    {/* Seller Profile Photo */}
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-gradient-to-br from-gold/30 to-gold/10 blur-sm rounded-full" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={question.mlAccount.thumbnail || '/mlagent-logo-3d.svg'}
                        alt={question.mlAccount.nickname}
                        className="relative w-9 h-9 rounded-full border border-gold/40 ring-1 ring-gold/20 object-cover shadow-lg shadow-gold/10"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = '/mlagent-logo-3d.svg'
                        }}
                      />
                    </div>

                    {/* Seller Name with Time */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        {question.mlAccount.nickname}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs font-medium text-gold/80">
                        {formatDate((question as any).dateCreated || (question as any).receivedAt || (question as any).createdAt)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Premium Product Title with Price */}
            <div className="relative p-3 rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/5 group hover:border-gold/10 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 flex-1">
                  <div className="relative mt-0.5">
                    <div className="absolute inset-0 bg-gold/20 blur-sm" />
                    <Package className="relative w-4 h-4 text-gold" />
                  </div>
                  <h3 className="font-bold text-white text-base leading-tight">
                    {question.itemTitle || 'Produto'}
                  </h3>
                </div>

                {/* Price on the right side */}
                {question.itemPrice && (
                  <div className="relative rounded-lg bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-xl border border-gold/20 overflow-hidden px-3 py-1.5 group/price hover:border-gold/30 transition-all duration-300 shadow-lg shadow-gold/5">
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-gold/10 opacity-50 pointer-events-none" />
                    <div className="relative flex items-center gap-1">
                      <span className="text-[11px] text-gold/70 font-semibold">R$</span>
                      <span className="text-base font-bold bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
                        {question.itemPrice.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Premium Question Box */}
            <div className="relative p-4 rounded-xl bg-gradient-to-br from-gray-900/50 via-black/50 to-gray-900/50 border border-white/5">
              <div className="absolute top-2 right-2">
                <MessageSquare className="w-3.5 h-3.5 text-gold/30" />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-gold/10 blur-md" />
                  <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-gold/20 to-gold/10 flex items-center justify-center border border-gold/30">
                    <span className="text-xs font-bold text-gold">?</span>
                  </div>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed font-medium">
                  {question.text}
                </p>
              </div>
            </div>
          </div>

          {/* Premium Status Badge */}
          <div className={`
            flex items-center gap-2 px-3 py-2 rounded-xl
            bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90
            backdrop-blur-xl border ${statusConfig.border}
            ${statusConfig.pulse ? 'animate-pulse' : ''}
            shadow-lg min-w-[140px] justify-center
          `}>
            <StatusIcon className={`
              w-4 h-4 ${statusConfig.text}
              ${statusConfig.spin ? 'animate-spin' : ''}
              drop-shadow-lg
            `} />
            <span className={`text-xs font-semibold ${statusConfig.text} uppercase tracking-wider`}>
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* AI Response Section - Sempre visível quando houver sugestão, processando ou reprocessando */}
        {(question.aiSuggestion || question.status === 'AWAITING_APPROVAL' || question.status === 'PROCESSING' || question.status === 'REVISING' || isReprocessing) && (
          <div className="mt-4 p-4 rounded-xl bg-black/30 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gold/10 border border-gold/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icone-amarelo.svg"
                  alt="ML Agent"
                  className="w-4 h-4"
                />
              </div>
              <span className="text-sm font-semibold text-gold">
                {(question.status === 'PROCESSING') ? 'ML Agent processando...' :
                 (question.status === 'REVISING' || question.status === 'REVIEWING') ? 'ML Agent revisando...' :
                 isReprocessing ? 'ML Agent reprocessando...' :
                 'Resposta Sugerida pelo ML Agent'}
              </span>
              {/* Animação de loading clean com 3 pontos */}
              {(question.status === 'PROCESSING' || question.status === 'REVISING' || isReprocessing) && (
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

            {/* Regular content when not processing */}
            {!question.aiSuggestion && !isEditing && question.status !== 'PROCESSING' && question.status !== 'REVISING' && !isReprocessing && (
              <div className="text-gray-400 italic p-3 bg-white/[0.02] rounded-lg border border-white/5">
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
                    disabled={isProcessing}
                    className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/10"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Salvar Edição
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
                {/* Smooth transition when AI response arrives */}
                <div className="text-gray-100 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/5 transition-all duration-300">
                  {question.aiSuggestion || 'Aguardando resposta da IA...'}
                </div>
              </div>
            )}
          </div>
        )}


        {/* Revision Input */}
        {showRevisionInput && (
          <div className="mt-4 p-4 rounded-xl bg-black/30 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">
                Feedback para Revisão da IA
              </span>
            </div>
            <Textarea
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              className="min-h-[80px] bg-black/30 border-white/10 text-gray-100 focus:border-purple-400 focus:ring-purple-400/20"
              placeholder="Descreva como a IA deve melhorar a resposta..."
            />
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleRevision}
                disabled={isProcessing}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold"
              >
                <Sparkles className="w-4 h-4 mr-1" />
                Revisar com ML Agent
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowRevisionInput(false)
                  setRevisionFeedback('')
                }}
                className="border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Error Message with Enhanced Visual */}
        {(question.status === 'FAILED' || question.status === 'ERROR' || question.status === 'TOKEN_ERROR') && (
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-red-600/10 border border-red-500/30">
            <div className="flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-400 mb-1">Erro no Processamento</p>
                <p className="text-sm text-red-300/80">
                  {question.failureReason || 'Ocorreu um erro ao processar a pergunta. Clique em "Tentar Novamente" abaixo.'}
                </p>
                {question.failureReason?.includes('Timeout') && (
                  <p className="text-xs text-red-300/60 mt-2">
                    💡 Dica: Se o erro persistir, tente editar manualmente a resposta.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons Section */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
          {(question.status === 'AWAITING_APPROVAL' && question.aiSuggestion) && (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isProcessing}
                className="bg-gradient-to-r from-gold via-gold-light to-gold hover:from-gold-dark hover:via-gold hover:to-gold-dark text-black font-bold shadow-lg shadow-gold/20 transition-all duration-300"
              >
                <Zap className="w-4 h-4 mr-1" />
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
                className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300 transition-all duration-300"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Editar Resposta
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRevisionInput(!showRevisionInput)}
                disabled={isProcessing}
                className="border-purple-500/20 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-300 transition-all duration-300"
              >
                <Sparkles className="w-4 h-4 mr-1" />
                Melhorar com o ML Agent
              </Button>
            </>
          )}

          {(question.status === 'FAILED' || question.status === 'TOKEN_ERROR' || question.status === 'ERROR') && (
            <div className="flex gap-2 w-full">
              <Button
                size="sm"
                onClick={handleReprocess}
                disabled={isProcessing || isReprocessing}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-lg shadow-amber-500/30 transition-all duration-300 animate-pulse hover:animate-none"
                title="Reenviar pergunta para processamento"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${(isProcessing || isReprocessing) ? 'animate-spin' : ''}`} />
                {(isProcessing || isReprocessing) ? 'Reprocessando...' : 'Tentar Novamente'}
              </Button>

              {/* Opção de editar manualmente quando houver erro */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditing(true)
                  setEditedResponse(question.aiSuggestion || '')
                }}
                disabled={isProcessing || isReprocessing}
                className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300 transition-all duration-300"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Criar Resposta Manual
              </Button>
            </div>
          )}

          {question.itemPermalink && (
            <Button
              size="sm"
              variant="outline"
              asChild
              className="ml-auto border-white/10 text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all duration-300"
            >
              <a href={question.itemPermalink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1" />
                Ver no ML
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Premium Hover Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent group-hover:from-gold/5 group-hover:to-transparent transition-all duration-500 pointer-events-none opacity-30" />
    </Card>
  )
}