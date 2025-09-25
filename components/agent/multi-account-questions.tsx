'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { useWebSocket } from '@/hooks/use-websocket'
import { useBrowserNotifications } from '@/hooks/use-browser-notifications'
import {
  MessageSquare,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Users2,
  Package,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock
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
}

export function MultiAccountQuestions({
  selectedAccountId,
  filterStatus = 'pending',
  showFilters = true,
  renderFiltersTo
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
  const [currentPage, setCurrentPage] = useState(1)
  const questionsPerPage = 5
  const [mounted, setMounted] = useState(false)
  const isFetchingRef = useRef(false)
  const notifiedQuestionsRef = useRef<Set<string>>(new Set())

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
            const notifData: Parameters<typeof sendQuestionNotification>[0] = {
              sequentialId: question.sequentialId || 0,
              questionText: `🤖 IA respondeu: "${data.answer.substring(0, 100)}..."`,
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

    // Add event listeners
    window.addEventListener('websocket:question:new' as any, handleNewQuestion)
    window.addEventListener('websocket:question:updated' as any, handleQuestionUpdate)
    window.addEventListener('websocket:questions:initial' as any, handleInitialQuestions)

    // Cleanup
    return () => {
      window.removeEventListener('websocket:question:new' as any, handleNewQuestion)
      window.removeEventListener('websocket:question:updated' as any, handleQuestionUpdate)
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
          endpoint = '/api/agent/approve-question'
          payload.action = 'manual'
          payload.response = data?.answer
          break
      }

      const response = await apiClient.post(endpoint, payload)

      if (response.success) {
        // Optimistic update
        setQuestions(prev => prev.map(q => {
          if (q.id === questionId) {
            return {
              ...q,
              status: action === 'approve' || action === 'edit' ? 'RESPONDED' : 'REVIEWING',
              answer: data?.answer || q.answer,
              approvedAt: action === 'approve' || action === 'edit' ? new Date().toISOString() : (q.approvedAt || null),
              approvalType: action === 'edit' ? 'MANUAL' : action === 'approve' ? 'AUTO' : (q.approvalType || null)
            } as QuestionWithAccount
          }
          return q
        }))

        toast.success(
          action === 'approve' ? 'Resposta aprovada!' :
          action === 'revise' ? 'Revisão solicitada!' :
          'Resposta editada!',
          { duration: 3000 }
        )
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
      // Pendentes: perguntas aguardando ação (processando, aguardando aprovação ou revisando)
      if (!['PENDING', 'RECEIVED', 'PROCESSING', 'AWAITING_APPROVAL', 'REVIEWING', 'REVISING'].includes(q.status)) {
        return false
      }
    } else if (statusFilter === 'completed') {
      // Respondidas: perguntas já enviadas ao ML
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

  // Componente de Filtros
  const FiltersComponent = () => (
    <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
      {/* Connection Status - Mobile Optimized */}
      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-black/50 border border-white/5">
        {isConnected ? (
          <>
            <Wifi className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-500" />
            <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:inline">Tempo Real</span>
          </>
        ) : connectionStatus === 'connecting' ? (
          <>
            <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-yellow-500 animate-spin" />
            <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:inline">Conectando...</span>
          </>
        ) : (
          <>
            <WifiOff className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-500" />
            <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:inline">Offline</span>
          </>
        )}
      </div>

      {/* Account Filter */}
      {accountSummary.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="relative rounded-lg bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5 hover:border-gold/20 text-gray-300 hover:text-gold transition-all duration-300 gap-1 sm:gap-2 group px-2 sm:px-3 lg:px-4 h-8 sm:h-9 lg:h-10">
              <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none rounded-lg" />
              <Filter className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 relative z-10" />
              <span className="relative z-10 text-xs sm:text-sm hidden xs:inline truncate max-w-[60px] sm:max-w-[100px] lg:max-w-none">
                {accountFilter === 'all' ? 'Todas' :
                  accountSummary.find(a => a.accountId === accountFilter)?.nickname?.substring(0, 10) || 'Conta'}
              </span>
              <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 relative z-10" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[280px] bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-xl border border-white/10"
          >
            <DropdownMenuLabel className="text-gold font-semibold">Filtrar por Conta</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={() => setAccountFilter('all')}
              className="hover:bg-gold/10 focus:bg-gold/10 cursor-pointer"
            >
              <div className="flex items-center gap-3 w-full">
                <Users2 className="h-4 w-4 text-gold" />
                <span className="flex-1 text-white">Todas as Contas</span>
                {accountFilter === 'all' && <CheckCircle className="h-4 w-4 text-gold" />}
              </div>
            </DropdownMenuItem>
            {accountSummary.map((account) => (
              <DropdownMenuItem
                key={account.accountId}
                onClick={() => setAccountFilter(account.accountId)}
                className="hover:bg-gold/10 focus:bg-gold/10 cursor-pointer"
              >
                <div className="flex items-center gap-3 w-full">
                  <Avatar className="h-6 w-6 border-gold/30">
                    {account.thumbnail ? (
                      <AvatarImage src={account.thumbnail} alt={account.nickname} />
                    ) : (
                      <AvatarFallback className="bg-gray-800 text-gold text-xs">
                        {account.nickname.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <span className="text-white text-sm">{account.nickname}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">
                        {account.pendingQuestions} pendentes
                      </span>
                    </div>
                  </div>
                  {accountFilter === account.accountId && <CheckCircle className="h-4 w-4 text-gold" />}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="relative rounded-lg bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5 hover:border-gold/20 text-gray-300 hover:text-gold transition-all duration-300 gap-1 sm:gap-2 group px-2 sm:px-3 lg:px-4 h-8 sm:h-9 lg:h-10">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none rounded-lg" />
            <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 relative z-10" />
            <span className="relative z-10 text-xs sm:text-sm">
              {statusFilter === 'all' ? 'Todas' :
                statusFilter === 'pending' ? 'Pendentes' : 'Respondidas'}
            </span>
            <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 relative z-10" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[200px] bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-xl border border-white/10"
        >
          <DropdownMenuLabel className="text-gold font-semibold">Status</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            onClick={() => setStatusFilter('all')}
            className="hover:bg-gold/10 focus:bg-gold/10 cursor-pointer"
          >
            <div className="flex items-center gap-3 w-full">
              <MessageSquare className="h-4 w-4 text-gold" />
              <span className="flex-1 text-white">Todas</span>
              {statusFilter === 'all' && <CheckCircle className="h-4 w-4 text-gold" />}
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setStatusFilter('pending')}
            className="hover:bg-gold/10 focus:bg-gold/10 cursor-pointer"
          >
            <div className="flex items-center gap-3 w-full">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="flex-1 text-white">Pendentes</span>
              {statusFilter === 'pending' && <CheckCircle className="h-4 w-4 text-gold" />}
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setStatusFilter('completed')}
            className="hover:bg-gold/10 focus:bg-gold/10 cursor-pointer"
          >
            <div className="flex items-center gap-3 w-full">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="flex-1 text-white">Respondidas</span>
              {statusFilter === 'completed' && <CheckCircle className="h-4 w-4 text-gold" />}
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  // Render principal
  return (
    <>
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
              <p className="text-xs text-green-500 mt-2">
                🟢 Conectado em tempo real - novas perguntas aparecerão automaticamente
              </p>
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

        {/* Paginação Premium */}
        {totalPages > 1 && statusFilter !== 'pending' && (
          <div className="flex items-center justify-center gap-2 mt-8 mb-4">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              variant="outline"
              className="relative rounded-lg bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5 hover:border-gold/20 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 hover:text-gold transition-all duration-300 group"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, index) => {
                let pageNumber
                if (totalPages <= 5) {
                  pageNumber = index + 1
                } else if (currentPage <= 3) {
                  pageNumber = index + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + index
                } else {
                  pageNumber = currentPage - 2 + index
                }

                return (
                  <Button
                    key={index}
                    onClick={() => setCurrentPage(pageNumber)}
                    variant="outline"
                    className={`
                      relative w-10 h-10 rounded-lg transition-all duration-300
                      ${
                        currentPage === pageNumber
                          ? 'bg-gradient-to-br from-gold/20 to-yellow-500/10 border-gold/50 text-gold shadow-lg shadow-gold/20'
                          : 'bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 border-white/5 text-gray-400 hover:border-gold/20 hover:text-gold'
                      }
                    `}
                  >
                    {pageNumber}
                  </Button>
                )
              })}
            </div>

            <Button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              variant="outline"
              className="relative rounded-lg bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5 hover:border-gold/20 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 hover:text-gold transition-all duration-300 group"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="ml-4 px-3 py-1 rounded-lg bg-black/50 border border-white/5">
              <span className="text-xs text-gray-400">
                Página {currentPage} de {totalPages}
              </span>
            </div>
          </div>
        )}

        {/* Real-time Status */}
        {isConnected && filteredQuestions.length > 0 && (
          <div className="text-center py-4 text-xs text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>Conectado em tempo real - atualizações instantâneas</span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}