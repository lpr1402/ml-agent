'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { useWebSocket } from '@/hooks/use-websocket'
import { useBrowserNotifications } from '@/hooks/use-browser-notifications'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { QuestionStatus } from '@/lib/constants/question-status'
import {
  MessageSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Users2
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { QuestionCard } from './question-card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface QuestionWithAccount {
  id: string
  mlQuestionId: string
  text: string
  itemTitle: string | null
  itemPrice: number
  itemId: string
  itemPermalink?: string | null
  status: string
  aiSuggestion?: string | null
  answer?: string | null
  dateCreated: string
  receivedAt: string
  aiProcessedAt?: string | null
  approvedAt?: string | null
  approvalType?: string | null
  answeredBy?: string | null
  sequentialId?: number
  item?: {
    title?: string
    thumbnail?: string
  }
  failedAt?: string | null
  failureReason?: string | null
  mlResponseCode?: number | null
  mlResponseData?: any
  sentToMLAt?: string | null
  mlAccount: {
    id: string
    mlUserId: string
    nickname: string
    thumbnail?: string | null
    siteId: string
  }
}

interface AccountSummary {
  accountId: string
  nickname: string
  thumbnail?: string
  totalQuestions: number
  pendingQuestions: number
  completedQuestions: number
}

interface Props {
  selectedAccountId?: string | null
  filterStatus?: 'all' | 'pending' | 'completed'
  showFilters?: boolean
  renderFiltersTo?: string
  pageKey?: string // Unique key for pagination state
}

export function MultiAccountQuestions({
  selectedAccountId,
  filterStatus = 'pending',
  showFilters = true,
  renderFiltersTo,
  pageKey = 'default'
}: Props) {
  // WebSocket connection
  const {
    isConnected,
    connectionStatus,
    approveQuestion: wsApproveQuestion,
    reviseQuestion: wsReviseQuestion,
    editQuestion: wsEditQuestion
  } = useWebSocket()

  // Browser notifications
  const {
    hasPermission,
    sendQuestionNotification
  } = useBrowserNotifications()

  // Estado principal
  const [questions, setQuestions] = useState<QuestionWithAccount[]>([])
  const [accountSummary, setAccountSummary] = useState<AccountSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState(filterStatus)
  const [accountFilter, setAccountFilter] = useState<string>(() => selectedAccountId || 'all')
  // Unique page state for each instance using pageKey
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(`page-${pageKey}`)
      return saved ? parseInt(saved) : 1
    }
    return 1
  })
  const questionsPerPage = 5
  const [mounted, setMounted] = useState(false)

  // Save page state when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`page-${pageKey}`, currentPage.toString())
    }
  }, [currentPage, pageKey])
  const isFetchingRef = useRef(false)
  const notifiedQuestionsRef = useRef<Set<string>>(new Set())
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  const [lastApprovedQuestion, setLastApprovedQuestion] = useState<QuestionWithAccount | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (selectedAccountId !== undefined) {
      setAccountFilter(selectedAccountId || 'all')
    }
  }, [selectedAccountId])

  // Função para buscar perguntas do banco
  const fetchQuestions = useCallback(async (showLoadingState = true) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    try {
      if (showLoadingState && !refreshing) {
        setLoading(true)
      }

      const params = new URLSearchParams()
      if (accountFilter && accountFilter !== 'all') {
        params.set('accountId', accountFilter)
      }
      if (statusFilter && statusFilter !== 'all') {
        params.set('filter', statusFilter)
      }

      // Buscar perguntas multi-conta
      const response = await apiClient.get(`/api/agent/questions-multi?${params.toString()}`)

      if (!response) {
        throw new Error('No response from API')
      }

      const { questions: fetchedQuestions = [], accountsSummary = [] } = response

      // Atualizar estado com dados do banco
      setQuestions(fetchedQuestions)
      setAccountSummary(accountsSummary)

      logger.info('[Multi Questions] Data loaded', {
        count: fetchedQuestions.length,
        accounts: accountsSummary.length
      })

    } catch (error) {
      logger.error('[Multi Questions] Error fetching data:', { error })
      toast.error('Erro ao carregar perguntas', {
        description: 'Verifique sua conexão e tente novamente'
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
      isFetchingRef.current = false
    }
  }, [accountFilter, statusFilter, refreshing])

  // Busca inicial e setup de listeners WebSocket
  useEffect(() => {
    if (!mounted) return

    // Busca inicial
    fetchQuestions()

    // WebSocket event listeners
    const handleNewQuestion = async (event: CustomEvent) => {
      const { question } = event.detail
      logger.info('[Multi Questions] New question via WebSocket', question)

      // Send browser notification for new question (only once per question)
      if (hasPermission && question && !notifiedQuestionsRef.current.has(question.mlQuestionId)) {
        notifiedQuestionsRef.current.add(question.mlQuestionId)
        try {
          await sendQuestionNotification({
            sequentialId: question.sequentialId || 0,
            questionText: question.text || '',
            productTitle: question.item?.title || question.itemTitle || 'Produto',
            productImage: question.item?.thumbnail,
            sellerName: question.mlAccount?.nickname || 'Vendedor',
            approvalUrl: '' // Não usar link na notificação do browser
          })
        } catch (error) {
          logger.warn('[Multi Questions] Failed to send browser notification', { error })
        }
      }

      // Add new question to list (optimistic update)
      setQuestions(prev => {
        // Check if question already exists
        if (prev.some(q => q.mlQuestionId === question.mlQuestionId)) {
          return prev
        }
        return [question, ...prev]
      })

      // Update account summary
      if (question.mlAccount) {
        setAccountSummary(prev => prev.map(acc => {
          if (acc.accountId === question.mlAccount.id) {
            return {
              ...acc,
              totalQuestions: acc.totalQuestions + 1,
              pendingQuestions: acc.pendingQuestions + 1
            }
          }
          return acc
        }))
      }

      // Remove forced refresh - let WebSocket handle real-time updates
    }

    const handleQuestionUpdate = async (event: CustomEvent) => {
      const { questionId, status, data } = event.detail
      logger.info('[Multi Questions] Question updated via WebSocket', {
        questionId,
        status
      })

      // Send browser notification when AI response arrives (only once)
      const notifKey = `${questionId}-${status}`
      if (status === 'AWAITING_APPROVAL' && data?.answer && hasPermission && !notifiedQuestionsRef.current.has(notifKey)) {
        notifiedQuestionsRef.current.add(notifKey)
        const question = questions.find(q => q.mlQuestionId === questionId || q.id === questionId)
        if (question) {
          try {
            // Truncar resposta da IA para preview (máximo 100 caracteres)
            const truncatedAnswer = data.answer.length > 100
              ? data.answer.substring(0, 100) + '...'
              : data.answer

            const notifData: Parameters<typeof sendQuestionNotification>[0] = {
              sequentialId: question.sequentialId || 0,
              questionText: `O ML Agent respondeu sua pergunta. Clique para revisar e aprovar:\n\n"${truncatedAnswer}"`,
              productTitle: question.item?.title || question.itemTitle || 'Produto',
              sellerName: question.mlAccount?.nickname || 'Vendedor',
              approvalUrl: '' // Não usar link na notificação do browser
            }
            if (question.item?.thumbnail) {
              notifData.productImage = question.item.thumbnail
            }
            await sendQuestionNotification(notifData)
          } catch (error) {
            logger.warn('[Multi Questions] Failed to send AI response notification', { error })
          }
        }
      }

      // Update question in list
      setQuestions(prev => prev.map(q => {
        if (q.mlQuestionId === questionId || q.id === questionId) {
          return {
            ...q,
            status,
            ...data // Merge any additional data
          }
        }
        return q
      }))

      // Update account summary if status changed to responded
      if (status === 'RESPONDED' || status === 'COMPLETED') {
        // Update within the state setter to access current questions
        setQuestions(prevQuestions => {
          const question = prevQuestions.find(q => q.mlQuestionId === questionId || q.id === questionId)
          if (question) {
            setAccountSummary(prevSummary => prevSummary.map(acc => {
              if (acc.accountId === question.mlAccount.id) {
                return {
                  ...acc,
                  pendingQuestions: Math.max(0, acc.pendingQuestions - 1),
                  completedQuestions: acc.completedQuestions + 1
                }
              }
              return acc
            }))
          }
          return prevQuestions // Return unchanged questions
        })
      }
    }

    const handleInitialQuestions = (event: CustomEvent) => {
      const { recentQuestions } = event.detail
      if (recentQuestions && recentQuestions.length > 0) {
        logger.info('[Multi Questions] Initial questions via WebSocket', {
          count: recentQuestions.length
        })
        // Don't override, just merge if needed
        setQuestions(prev => {
          const existingIds = new Set(prev.map(q => q.mlQuestionId))
          const newQuestions = recentQuestions.filter(
            (q: QuestionWithAccount) => !existingIds.has(q.mlQuestionId)
          )
          return [...prev, ...newQuestions]
        })
      }
    }

    // Handler para erros em tempo real
    const handleQuestionError = (event: CustomEvent) => {
      const { questionId, failureReason, errorType, errorCode, keepStatus } = event.detail
      logger.info('[Multi Questions] Question error received', {
        questionId,
        errorType,
        errorCode,
        keepStatus
      })

      setQuestions(prev => prev.map(q => {
        if (q.mlQuestionId === questionId) {
          // Se for erro de revisão/aprovação, manter status AWAITING_APPROVAL
          const currentStatus = q.status
          const shouldKeepStatus = keepStatus ||
            (currentStatus === 'AWAITING_APPROVAL' || currentStatus === 'REVISING')

          if (shouldKeepStatus) {
            // Apenas adiciona informação do erro sem mudar o status
            return {
              ...q,
              lastError: failureReason || 'Erro no processamento',
              lastErrorAt: new Date().toISOString(),
              lastErrorType: errorType
            }
          } else {
            // Erro durante processamento inicial - muda status para FAILED
            return {
              ...q,
              status: QuestionStatus.FAILED,
              failedAt: new Date().toISOString(),
              failureReason: failureReason || 'Erro no processamento'
            }
          }
        }
        return q
      }))

      // Notificar usuário do erro
      const errorMessage = errorType === 'REVISION_ERROR'
        ? 'Erro ao revisar resposta. Você pode tentar novamente.'
        : errorType === 'APPROVAL_ERROR'
        ? 'Erro ao enviar resposta. Tente novamente mais tarde.'
        : 'Erro ao processar pergunta'

      toast.error(errorMessage, {
        description: failureReason || 'Ocorreu um erro ao processar a pergunta',
        duration: 7000
      })
    }

    // Handler específico para erros de revisão
    const handleRevisionError = (event: CustomEvent) => {
      const { questionId, failureReason, status, aiSuggestion } = event.detail
      logger.info('[Multi Questions] Revision error received', {
        questionId,
        failureReason,
        status
      })

      // Atualizar pergunta com status AWAITING_APPROVAL e mostrar erro
      setQuestions(prev => prev.map(q => {
        if (q.mlQuestionId === questionId) {
          return {
            ...q,
            status: 'AWAITING_APPROVAL',
            aiSuggestion: aiSuggestion || q.aiSuggestion,
            revisionError: failureReason,
            revisionErrorAt: new Date().toISOString()
          }
        }
        return q
      }))

      // Notificar usuário com mensagem específica de erro de revisão
      toast.error('Erro ao revisar com IA', {
        description: failureReason || 'A IA não conseguiu processar a revisão. Tente novamente.',
        duration: 10000,
        action: {
          label: 'Tentar novamente',
          onClick: () => {
            // Limpar erro de revisão
            setQuestions(prev => prev.map(q => {
              if (q.mlQuestionId === questionId) {
                return {
                  ...q,
                  revisionError: undefined,
                  revisionErrorAt: undefined
                }
              }
              return q
            }))
          }
        }
      })
    }

    // Handler para edição manual de resposta
    const handleAnswerEdited = (event: CustomEvent) => {
      const { questionId, mlQuestionId, editedAnswer } = event.detail
      logger.info('[Multi Questions] Answer edited received', {
        questionId,
        mlQuestionId
      })

      // Atualizar pergunta na lista
      setQuestions(prev => prev.map(q => {
        if (q.mlQuestionId === mlQuestionId || q.id === questionId) {
          return {
            ...q,
            aiSuggestion: editedAnswer,
            status: 'AWAITING_APPROVAL'
          }
        }
        return q
      }))
    }

    // Add event listeners
    window.addEventListener('websocket:question:new' as any, handleNewQuestion)
    window.addEventListener('websocket:question:updated' as any, handleQuestionUpdate)
    window.addEventListener('websocket:question:error' as any, handleQuestionError)
    window.addEventListener('websocket:question:revision-error' as any, handleRevisionError)
    window.addEventListener('websocket:question:answer-edited' as any, handleAnswerEdited)
    window.addEventListener('websocket:questions:initial' as any, handleInitialQuestions)

    // Cleanup
    return () => {
      window.removeEventListener('websocket:question:new' as any, handleNewQuestion)
      window.removeEventListener('websocket:question:updated' as any, handleQuestionUpdate)
      window.removeEventListener('websocket:question:error' as any, handleQuestionError)
      window.removeEventListener('websocket:question:revision-error' as any, handleRevisionError)
      window.removeEventListener('websocket:question:answer-edited' as any, handleAnswerEdited)
      window.removeEventListener('websocket:questions:initial' as any, handleInitialQuestions)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, fetchQuestions, hasPermission, sendQuestionNotification]) // Removed 'questions' from deps to prevent infinite loop

  // Polling controlado - atualizar a cada 30 segundos (apenas se não estiver conectado ao WebSocket)
  useEffect(() => {
    if (!mounted || isConnected) return // Só fazer polling se WebSocket estiver desconectado

    const interval = setInterval(() => {
      if (!isFetchingRef.current) {
        logger.info('[Multi Questions] Periodic refresh (WebSocket disconnected)')
        fetchQuestions(false)
      }
    }, 30000) // 30 segundos

    return () => clearInterval(interval)
  }, [mounted, isConnected, fetchQuestions])

  // Função para processar ação em uma pergunta
  const handleQuestionAction = async (
    questionId: string,
    action: 'approve' | 'revise' | 'edit',
    data?: any
  ) => {
    try {
      // Optimistic update via WebSocket
      const wsSuccess = action === 'approve'
        ? wsApproveQuestion(questionId, data?.answer)
        : action === 'revise'
        ? wsReviseQuestion(questionId, data?.feedback)
        : wsEditQuestion(questionId, data?.answer)

      if (!wsSuccess) {
        logger.warn('[Multi Questions] WebSocket not connected, falling back to HTTP')
      }

      // Always make HTTP request for data persistence
      let endpoint = ''
      const payload: any = { questionId }

      switch (action) {
        case 'approve':
          endpoint = '/api/agent/approve-question'
          payload.action = 'approve'
          payload.response = data?.answer
          break
        case 'revise':
          endpoint = '/api/agent/revise-question'
          payload.feedback = data?.feedback
          break
        case 'edit':
          // Usar o novo endpoint que APENAS salva no banco (não envia ao ML)
          endpoint = '/api/agent/save-answer-edit'
          payload.editedAnswer = data?.answer
          break
      }

      const response = await apiClient.post(endpoint, payload)

      if (response.success) {
        // Optimistic update
        setQuestions(prev => prev.map(q => {
          if (q.id === questionId) {
            if (action === 'edit') {
              // Para edição, apenas atualizar a resposta e manter status AWAITING_APPROVAL
              return {
                ...q,
                status: 'AWAITING_APPROVAL',
                aiSuggestion: data?.answer || q.aiSuggestion
              } as QuestionWithAccount
            } else {
              // Para outras ações, comportamento original
              return {
                ...q,
                status: action === 'approve' ? 'RESPONDED' : 'REVIEWING',
                answer: data?.answer || q.answer,
                approvedAt: action === 'approve' ? new Date().toISOString() : (q.approvedAt || null),
                approvalType: action === 'approve' ? 'AUTO' : (q.approvalType || null)
              } as QuestionWithAccount
            }
          }
          return q
        }))

        // Mostrar animação de sucesso apenas para aprovação (não para edição)
        if (action === 'approve') {
          const approvedQuestion = questions.find(q => q.id === questionId)
          if (approvedQuestion) {
            setLastApprovedQuestion(approvedQuestion)
            setShowSuccessAnimation(true)
            setTimeout(() => setShowSuccessAnimation(false), 2300)
          }
        }

        // Toast removido - usando apenas animação visual personalizada
        // toast.success(
        //   action === 'approve' ? '✅ Resposta enviada ao Mercado Livre!' :
        //   action === 'revise' ? '🔄 Revisão solicitada!' :
        //   '✏️ Resposta editada e enviada!',
        //   {
        //     duration: 4000,
        //     description: action === 'approve' || action === 'edit'
        //       ? 'O cliente receberá a resposta em breve'
        //       : 'O ML Agent está revisando a resposta'
        //   }
        // )
      }

      return response
    } catch (error) {
      logger.error('[Multi Questions] Error processing action:', { error, action, questionId })
      toast.error('Erro ao processar ação', {
        description: 'Tente novamente em alguns instantes'
      })
      throw error
    }
  }


  // Filtrar perguntas baseado nos filtros ativos
  const filteredQuestions = questions.filter(q => {
    // Filtro de status
    if (statusFilter === 'pending') {
      // Pendentes: perguntas aguardando ação (incluindo ERROS)
      if (!['PENDING', 'RECEIVED', 'PROCESSING', 'AWAITING_APPROVAL', 'REVIEWING', 'REVISING', 'FAILED', 'ERROR', 'TIMEOUT'].includes(q.status)) {
        return false
      }
    } else if (statusFilter === 'completed') {
      // Respondidas: perguntas já enviadas ao ML (excluindo erros)
      if (!['RESPONDED', 'COMPLETED', 'APPROVED', 'SENT_TO_ML'].includes(q.status)) {
        return false
      }
    }

    // Filtro de conta
    if (accountFilter && accountFilter !== 'all' && q.mlAccount.id !== accountFilter) {
      return false
    }

    return true
  })

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, accountFilter])

  // Paginate questions
  const paginatedQuestions = (() => {
    if (statusFilter === 'pending') {
      // Pendentes não tem paginação - mostra todas
      return filteredQuestions
    } else {
      // Todas e Respondidas têm paginação
      const startIndex = (currentPage - 1) * questionsPerPage
      const endIndex = startIndex + questionsPerPage
      return filteredQuestions.slice(startIndex, endIndex)
    }
  })()

  const totalPages = statusFilter === 'pending' ? 0 : Math.ceil(filteredQuestions.length / questionsPerPage)

  // Loading state
  if (loading && !refreshing) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 bg-gray-800/50" />
        ))}
      </div>
    )
  }

  // Componente de Filtros - Design Padronizado com ROI e Análise
  const FiltersComponent = () => (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {/* Filtros de Status - Mesmo Design de ROI */}
      <div className="flex gap-2 bg-black/50 p-1 rounded-xl">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
            statusFilter === 'pending'
              ? 'bg-gradient-to-r from-gold to-gold-light text-black shadow-lg shadow-gold/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Pendentes
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
            statusFilter === 'completed'
              ? 'bg-gradient-to-r from-gold to-gold-light text-black shadow-lg shadow-gold/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Respondidas
        </button>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
            statusFilter === 'all'
              ? 'bg-gradient-to-r from-gold to-gold-light text-black shadow-lg shadow-gold/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Todas
        </button>
      </div>

      {/* Account Filter - Design Padronizado */}
      {accountSummary.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative rounded-lg bg-black/50 hover:bg-white/5 text-gray-400 hover:text-white transition-all duration-300 gap-2 px-4 py-2 h-auto group">
              <Users2 className="h-4 w-4 text-gold/60 group-hover:text-gold" />
              <span className="text-sm font-semibold">
                {accountFilter === 'all' ? `Todas (${accountSummary.length})` :
                  accountSummary.find(a => a.accountId === accountFilter)?.nickname?.substring(0, 15) || 'Conta'}
              </span>
              {accountFilter !== 'all' && (
                <span className="absolute -top-1 -right-1 bg-gold text-black text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {accountSummary.find(a => a.accountId === accountFilter)?.pendingQuestions || 0}
                </span>
              )}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[320px] bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-xl border border-white/10 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
          >
            <DropdownMenuLabel className="text-gold font-semibold flex items-center gap-2">
              <Users2 className="h-4 w-4" />
              Filtrar por Conta ML
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />

            {/* Opção Todas */}
            <DropdownMenuItem
              onClick={() => setAccountFilter('all')}
              className="hover:bg-gold/10 focus:bg-gold/10 cursor-pointer py-3"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gold/20 to-yellow-500/20 flex items-center justify-center">
                  <Users2 className="h-4 w-4 text-gold" />
                </div>
                <div className="flex-1">
                  <span className="text-white font-medium">Todas as Contas</span>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-gray-400">
                      {accountSummary.reduce((acc, a) => acc + a.pendingQuestions, 0)} pendentes total
                    </span>
                    <span className="text-[10px] text-gray-600">|</span>
                    <span className="text-[10px] text-gray-400">
                      {accountSummary.length} contas ativas
                    </span>
                  </div>
                </div>
                {accountFilter === 'all' && (
                  <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center">
                    <CheckCircle className="h-3 w-3 text-gold" />
                  </div>
                )}
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-white/5 my-1" />

            {/* Contas Individuais */}
            {accountSummary.map((account) => (
              <DropdownMenuItem
                key={account.accountId}
                onClick={() => setAccountFilter(account.accountId)}
                className="hover:bg-gold/10 focus:bg-gold/10 cursor-pointer py-3"
              >
                <div className="flex items-center gap-3 w-full">
                  <Avatar className="h-8 w-8 border border-gold/20">
                    {account.thumbnail ? (
                      <AvatarImage src={account.thumbnail} alt={account.nickname} />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-900 text-gold text-xs font-bold">
                        {account.nickname.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <span className="text-white text-sm font-medium">{account.nickname}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {account.pendingQuestions > 0 ? (
                        <>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                            <span className="text-[10px] text-yellow-500 font-bold">
                              {account.pendingQuestions}
                            </span>
                            <span className="text-[10px] text-yellow-500/70">pendente{account.pendingQuestions > 1 ? 's' : ''}</span>
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-500">Sem pendentes</span>
                      )}
                    </div>
                  </div>
                  {accountFilter === account.accountId && (
                    <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center">
                      <CheckCircle className="h-3 w-3 text-gold" />
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Connection Status - Design Padronizado - Hidden on Mobile */}
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/50">
        {isConnected ? (
          <>
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span className="text-xs text-gray-500 font-semibold">Online</span>
          </>
        ) : connectionStatus === 'connecting' ? (
          <>
            <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500 font-semibold">Conectando</span>
          </>
        ) : (
          <>
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
            <span className="text-xs text-gray-500 font-semibold">Offline</span>
          </>
        )}
      </div>
    </div>
  )

  // Render principal
  return (
    <>
      {/* Animação de Sucesso - Feedback Visual Premium */}
      {showSuccessAnimation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          {/* Backdrop suave */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
            className="relative bg-gradient-to-br from-gray-900/90 via-black/90 to-gray-900/90 backdrop-blur-xl rounded-xl border border-gold/20 p-6 shadow-xl shadow-gold/20 max-w-xs mx-4"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-gold/10 rounded-2xl opacity-50 pointer-events-none" />

            <div className="relative flex flex-col items-center gap-6 text-center">
              {/* Logo ML Agent */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-gold/50 to-yellow-500/50 rounded-full blur-[40px] scale-[1.5] animate-pulse" />
                <Image
                  src="/mlagent-logo-3d.svg"
                  alt="ML Agent"
                  width={60}
                  height={60}
                  className="relative drop-shadow-2xl"
                  style={{
                    filter: 'drop-shadow(0 15px 40px rgba(255, 230, 0, 0.4))',
                  }}
                  priority
                />
              </div>

              {/* Check de Sucesso */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, duration: 0.5, type: 'spring' }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/40 to-green-500/40 rounded-full blur-xl" />
                <div className="relative bg-gradient-to-br from-emerald-600/30 to-green-600/30 rounded-full p-3 border border-emerald-500/60 backdrop-blur-sm">
                  <CheckCircle className="h-8 w-8 text-emerald-400" strokeWidth={3} />
                </div>
              </motion.div>

              {/* Mensagem de Sucesso */}
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-gold">
                  Resposta Enviada!
                </h3>
                <p className="text-sm text-gray-300">
                  Enviada com sucesso ao Mercado Livre
                </p>
                {lastApprovedQuestion && (
                  <p className="text-xs text-gray-500 mt-2">
                    Pergunta #{lastApprovedQuestion.sequentialId || 'N/A'} - {lastApprovedQuestion.mlAccount.nickname}
                  </p>
                )}
              </div>

              {/* Progress Bar Animation */}
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-gold via-yellow-500 to-gold"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Render filters in portal if specified */}
      {mounted && showFilters && renderFiltersTo && (
        <>
          {createPortal(
            <FiltersComponent />,
            document.getElementById(renderFiltersTo) as HTMLElement
          )}
        </>
      )}

      {/* Render filters inline if not using portal */}
      {showFilters && !renderFiltersTo && (
        <div className="mb-6">
          <FiltersComponent />
        </div>
      )}

      {/* Paginação Minimalista no Topo */}
      {filteredQuestions.length > 5 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={(e) => {
              e.preventDefault()
              setCurrentPage(prev => Math.max(1, prev - 1))
            }}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-white/5 hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white transition-all duration-200"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">{currentPage}</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-500">{totalPages}</span>
          </div>

          <button
            onClick={(e) => {
              e.preventDefault()
              setCurrentPage(prev => Math.min(totalPages, prev + 1))
            }}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-white/5 hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white transition-all duration-200"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-4">

        {/* Empty State */}
        {filteredQuestions.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-300 mb-2">
              Nenhuma pergunta encontrada
            </h3>
            <p className="text-sm text-gray-500">
              {statusFilter === 'pending'
                ? 'Não há perguntas pendentes no momento'
                : 'Ajuste os filtros para ver mais resultados'}
            </p>
            {isConnected && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <p className="text-xs text-green-500">
                  Novas perguntas aparecerão automaticamente
                </p>
              </div>
            )}
          </div>
        )}

        {/* Questions Cards */}
        {paginatedQuestions.map((question) => (
          <QuestionCard
            key={question.id}
            question={{
              ...question,
              createdAt: new Date(question.dateCreated),
              updatedAt: new Date(question.dateCreated),
              mlAccountId: question.mlAccount.id,
              processedAt: question.aiProcessedAt ? new Date(question.aiProcessedAt) : null,
              aiProcessedAt: question.aiProcessedAt ? new Date(question.aiProcessedAt) : null,
              approvedAt: question.approvedAt ? new Date(question.approvedAt) : null,
              sentToMLAt: question.sentToMLAt ? new Date(question.sentToMLAt) : null,
              failedAt: question.failedAt ? new Date(question.failedAt) : null,
              receivedAt: new Date(question.receivedAt),
              retryCount: 0,
              webhookEventId: null,
              n8nEditCount: 0
            } as any}
            onApprove={async (answer) => {
              await handleQuestionAction(question.id, 'approve', { answer })
            }}
            onRevise={async (feedback) => {
              await handleQuestionAction(question.id, 'revise', { feedback })
            }}
            onEdit={async (answer) => {
              await handleQuestionAction(question.id, 'edit', { answer })
            }}
          />
        ))}

        {/* Paginação Minimalista no Final */}
        {filteredQuestions.length <= 5 && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={(e) => {
                e.preventDefault()
                setCurrentPage(prev => Math.max(1, prev - 1))
              }}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-white/5 hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white transition-all duration-200"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">{currentPage}</span>
              <span className="text-gray-600">/</span>
              <span className="text-gray-500">{totalPages}</span>
            </div>

            <button
              onClick={(e) => {
                e.preventDefault()
                setCurrentPage(prev => Math.min(totalPages, prev + 1))
              }}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-white/5 hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white transition-all duration-200"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Real-time Status */}
        {isConnected && filteredQuestions.length > 0 && (
          <div className="text-center py-4 text-xs text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>Novas perguntas aparecerão automaticamente</span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}