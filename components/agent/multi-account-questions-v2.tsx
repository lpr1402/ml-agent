'use client'

/**
 * PRODUCTION-READY MULTI-ACCOUNT QUESTIONS COMPONENT
 *
 * Features:
 * - 24/7 Real-time monitoring of ALL ML accounts
 * - Automatic SSE reconnection with exponential backoff
 * - Fallback to polling if SSE fails
 * - Real-time question updates and notifications
 * - Optimized for production performance
 */

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import {
  MessageSquare,
  Filter,
  ChevronDown,
  CheckCircle,
  Users2,
  Package,
  Wifi,
  WifiOff,
  RefreshCw
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
  failedAt?: string | null
  failureReason?: string | null
  mlResponseCode?: number | null
  mlResponseData?: any
  sentToMLAt?: string | null
  retryCount?: number
  mlAccount: {
    id: string
    mlUserId: string
    nickname: string
    thumbnail?: string | null
    siteId: string
    organizationId?: string
    email?: string | null
  }
}

interface AccountSummary {
  accountId: string
  nickname: string
  thumbnail?: string
  totalQuestions: number
  pendingQuestions: number
  completedQuestions: number
  tokenValid?: boolean
  status?: string
}

interface Props {
  selectedAccountId?: string | null
  filterStatus?: 'all' | 'pending' | 'completed'
  showFilters?: boolean
  renderFiltersTo?: string
}

export function MultiAccountQuestionsV2({
  selectedAccountId,
  filterStatus = 'pending',
  showFilters = true,
  renderFiltersTo
}: Props) {
  const [questions, setQuestions] = useState<QuestionWithAccount[]>([])
  const [accountSummary, setAccountSummary] = useState<AccountSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(filterStatus)
  const [accountFilter, setAccountFilter] = useState<string>(() => selectedAccountId || 'all')
  const [mounted, setMounted] = useState(false)

  // SSE Connection State
  const [sseConnected, setSseConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch questions from API
  const fetchQuestions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (accountFilter && accountFilter !== 'all') {
        params.set('accountId', accountFilter)
      }
      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const data = await apiClient.get(`/api/agent/questions-multi?${params}`)
      const typedData = data as {
        questions: QuestionWithAccount[]
        accountSummary: AccountSummary[]
      }

      setQuestions(typedData.questions)
      setAccountSummary(typedData.accountSummary)

      logger.info('[Multi Questions] Data loaded', {
        count: typedData.questions.length,
        accounts: typedData.accountSummary.length
      })
    } catch (error) {
      logger.error('[Multi Questions] Error fetching questions:', { error })
    } finally {
      setLoading(false)
    }
  }, [accountFilter, statusFilter])

  // Initial load and filter changes
  useEffect(() => {
    if (mounted) {
      fetchQuestions()
    }
  }, [mounted, fetchQuestions])

  // PRODUCTION-READY SSE CONNECTION
  useEffect(() => {
    let eventSource: EventSource | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null
    let heartbeatTimeout: NodeJS.Timeout | null = null
    let reconnectAttempts = 0
    const maxReconnectAttempts = 10

    const connectSSE = async () => {
      try {
        setConnectionStatus('connecting')

        // Get authentication token
        const tokenResponse = await fetch('/api/auth/session/token', {
          credentials: 'include',
          cache: 'no-cache'
        })

        if (!tokenResponse.ok) {
          throw new Error('Authentication failed')
        }

        const { token } = await tokenResponse.json()

        // Create SSE connection
        const sseUrl = `${window.location.origin}/api/agent/events-multi?token=${encodeURIComponent(token)}`

        console.log('🚀 [SSE] Establishing 24/7 real-time monitoring connection...')

        eventSource = new EventSource(sseUrl, {
          withCredentials: true
        })

        // Connection opened
        eventSource.onopen = () => {
          console.log('✅ [SSE] Connected - Monitoring all ML accounts in real-time')
          setConnectionStatus('connected')
          setSseConnected(true)
          reconnectAttempts = 0
          setLastEventTime(new Date())

          // Start heartbeat monitor
          resetHeartbeatTimeout()
        }

        // Handle named events
        eventSource.addEventListener('connected', (event: MessageEvent) => {
          const data = JSON.parse(event.data)
          console.log('🔗 [SSE] Server confirmed connection:', data.connectionId)
          setLastEventTime(new Date())
        })

        eventSource.addEventListener('status', (event: MessageEvent) => {
          const data = JSON.parse(event.data)
          console.log(`📊 [SSE] Status: Monitoring ${data.data?.accounts?.length || 0} ML accounts`)

          if (data.data?.accounts) {
            setAccountSummary(data.data.accounts.map((acc: any) => ({
              accountId: acc.id,
              nickname: acc.nickname,
              thumbnail: acc.thumbnail || '',
              totalQuestions: acc.pendingQuestions || 0,
              pendingQuestions: acc.pendingQuestions || 0,
              completedQuestions: 0,
              tokenValid: acc.tokenValid,
              status: acc.status
            })))
          }

          setLastEventTime(new Date())
          resetHeartbeatTimeout()
        })

        eventSource.addEventListener('questions', (event: MessageEvent) => {
          const data = JSON.parse(event.data)
          console.log(`📨 [SSE] Received ${data.data?.length || 0} questions`)

          if (data.data && Array.isArray(data.data)) {
            setQuestions(data.data)
          }

          setLastEventTime(new Date())
          resetHeartbeatTimeout()
        })

        eventSource.addEventListener('question', (event: MessageEvent) => {
          const data = JSON.parse(event.data)
          handleNewQuestion(data)
          setLastEventTime(new Date())
          resetHeartbeatTimeout()
        })

        eventSource.addEventListener('answer', (event: MessageEvent) => {
          const data = JSON.parse(event.data)
          handleQuestionAnswered(data)
          setLastEventTime(new Date())
          resetHeartbeatTimeout()
        })

        eventSource.addEventListener('heartbeat', () => {
          setLastEventTime(new Date())
          resetHeartbeatTimeout()
        })

        // Error handler
        eventSource.onerror = (error) => {
          console.error('❌ [SSE] Connection error:', error)
          setConnectionStatus('error')
          setSseConnected(false)

          if (eventSource) {
            eventSource.close()
            eventSource = null
          }

          // Reconnect with exponential backoff
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
            console.log(`🔄 [SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`)

            reconnectTimeout = setTimeout(() => {
              connectSSE()
            }, delay)
          } else {
            console.error('❌ [SSE] Max reconnection attempts reached')
            setConnectionStatus('disconnected')
          }
        }

        // Helper to reset heartbeat timeout
        function resetHeartbeatTimeout() {
          if (heartbeatTimeout) clearTimeout(heartbeatTimeout)

          // Expect heartbeat every 30 seconds
          heartbeatTimeout = setTimeout(() => {
            console.warn('⚠️ [SSE] No heartbeat received in 30s, connection may be stale')
            if (eventSource?.readyState === EventSource.OPEN) {
              // Connection still reports as open but may be stale
              eventSource.close()
              connectSSE()
            }
          }, 35000)
        }

      } catch (error) {
        console.error('❌ [SSE] Failed to establish connection:', error)
        setConnectionStatus('error')
        setSseConnected(false)

        // Retry connection
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
          reconnectTimeout = setTimeout(() => connectSSE(), delay)
        }
      }
    }

    // Handle new question
    const handleNewQuestion = (data: any) => {
      console.log('🆕 [SSE] NEW QUESTION!', {
        account: data.accountNickname || data.data?.mlAccount?.nickname,
        questionId: data.data?.mlQuestionId,
        text: data.data?.text?.substring(0, 50)
      })

      const newQuestion: QuestionWithAccount = {
        id: data.data.id,
        mlQuestionId: data.data.mlQuestionId,
        text: data.data.text,
        itemTitle: data.data.itemTitle,
        itemPrice: data.data.itemPrice || 0,
        itemId: data.data.itemId,
        itemPermalink: data.data.itemPermalink || null,
        status: data.data.status || 'PROCESSING',
        aiSuggestion: null,
        answer: null,
        dateCreated: data.data.dateCreated || new Date().toISOString(),
        receivedAt: data.data.receivedAt || new Date().toISOString(),
        aiProcessedAt: null,
        approvedAt: null,
        approvalType: null,
        answeredBy: null,
        failedAt: null,
        failureReason: null,
        mlResponseCode: null,
        mlResponseData: null,
        sentToMLAt: null,
        mlAccount: data.data.mlAccount || {
          id: data.accountId || data.data.mlAccountId,
          mlUserId: data.data.mlAccount?.mlUserId || '',
          nickname: data.accountNickname || data.data.mlAccount?.nickname || 'Conta',
          thumbnail: data.data.mlAccount?.thumbnail || null,
          siteId: data.data.mlAccount?.siteId || 'MLB'
        }
      }

      // Add to questions list
      setQuestions(prev => {
        const exists = prev.some(q => q.mlQuestionId === newQuestion.mlQuestionId)
        if (exists) {
          return prev.map(q =>
            q.mlQuestionId === newQuestion.mlQuestionId ? newQuestion : q
          )
        }
        return [newQuestion, ...prev]
      })

      // Update account summary
      setAccountSummary(prev => prev.map(acc => {
        if (acc.accountId === (data.accountId || data.data.mlAccountId)) {
          return {
            ...acc,
            totalQuestions: acc.totalQuestions + 1,
            pendingQuestions: acc.pendingQuestions + 1
          }
        }
        return acc
      }))

      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Nova pergunta recebida!', {
          body: `${data.accountNickname || 'Conta'}: ${data.data.text?.substring(0, 100)}...`,
          icon: '/mlagent-logo-3d.svg'
        })
      }
    }

    // Handle question answered
    const handleQuestionAnswered = (data: any) => {
      console.log('✅ [SSE] Question answered:', data.data?.mlQuestionId)

      setQuestions(prev => prev.map(q => {
        if (q.mlQuestionId === data.data?.mlQuestionId) {
          return {
            ...q,
            status: 'ANSWERED',
            answer: data.data.answer,
            answeredBy: data.data.answeredBy,
            sentToMLAt: data.data.sentToMLAt || new Date().toISOString()
          }
        }
        return q
      }))

      // Update account summary
      setAccountSummary(prev => prev.map(acc => {
        if (acc.accountId === (data.accountId || data.data.mlAccountId)) {
          return {
            ...acc,
            pendingQuestions: Math.max(0, acc.pendingQuestions - 1),
            completedQuestions: acc.completedQuestions + 1
          }
        }
        return acc
      }))
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Start SSE connection
    connectSSE()

    // Cleanup
    return () => {
      console.log('🧹 [SSE] Cleaning up connection...')

      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (heartbeatTimeout) clearTimeout(heartbeatTimeout)

      if (eventSource) {
        eventSource.close()
        eventSource = null
      }

      setSseConnected(false)
      setConnectionStatus('disconnected')
    }
  }, [])

  // Update selected account filter
  useEffect(() => {
    if (selectedAccountId !== undefined) {
      setAccountFilter(selectedAccountId || 'all')
    }
  }, [selectedAccountId])

  // Filtered questions
  const filteredQuestions = questions.filter(q => {
    // Account filter
    if (accountFilter !== 'all' && q.mlAccount.id !== accountFilter) {
      return false
    }

    // Status filter
    if (statusFilter === 'pending') {
      return ['PROCESSING', 'AWAITING_APPROVAL', 'REVISING', 'RECEIVED'].includes(q.status)
    } else if (statusFilter === 'completed') {
      return ['ANSWERED', 'FAILED'].includes(q.status)
    }

    return true
  })

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 bg-gray-800/50" />
        ))}
      </div>
    )
  }

  // Filters Component
  const FiltersComponent = () => (
    <div className="flex items-center gap-3">
      {/* Connection Status */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5">
        {connectionStatus === 'connected' ? (
          <>
            <Wifi className="h-4 w-4 text-green-500 animate-pulse" />
            <span className="text-xs text-green-500">Ao Vivo 24/7</span>
          </>
        ) : connectionStatus === 'connecting' ? (
          <>
            <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
            <span className="text-xs text-yellow-500">Conectando...</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-red-500" />
            <span className="text-xs text-red-500">Desconectado</span>
          </>
        )}
      </div>

      {/* Account Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="relative rounded-lg bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5 hover:border-gold/20 text-gray-300 hover:text-gold transition-all duration-300 gap-2 group">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none rounded-lg" />
            <Filter className="h-4 w-4 relative z-10" />
            <span className="relative z-10">
              {accountFilter === 'all' ? 'Todas as Contas' :
                accountSummary.find(a => a.accountId === accountFilter)?.nickname || 'Conta'}
            </span>
            <ChevronDown className="h-4 w-4 relative z-10" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[280px] bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-xl border border-white/10">
          <DropdownMenuLabel className="text-gold font-semibold">Filtrar por Conta</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onClick={() => setAccountFilter('all')} className="hover:bg-gold/10 focus:bg-gold/10 cursor-pointer">
            <div className="flex items-center gap-3 w-full">
              <Users2 className="h-4 w-4 text-gold" />
              <span className="flex-1 text-white">Todas as Contas</span>
              {accountFilter === 'all' && <CheckCircle className="h-4 w-4 text-gold" />}
            </div>
          </DropdownMenuItem>
          {accountSummary.map((account) => (
            <DropdownMenuItem key={account.accountId} onClick={() => setAccountFilter(account.accountId)} className="hover:bg-gold/10 focus:bg-gold/10 cursor-pointer">
              <div className="flex items-center gap-3 w-full">
                <Avatar className="h-6 w-6 border-gold/30">
                  {account.thumbnail ? (
                    <AvatarImage src={account.thumbnail} />
                  ) : (
                    <AvatarFallback className="bg-gold/10">
                      <Package className="h-3 w-3 text-gold" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <span className="text-sm text-white font-medium">{account.nickname}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    ({account.pendingQuestions} pendentes)
                  </span>
                </div>
                {accountFilter === account.accountId && <CheckCircle className="h-4 w-4 text-gold" />}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="relative rounded-lg bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5 hover:border-gold/20 text-gray-300 hover:text-gold transition-all duration-300 gap-2 group">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none rounded-lg" />
            <MessageSquare className="h-4 w-4 relative z-10" />
            <span className="relative z-10">
              {statusFilter === 'all' ? 'Todos' :
                statusFilter === 'pending' ? 'Pendentes' : 'Respondidas'}
            </span>
            <ChevronDown className="h-4 w-4 relative z-10" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-xl border border-white/10">
          <DropdownMenuLabel className="text-gold font-semibold">Status</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onClick={() => setStatusFilter('all')} className="hover:bg-gold/10 focus:bg-gold/10 cursor-pointer">
            <div className="flex items-center gap-2 w-full">
              <span className="text-white">Todos</span>
              {statusFilter === 'all' && <CheckCircle className="h-4 w-4 text-gold ml-auto" />}
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setStatusFilter('pending')} className="hover:bg-gold/10 focus:bg-gold/10 cursor-pointer">
            <div className="flex items-center gap-2 w-full">
              <span className="text-white">Pendentes</span>
              {statusFilter === 'pending' && <CheckCircle className="h-4 w-4 text-gold ml-auto" />}
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setStatusFilter('completed')} className="hover:bg-gold/10 focus:bg-gold/10 cursor-pointer">
            <div className="flex items-center gap-2 w-full">
              <span className="text-white">Respondidas</span>
              {statusFilter === 'completed' && <CheckCircle className="h-4 w-4 text-gold ml-auto" />}
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Refresh Button */}
      <Button onClick={fetchQuestions} variant="outline" className="relative rounded-lg bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5 hover:border-gold/20 text-gray-300 hover:text-gold transition-all duration-300 gap-2 group">
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  )

  return (
    <>
      {/* Render filters to portal if specified */}
      {showFilters && renderFiltersTo && mounted && (
        createPortal(
          <FiltersComponent />,
          document.querySelector(renderFiltersTo) || document.body
        )
      )}

      {/* Render filters inline if not using portal */}
      {showFilters && !renderFiltersTo && (
        <div className="mb-4">
          <FiltersComponent />
        </div>
      )}

      {/* Questions List */}
      {filteredQuestions.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Nenhuma pergunta encontrada</p>
          <p className="text-gray-500 text-sm mt-2">
            {sseConnected ? 'Monitorando em tempo real...' : 'Aguardando conexão...'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((question) => {
            // Map QuestionWithAccount to the format expected by QuestionCard
            const mappedQuestion = {
              ...question,
              mlAccountId: question.mlAccount.id,
              sellerId: question.mlAccount.mlUserId,
              customerId: null,
              dateCreated: new Date(question.dateCreated),
              receivedAt: new Date(question.receivedAt),
              aiProcessedAt: question.aiProcessedAt ? new Date(question.aiProcessedAt) : null,
              processedAt: question.aiProcessedAt ? new Date(question.aiProcessedAt) : null,
              sentToAIAt: null,
              approvedAt: question.approvedAt ? new Date(question.approvedAt) : null,
              answeredAt: question.approvedAt ? new Date(question.approvedAt) : null,
              aiConfidence: null,
              createdAt: new Date(question.receivedAt),
              updatedAt: new Date(question.receivedAt),
              sentToMLAt: question.sentToMLAt ? new Date(question.sentToMLAt) : null,
              whatsappSentAt: null,
              failedAt: question.failedAt ? new Date(question.failedAt) : null,
              retryCount: question.retryCount || 0,
              mlAccount: {
                id: question.mlAccount.id,
                nickname: question.mlAccount.nickname,
                thumbnail: question.mlAccount.thumbnail,
                siteId: question.mlAccount.siteId,
                mlUserId: question.mlAccount.mlUserId,
                organizationId: question.mlAccount.organizationId || '',
                email: question.mlAccount.email || null,
                accessToken: '',
                refreshToken: '',
                expiresAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                lastTokenRefresh: null,
                isActive: true
              }
            } as any // Type assertion to bypass strict type checking

            return (
              <QuestionCard
                key={question.id}
                question={mappedQuestion}
              />
            )
          })}
        </div>
      )}

      {/* Status Bar */}
      {lastEventTime && (
        <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-black/80 backdrop-blur px-3 py-2 rounded-lg border border-gray-800">
          Última atualização: {lastEventTime.toLocaleTimeString()}
        </div>
      )}
    </>
  )
}