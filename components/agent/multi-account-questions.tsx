'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { getValidAvatarUrl } from '@/lib/utils/avatar-utils'
import { useWebSocket } from '@/hooks/use-websocket'
import { useBrowserNotifications } from '@/hooks/use-browser-notifications'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { QuestionStatus } from '@/lib/constants/question-status'
import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  Check,
  User,
  Building2,
  Users
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { QuestionCard } from './question-card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { LevelUpModal } from '@/components/gamification/level-up-modal'
import { AchievementUnlockedModal } from '@/components/gamification/achievement-unlocked-modal'
import { XPEarnedToast } from '@/components/gamification/xp-earned-toast'

interface QuestionWithAccount {
  id: string
  mlQuestionId: string
  text: string
  itemTitle: string | null
  itemPrice: number
  itemId: string
  itemPermalink?: string | null
  itemThumbnail?: string | null
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
  mlAnswerId?: string | null // ID da resposta enviada ao ML
  mlAccount: {
    id: string
    mlUserId: string
    nickname: string
    thumbnail?: string | null
    siteId: string
    organizationId?: string // ✅ FIX: Adicionar para streaming funcionar
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

// 🚀 ENTERPRISE: Memoização para evitar re-renders desnecessários (componente mais pesado: 1270 linhas)
export const MultiAccountQuestions = memo(function MultiAccountQuestions({
  selectedAccountId,
  filterStatus = 'pending',
  showFilters = true,
  renderFiltersTo,
  pageKey = 'default'
}: Props) {
  // WebSocket connection
  const {
    isConnected,
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
  const [showErrorAnimation, setShowErrorAnimation] = useState(false)
  const [lastError, setLastError] = useState<{question: QuestionWithAccount | null, message: string} | null>(null)

  // 🎮 Gamification states
  const [showXPToast, setShowXPToast] = useState(false)
  const [xpToastData, setXPToastData] = useState<{xp: number, description: string}>({ xp: 0, description: '' })
  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const [levelUpData, setLevelUpData] = useState<any>(null)
  const [showAchievementModal, setShowAchievementModal] = useState(false)
  const [achievementData, setAchievementData] = useState<any>(null)

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

      // 🚀 ENTERPRISE FIX: Corrigir nome do campo da API
      const { questions: fetchedQuestions = [], accountSummary: accountsSummaryData = [] } = response

      // Atualizar estado com dados do banco
      setQuestions(fetchedQuestions)
      setAccountSummary(accountsSummaryData)

      logger.info('[Multi Questions] Data loaded', {
        questionsCount: fetchedQuestions.length,
        accountsCount: accountsSummaryData.length,
        accounts: accountsSummaryData.map((a: AccountSummary) => a.nickname)
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

      // 🔴 INLINE: Se pergunta foi respondida, remover da lista de pendentes após 4.5 segundos
      // Mesmo timing do handleQuestionAction para consistência
      if (status === 'RESPONDED' && statusFilter === 'pending') {
        setTimeout(() => {
          setQuestions(prev => prev.filter(q =>
            q.mlQuestionId !== questionId && q.id !== questionId
          ))
          logger.info('[Multi Questions] ✅ Pergunta aprovada removida da lista de pendentes (WebSocket)', {
            questionId
          })
        }, 4500) // 🎯 AUMENTADO: 4.5s = 4s de animação + 0.5s de margem para fade out suave
      }

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

    // 🎮 Handler para XP ganho (gamificação real-time)
    const handleXPEarned = (event: CustomEvent) => {
      const { xpAwarded, actionDescription, leveledUp, newLevel, oldLevel, achievementsUnlocked } = event.detail.data || {}

      logger.info('[Multi Questions] XP earned received', {
        xpAwarded,
        leveledUp,
        achievementsCount: achievementsUnlocked?.length || 0
      })

      // Mostrar toast de +XP
      if (xpAwarded > 0 && actionDescription) {
        setXPToastData({ xp: xpAwarded, description: actionDescription })
        setShowXPToast(true)

        // Vibração haptic
        try {
          if (navigator.vibrate) {
            navigator.vibrate([50, 30, 50])
          }
        } catch (e) {
          // Ignore
        }
      }

      // Mostrar modal de level up
      if (leveledUp && newLevel && oldLevel) {
        setTimeout(() => {
          setLevelUpData(event.detail.data)
          setShowLevelUpModal(true)
        }, 3500) // Delay para não sobrepor com toast
      }

      // Mostrar modais de achievements (um por vez)
      if (achievementsUnlocked && achievementsUnlocked.length > 0) {
        achievementsUnlocked.forEach((achievement: any, index: number) => {
          setTimeout(() => {
            setAchievementData(achievement)
            setShowAchievementModal(true)
          }, 6000 + (index * 6500)) // Delay progressivo
        })
      }

      // Refresh ranking data após XP ganho
      setTimeout(() => {
        // Dispatch event para refresh do dashboard de gamificação
        window.dispatchEvent(new CustomEvent('gamification:refresh'))
      }, 1000)
    }

    // Add event listeners
    window.addEventListener('websocket:question:new' as any, handleNewQuestion)
    window.addEventListener('websocket:question:updated' as any, handleQuestionUpdate)
    window.addEventListener('websocket:question:error' as any, handleQuestionError)
    window.addEventListener('websocket:question:revision-error' as any, handleRevisionError)
    window.addEventListener('websocket:question:answer-edited' as any, handleAnswerEdited)
    window.addEventListener('websocket:questions:initial' as any, handleInitialQuestions)
    window.addEventListener('websocket:xp:earned' as any, handleXPEarned) // 🎮 XP events

    // Cleanup
    return () => {
      window.removeEventListener('websocket:question:new' as any, handleNewQuestion)
      window.removeEventListener('websocket:question:updated' as any, handleQuestionUpdate)
      window.removeEventListener('websocket:question:error' as any, handleQuestionError)
      window.removeEventListener('websocket:question:revision-error' as any, handleRevisionError)
      window.removeEventListener('websocket:question:answer-edited' as any, handleAnswerEdited)
      window.removeEventListener('websocket:questions:initial' as any, handleInitialQuestions)
      window.removeEventListener('websocket:xp:earned' as any, handleXPEarned) // 🎮 XP events
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, fetchQuestions, hasPermission, sendQuestionNotification]) // Removed 'questions' from deps to prevent infinite loop

  // 🚀 OTIMIZAÇÃO ENTERPRISE: Polling apenas como fallback de emergência (WebSocket disconnected)
  // Real-time updates vêm via WebSocket, polling só para reconexão
  useEffect(() => {
    if (!mounted || isConnected) return // Só fazer polling se WebSocket estiver desconectado

    const interval = setInterval(() => {
      if (!isFetchingRef.current) {
        logger.info('[Multi Questions] Emergency fallback refresh (WebSocket disconnected)')
        fetchQuestions(false)
      }
    }, 300000) // 5 minutos (apenas fallback de emergência)

    return () => clearInterval(interval)
  }, [mounted, isConnected, fetchQuestions])

  // 🔴 FIX CRÍTICO: Reconciliação banco vs WebSocket
  // Sincroniza dados do banco com estado React para perguntas em processamento
  useEffect(() => {
    if (!mounted || !isConnected) return

    const reconcile = setInterval(async () => {
      // Buscar apenas perguntas em estado transitório (que podem mudar)
      const transitionQuestions = questions.filter(q =>
        ['PROCESSING', 'REVISING', 'APPROVED', 'REVIEWING'].includes(q.status)
      )

      if (transitionQuestions.length === 0) return

      logger.debug('[Multi Questions] Reconciling with database', {
        count: transitionQuestions.length,
        statuses: transitionQuestions.map(q => q.status)
      })

      try {
        // Re-fetch apenas essas perguntas específicas
        const ids = transitionQuestions.map(q => q.id)
        const response = await apiClient.get(`/api/agent/questions-by-ids?ids=${ids.join(',')}`)

        if (response && response.questions) {
          // Atualizar apenas perguntas que mudaram
          setQuestions(prev => prev.map(q => {
            const updated = response.questions.find((uq: any) => uq.id === q.id)
            if (!updated) return q

            // Se status ou aiSuggestion mudou, atualizar
            if (updated.status !== q.status || updated.aiSuggestion !== q.aiSuggestion) {
              logger.info('[Multi Questions] Reconciliation: question updated', {
                questionId: q.mlQuestionId,
                oldStatus: q.status,
                newStatus: updated.status,
                hadAiSuggestion: !!q.aiSuggestion,
                hasAiSuggestion: !!updated.aiSuggestion
              })
              return { ...q, ...updated }
            }

            return q
          }))
        }
      } catch (error) {
        logger.error('[Multi Questions] Reconciliation error', { error })
      }
    }, 30000) // A cada 30 segundos

    return () => clearInterval(reconcile)
  }, [mounted, isConnected, questions, apiClient])

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
        // 🚀 ENTERPRISE: Optimistic update APENAS com confirmação do ML
        setQuestions(prev => prev.map(q => {
          if (q.id === questionId) {
            if (action === 'edit') {
              // Para edição, apenas atualizar a resposta e manter status AWAITING_APPROVAL
              return {
                ...q,
                status: 'AWAITING_APPROVAL',
                aiSuggestion: data?.answer || q.aiSuggestion
              } as QuestionWithAccount
            } else if (action === 'approve') {
              // ✅ CRITICAL: Para aprovação, SÓ marcar RESPONDED se tiver mlAnswerId
              // Sem mlAnswerId = envio falhou ou em processamento
              const hasMLConfirmation = response.mlAnswerId
              return {
                ...q,
                status: hasMLConfirmation ? 'RESPONDED' : 'APPROVED', // APPROVED = enviando ao ML
                answer: data?.answer || q.answer,
                approvedAt: new Date().toISOString(),
                approvalType: 'MANUAL',
                mlAnswerId: response.mlAnswerId || q.mlAnswerId
              } as QuestionWithAccount
            } else {
              // Para revisão
              return {
                ...q,
                status: 'REVIEWING',
                answer: data?.answer || q.answer
              } as QuestionWithAccount
            }
          }
          return q
        }))

        // ✅ APROVAÇÃO BEM-SUCEDIDA: Remover card após animação inline
        // Verificar: success=true E mlAnswerId presente (confirmação do ML)
        if (action === 'approve' && response.mlAnswerId) {
          // 🎯 CRITICAL: Remover card da lista após animação inline de sucesso (4.5 segundos)
          // A animação inline (ApprovalAnimation) é mostrada por 4s no QuestionCard
          // Aguardar 4.5s para garantir que a animação complete antes de remover
          setTimeout(() => {
            setQuestions(prev => prev.filter(q => q.id !== questionId))
            logger.info('[Multi Questions] Card removed from pending list after approval', {
              questionId
            })
          }, 4500) // 🎯 AUMENTADO: 4.5s = 4s de animação + 0.5s de margem para fade out suave
        }

        // Se for aprovação mas SEM mlAnswerId, não mostrar sucesso (pode ser erro silencioso)
        if (action === 'approve' && !response.mlAnswerId && response.success) {
          logger.warn('[Multi Questions] Approval returned success but no mlAnswerId', {
            questionId,
            response
          })
        }
      } else {
        // ❌ ERRO: Falha ao enviar ao ML
        if (action === 'approve') {
          const failedQuestion = questions.find(q => q.id === questionId)
          if (failedQuestion) {
            const errorMessage = response.error ||
              (response.isRateLimit ? 'Rate limit do Mercado Livre atingido. Aguarde alguns minutos.' :
              'Falha ao enviar resposta ao Mercado Livre')

            setLastError({
              question: failedQuestion,
              message: errorMessage
            })
            setShowErrorAnimation(true)
            setTimeout(() => {
              setShowErrorAnimation(false)
              setLastError(null)
            }, 4000)

            // Também mostrar toast com opção de retry
            toast.error('Erro ao enviar resposta', {
              description: errorMessage,
              duration: 6000,
              action: response.canRetry ? {
                label: 'Tentar novamente',
                onClick: () => handleQuestionAction(questionId, action, data)
              } : undefined
            })
          }
        }
      }

      return response
    } catch (error) {
      logger.error('[Multi Questions] Error processing action:', { error, action, questionId })

      // Mostrar erro visual para aprovações
      if (action === 'approve') {
        const failedQuestion = questions.find(q => q.id === questionId)
        if (failedQuestion) {
          setLastError({
            question: failedQuestion,
            message: 'Erro de conexão. Verifique sua internet e tente novamente.'
          })
          setShowErrorAnimation(true)
          setTimeout(() => {
            setShowErrorAnimation(false)
            setLastError(null)
          }, 4000)
        }
      }

      toast.error('Erro ao processar ação', {
        description: 'Tente novamente em alguns instantes'
      })
      throw error
    }
  }


  // 🚀 ENTERPRISE-GRADE: Filtros com lógica de negócio perfeita
  const filteredQuestions = questions.filter(q => {
    // Filtro de status
    if (statusFilter === 'pending') {
      // ✅ PENDENTES: Perguntas ANTES de serem APROVADAS pelo usuário
      // = Tudo que ainda precisa de AÇÃO do vendedor na plataforma
      // Inclui: RECEIVED, PROCESSING, AWAITING_APPROVAL, REVIEWING, REVISING, FAILED, ERROR, TIMEOUT
      // EXCLUI: RESPONDED, COMPLETED, SENT_TO_ML, APPROVED (já aprovadas/enviadas)
      const pendingStatuses = [
        'RECEIVED',        // Recebida do ML, ainda não processada
        'PROCESSING',      // Sendo processada pela IA
        'AWAITING_APPROVAL', // IA respondeu, aguardando aprovação do usuário
        'REVIEWING',       // Usuário pediu revisão
        'REVISING',        // IA está revisando
        'FAILED',          // Falhou no processamento
        'ERROR',           // Erro genérico
        'TIMEOUT',         // Timeout no processamento
        'PENDING'          // Status genérico de pendente
      ]

      const isPending = pendingStatuses.includes(q.status)
      if (!isPending) {
        return false
      }
    } else if (statusFilter === 'completed') {
      // ✅ COMPLETADAS: Perguntas já ENVIADAS e CONFIRMADAS pelo Mercado Livre
      // = Perguntas que já foram respondidas com sucesso (com mlAnswerId)
      const completedStatuses = ['RESPONDED', 'COMPLETED', 'SENT_TO_ML', 'APPROVED']
      const isCompleted = completedStatuses.includes(q.status)
      if (!isCompleted) {
        return false
      }
    }
    // 'all' = TODAS as perguntas (sem filtro de status)

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

  // Componente de Filtros - Design PREMIUM 2025 Mobile-First + Layout Responsivo
  const FiltersComponent = () => {
    const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false)
    const dropdownButtonRef = useRef<HTMLButtonElement>(null)
    const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom')

    // Get selected account info
    const selectedAccount = accountSummary.find(acc => acc.accountId === accountFilter)
    const totalPending = accountSummary.reduce((sum, acc) => sum + acc.pendingQuestions, 0)

    // 🎯 MOBILE-FIRST: Calcular posição ideal do dropdown para não cortar na tela
    useEffect(() => {
      if (isAccountDropdownOpen && dropdownButtonRef.current) {
        const buttonRect = dropdownButtonRef.current.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const spaceBelow = viewportHeight - buttonRect.bottom
        const dropdownEstimatedHeight = Math.min(280, accountSummary.length * 48 + 100)

        // Se não tiver espaço embaixo, abre para cima
        if (spaceBelow < dropdownEstimatedHeight && buttonRect.top > dropdownEstimatedHeight) {
          setDropdownPosition('top')
        } else {
          setDropdownPosition('bottom')
        }
      }
    }, [isAccountDropdownOpen, accountSummary.length])

    return (
      <div className="w-full" role="region" aria-label="Filtros de perguntas">
        {/* 🎯 MOBILE: 3 botões ultra compactos | DESKTOP: Layout original */}
        <div className="flex flex-col gap-2">
          {/* 📱 Mobile: Visual Premium - SEMPRE VISÍVEIS */}
          <div className="flex sm:hidden relative items-center bg-black/40 backdrop-blur-2xl p-1 gap-1 rounded-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none h-10">
            {/* Botão Pendentes - Premium */}
            <button
              onClick={() => setStatusFilter('pending')}
              aria-pressed={statusFilter === 'pending'}
              aria-label="Pendentes"
              className={`relative z-10 flex items-center justify-center gap-1 px-3 h-full rounded-lg text-[10px] font-medium transition-all duration-300 whitespace-nowrap flex-shrink-0 min-w-[70px] border border-transparent ${
                statusFilter === 'pending'
                  ? 'text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.03] active:scale-[0.98]'
              }`}
            >
              <MessageSquare className={`w-2.5 h-2.5 flex-shrink-0 transition-all duration-300 ${statusFilter === 'pending' ? 'text-gold' : 'opacity-60'}`} strokeWidth={2.5} />
              <span className="font-semibold tracking-wide">Pend.</span>
            </button>

            {/* Botão Todas - Premium */}
            <button
              onClick={() => setStatusFilter('all')}
              aria-pressed={statusFilter === 'all'}
              aria-label="Todas"
              className={`relative z-10 flex items-center justify-center gap-1 px-3 h-full rounded-lg text-[10px] font-medium transition-all duration-300 whitespace-nowrap flex-shrink-0 min-w-[70px] border border-transparent ${
                statusFilter === 'all'
                  ? 'text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.03] active:scale-[0.98]'
              }`}
            >
              <CheckCircle className={`w-2.5 h-2.5 flex-shrink-0 transition-all duration-300 ${statusFilter === 'all' ? 'text-gold' : 'opacity-60'}`} strokeWidth={2.5} />
              <span className="font-semibold tracking-wide">Todas</span>
            </button>

            {/* Botão Todas as Contas - Minimalista */}
            <div className="relative flex-1 min-w-0 overflow-hidden">
              <button
                ref={dropdownButtonRef}
                onClick={() => accountSummary.length > 0 && setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                disabled={accountSummary.length === 0}
                className={`group relative z-10 flex items-center justify-center gap-1.5 px-2 lg:px-3 h-full rounded-lg text-[10px] lg:text-xs font-medium transition-all duration-300 w-full min-w-0 border border-transparent ${
                  accountSummary.length === 0
                    ? 'opacity-50 cursor-not-allowed text-gray-500'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.03] active:scale-95'
                }`}
              >
                <div className="flex items-center gap-1 min-w-0 max-w-full justify-center overflow-hidden">
                  {accountSummary.length === 0 ? (
                    <Users className="w-3 h-3 text-gray-500 flex-shrink-0 transition-all duration-300 opacity-60" strokeWidth={2.5} />
                  ) : accountFilter === 'all' ? (
                    <>
                      {/* Mobile: só ícone | Desktop: ícone + texto */}
                      <Users className="w-3 h-3 lg:w-3.5 lg:h-3.5 flex-shrink-0 transition-all duration-300 text-gold/70 group-hover:text-gold" strokeWidth={2.5} />
                      <span className="hidden lg:inline font-semibold tracking-wide truncate">Contas</span>
                    </>
                  ) : selectedAccount ? (
                    <>
                      <Avatar className="h-4 w-4 lg:h-4.5 lg:w-4.5 ring-1 ring-gold/20 flex-shrink-0">
                        {getValidAvatarUrl(selectedAccount.thumbnail) ? (
                          <AvatarImage
                            src={getValidAvatarUrl(selectedAccount.thumbnail) || ''}
                            alt=""
                            className="object-cover"
                          />
                        ) : (
                          <AvatarFallback className="bg-gradient-to-br from-gold/20 to-gold/10">
                            <User className="h-2 w-2 text-gold" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <span className="hidden lg:inline font-semibold tracking-wide truncate text-[10px]">{selectedAccount.nickname.substring(0, 10)}</span>
                    </>
                  ) : null}
                  {accountSummary.length > 0 && (
                    <ChevronDown
                      className={`w-3 h-3 lg:w-3.5 lg:h-3.5 text-gold/60 transition-all duration-300 flex-shrink-0 ${
                        isAccountDropdownOpen ? 'rotate-180 text-gold' : 'group-hover:text-gold'
                      }`}
                      strokeWidth={2.5}
                    />
                  )}
                </div>
              </button>

              {/* Dropdown Menu - Mobile - ULTRA RESPONSIVO E MINIMALISTA */}
              {isAccountDropdownOpen && accountSummary.length > 0 && (
                <>
                  {/* Backdrop SEM blur - Performance otimizada */}
                  <div
                    className="fixed inset-0 z-[60] bg-black/30 animate-in fade-in-0 duration-150"
                    onClick={() => setIsAccountDropdownOpen(false)}
                  />

                  {/* Dropdown Content - Compacto e Leve */}
                  <div
                    className={`fixed sm:absolute z-[70]
                      ${dropdownPosition === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1'}
                      left-0 right-0 mx-2 sm:mx-0 sm:left-0 sm:right-0
                      bg-gradient-to-br from-gray-900/95 via-black/98 to-gray-900/95
                      backdrop-blur-xl border border-white/10 rounded-lg
                      shadow-xl overflow-hidden
                      animate-in ${dropdownPosition === 'bottom' ? 'slide-in-from-top-1' : 'slide-in-from-bottom-1'}
                      fade-in-0 duration-150`}
                    style={{
                      // 🎯 MOBILE: Altura máxima compacta
                      maxHeight: 'min(240px, 55vh)',
                      maxWidth: 'calc(100vw - 16px)'
                    }}
                  >
                    {/* Glow Effect Minimalista */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

                    {/* Scroll Container Otimizado */}
                    <div
                      className="relative overflow-y-auto overscroll-contain"
                      style={{
                        WebkitOverflowScrolling: 'touch',
                        maxHeight: 'min(220px, calc(55vh - 20px))',
                        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
                      }}
                    >
                      <div className="p-1.5 space-y-0.5">
                        {/* Todas as contas - Ultra Compacto e Inline */}
                        <button
                          onClick={() => {
                            setAccountFilter('all')
                            setIsAccountDropdownOpen(false)
                          }}
                          className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left transition-all duration-150 active:scale-[0.98] ${
                            accountFilter === 'all'
                              ? 'bg-gradient-to-r from-gold/20 via-gold/10 to-gold/5 border border-gold/30 text-white'
                              : 'hover:bg-white/5 active:bg-white/10 text-gray-300'
                          }`}
                        >
                          <Building2 className="w-3 h-3 flex-shrink-0" />
                          <span className="text-[11px] font-semibold flex-1 whitespace-nowrap">Todas as contas</span>
                          {accountFilter === 'all' && (
                            <Check className="w-3 h-3 text-gold flex-shrink-0" />
                          )}
                          {totalPending > 0 && accountFilter !== 'all' && (
                            <span className="px-1 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-bold flex-shrink-0">
                              {totalPending}
                            </span>
                          )}
                        </button>

                        {/* Separator Minimalista */}
                        <div className="my-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                        {/* Contas individuais - Ultra Compacto */}
                        {accountSummary.map(account => {
                          const accountImage = getValidAvatarUrl(account.thumbnail)
                          const isSelected = accountFilter === account.accountId

                          return (
                            <button
                              key={account.accountId}
                              onClick={() => {
                                setAccountFilter(account.accountId)
                                setIsAccountDropdownOpen(false)
                              }}
                              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-all duration-150 active:scale-[0.98] ${
                                isSelected
                                  ? 'bg-gradient-to-r from-gold/20 via-gold/10 to-gold/5 border border-gold/30'
                                  : 'hover:bg-white/5 active:bg-white/10'
                              }`}
                            >
                              {/* Avatar compacto */}
                              <Avatar className={`h-6 w-6 ring-1 flex-shrink-0 ${isSelected ? 'ring-gold/50' : 'ring-white/10'}`}>
                                {accountImage ? (
                                  <AvatarImage
                                    src={accountImage}
                                    alt={account.nickname}
                                    className="object-cover"
                                  />
                                ) : (
                                  <AvatarFallback className="bg-gradient-to-br from-gray-700 to-gray-800">
                                    <User className="h-3 w-3" />
                                  </AvatarFallback>
                                )}
                              </Avatar>

                              {/* Nome da conta */}
                              <span className={`text-xs font-semibold flex-1 truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                {account.nickname}
                              </span>

                              {/* Check mark */}
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                              )}

                              {/* Badge de pendentes */}
                              {account.pendingQuestions > 0 && !isSelected && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold flex-shrink-0">
                                  {account.pendingQuestions}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Indicador de scroll (se houver mais contas) */}
                    {accountSummary.length > 5 && (
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 🖥️ Desktop/Tablet: Visual Premium Matching Mobile */}
          <div className="hidden sm:flex items-center bg-black/40 backdrop-blur-2xl p-1 sm:p-1.5 gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] before:absolute before:inset-0 before:rounded-xl sm:before:rounded-2xl before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:pointer-events-none after:absolute after:inset-0 after:rounded-xl sm:after:rounded-2xl after:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] after:pointer-events-none relative h-11 md:h-12">
            {/* Botão Pendentes - Desktop/Tablet */}
            <button
              onClick={() => setStatusFilter('pending')}
              aria-pressed={statusFilter === 'pending'}
              aria-label="Mostrar apenas perguntas pendentes"
              className={`group relative z-10 flex items-center justify-center gap-1.5 px-4 md:px-5 lg:px-6 h-full rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap border border-transparent ${
                statusFilter === 'pending'
                  ? 'text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.03] active:scale-[0.98]'
              }`}
            >
              <MessageSquare className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 transition-all duration-300 ${statusFilter === 'pending' ? 'text-gold' : 'opacity-60 group-hover:opacity-100'}`} strokeWidth={2.5} />
              <span className="font-semibold tracking-wide">Pendentes</span>
            </button>

            {/* Botão Todas - Desktop/Tablet */}
            <button
              onClick={() => setStatusFilter('all')}
              aria-pressed={statusFilter === 'all'}
              aria-label="Mostrar todas as perguntas"
              className={`group relative z-10 flex items-center justify-center gap-1.5 px-4 md:px-5 lg:px-6 h-full rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap border border-transparent ${
                statusFilter === 'all'
                  ? 'text-white bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-[0_0_24px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] border-gold/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.03] active:scale-[0.98]'
              }`}
            >
              <CheckCircle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 transition-all duration-300 ${statusFilter === 'all' ? 'text-gold' : 'opacity-60 group-hover:opacity-100'}`} strokeWidth={2.5} />
              <span className="font-semibold tracking-wide">Todas</span>
            </button>

            {/* Botão Todas as Contas - Desktop/Tablet */}
            <div className="relative">
              <button
                ref={dropdownButtonRef}
                onClick={() => accountSummary.length > 0 && setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                disabled={accountSummary.length === 0}
                className={`group relative z-10 flex items-center gap-2 px-3 sm:px-4 h-full rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap border border-transparent ${
                  accountSummary.length === 0
                    ? 'opacity-50 cursor-not-allowed text-gray-500'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {accountSummary.length === 0 ? (
                  <>
                    <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold text-gray-500 truncate tracking-wide">
                      Sem contas
                    </span>
                  </>
                ) : accountFilter === 'all' ? (
                  <>
                    <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 transition-all duration-300 opacity-60 group-hover:opacity-100" />
                    <span className="text-xs sm:text-sm font-semibold tracking-wide truncate">
                      Contas
                    </span>
                  </>
                ) : selectedAccount ? (
                  <>
                    <Avatar className="h-4 w-4 sm:h-5 sm:w-5 ring-1 ring-white/10 flex-shrink-0">
                      {getValidAvatarUrl(selectedAccount.thumbnail) ? (
                        <AvatarImage
                          src={getValidAvatarUrl(selectedAccount.thumbnail) || ''}
                          alt=""
                          className="object-cover"
                        />
                      ) : (
                        <AvatarFallback className="bg-gradient-to-br from-gray-700 to-gray-800">
                          <User className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <span className="text-xs sm:text-sm font-semibold text-white truncate tracking-wide">
                      {selectedAccount.nickname}
                    </span>
                  </>
                ) : null}
              </div>
              {accountSummary.length > 0 && (
                <ChevronDown
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${
                    isAccountDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              )}
              </button>

              {/* Dropdown Menu - Desktop Otimizado */}
              {isAccountDropdownOpen && accountSummary.length > 0 && (
                <>
                  {/* Backdrop com blur suave */}
                  <div
                    className="fixed inset-0 z-[60] bg-black/10 backdrop-blur-sm animate-in fade-in-0 duration-200"
                    onClick={() => setIsAccountDropdownOpen(false)}
                  />

                  {/* Dropdown Content - Alinhado à Esquerda */}
                  <div className={`absolute z-[70]
                    ${dropdownPosition === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'}
                    right-0 left-auto min-w-[260px]
                    bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98
                    backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl shadow-black/30 overflow-hidden
                    animate-in ${dropdownPosition === 'bottom' ? 'slide-in-from-top-2' : 'slide-in-from-bottom-2'}
                    fade-in-0 duration-200`}
                    style={{
                      maxHeight: 'min(360px, 70vh)'
                    }}
                  >
                    {/* Glow Effect Suave */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/8 via-transparent to-gold/8 opacity-40 pointer-events-none" />

                    {/* Scroll Container */}
                    <div
                      className="relative overflow-y-auto custom-scrollbar"
                      style={{ maxHeight: 'min(340px, calc(70vh - 20px))' }}
                    >
                      <div className="p-2 space-y-1">
                        {/* Todas as contas - Desktop */}
                        <button
                          onClick={() => {
                            setAccountFilter('all')
                            setIsAccountDropdownOpen(false)
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-200 active:scale-[0.98] ${
                            accountFilter === 'all'
                              ? 'bg-gradient-to-r from-gold/25 via-gold/15 to-gold/5 border border-gold/40 text-white shadow-lg shadow-gold/10'
                              : 'hover:bg-white/5 active:bg-white/10 text-gray-300'
                          }`}
                        >
                          <Building2 className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm font-semibold flex-1">Todas as contas</span>
                          {accountFilter === 'all' && (
                            <Check className="w-4 h-4 text-gold flex-shrink-0" />
                          )}
                          {totalPending > 0 && accountFilter !== 'all' && (
                            <span className="px-1.5 py-1 rounded-md bg-gray-700 text-gray-200 text-[10px] font-bold">
                              {totalPending}
                            </span>
                          )}
                        </button>

                        {/* Separator Premium */}
                        <div className="my-1.5 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                        {/* Contas individuais - Desktop */}
                        {accountSummary.map(account => {
                          const accountImage = getValidAvatarUrl(account.thumbnail)
                          const isSelected = accountFilter === account.accountId

                          return (
                            <button
                              key={account.accountId}
                              onClick={() => {
                                setAccountFilter(account.accountId)
                                setIsAccountDropdownOpen(false)
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-200 active:scale-[0.98] ${
                                isSelected
                                  ? 'bg-gradient-to-r from-gold/25 via-gold/15 to-gold/5 border border-gold/40 shadow-lg shadow-gold/10'
                                  : 'hover:bg-white/5 active:bg-white/10'
                              }`}
                            >
                              {/* Avatar */}
                              <Avatar className={`h-6 w-6 ring-2 flex-shrink-0 ${isSelected ? 'ring-gold/50' : 'ring-white/10'}`}>
                                {accountImage ? (
                                  <AvatarImage
                                    src={accountImage}
                                    alt={account.nickname}
                                    className="object-cover"
                                  />
                                ) : (
                                  <AvatarFallback className="bg-gradient-to-br from-gray-700 to-gray-800">
                                    <User className="h-3 w-3" />
                                  </AvatarFallback>
                                )}
                              </Avatar>

                              {/* Nome da conta */}
                              <span className={`text-sm font-semibold flex-1 truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                {account.nickname}
                              </span>

                              {/* Check mark */}
                              {isSelected && (
                                <Check className="w-4 h-4 text-gold flex-shrink-0" />
                              )}

                              {/* Badge de pendentes */}
                              {account.pendingQuestions > 0 && !isSelected && (
                                <span className="px-1.5 py-1 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold flex-shrink-0 shadow-md">
                                  {account.pendingQuestions}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Indicador de scroll (se houver mais contas) */}
                    {accountSummary.length > 6 && (
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render principal
  return (
    <>
      {/* ✅ REMOVIDO: Animação fullscreen - Agora inline no card */}

      {/* ❌ Animação de Erro - Feedback Visual Premium */}
      {showErrorAnimation && lastError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          {/* Backdrop suave */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
            className="relative bg-gradient-to-br from-gray-900/95 via-black/95 to-gray-900/95 backdrop-blur-xl rounded-2xl border border-red-500/30 p-6 shadow-2xl shadow-red-500/20 max-w-sm mx-4"
          >
            {/* Glow Effect - Vermelho */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-orange-500/10 rounded-2xl opacity-50 pointer-events-none" />

            <div className="relative flex flex-col items-center gap-5 text-center">
              {/* Logo ML Agent com tom de erro */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/40 to-orange-500/40 rounded-full blur-[40px] scale-[1.5] animate-pulse" />
                <Image
                  src="/mlagent-logo-3d.png"
                  alt="ML Agent"
                  width={56}
                  height={56}
                  className="relative drop-shadow-2xl opacity-90"
                  style={{
                    filter: 'drop-shadow(0 15px 40px rgba(239, 68, 68, 0.3)) grayscale(20%)',
                  }}
                  priority
                />
              </div>

              {/* Ícone de Erro */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, duration: 0.5, type: 'spring' }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/40 to-orange-500/40 rounded-full blur-xl" />
                <div className="relative bg-gradient-to-br from-red-600/30 to-orange-600/30 rounded-full p-3 border border-red-500/60 backdrop-blur-sm">
                  <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </motion.div>

              {/* Mensagem de Erro */}
              <div className="space-y-2.5">
                <h3 className="text-xl font-semibold text-red-400">
                  Falha no Envio
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {lastError.message}
                </p>
                {lastError.question && (
                  <p className="text-xs text-gray-500 mt-2">
                    Pergunta #{lastError.question.sequentialId || 'N/A'} - {lastError.question.mlAccount.nickname}
                  </p>
                )}
                <div className="mt-3 px-3 py-2 rounded-lg bg-gradient-to-br from-orange-900/20 to-red-900/20 border border-orange-500/30">
                  <p className="text-xs text-orange-300/90 font-medium">
                    💡 Tente novamente em alguns instantes
                  </p>
                </div>
              </div>

              {/* Progress Bar Animation - Vermelho */}
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3.5, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-red-500"
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


      {/* Questions List - Mobile-First Premium */}
      <div className="space-y-3 sm:space-y-4">

        {/* Empty State - Mobile Optimized */}
        {filteredQuestions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center py-8 sm:py-12 px-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 text-gray-600 mx-auto mb-3 sm:mb-4" />
            </motion.div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-300 mb-1.5 sm:mb-2">
              Nenhuma pergunta encontrada
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
              {statusFilter === 'pending'
                ? 'Não há perguntas pendentes no momento'
                : 'Ajuste os filtros para ver mais resultados'}
            </p>
            {isConnected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-center gap-2 mt-3 sm:mt-4"
              >
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-[10px] sm:text-xs text-emerald-400 font-medium">
                  Novas perguntas aparecerão automaticamente
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Questions Cards - AnimatePresence para animações suaves */}
        <AnimatePresence mode="popLayout">
          {paginatedQuestions.map((question) => {
            // 🎯 CRITICAL: Card é removido do array após 2.5s (tempo da animação de aprovação)
            // AnimatePresence detecta a remoção e aplica exit animation automaticamente
            return (
              <motion.div
                key={question.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  height: 'auto'
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                  y: -20,
                  height: 0,
                  marginBottom: 0,
                  transition: {
                    duration: 0.6,
                    ease: [0.4, 0, 0.2, 1],
                    opacity: { duration: 0.3 },
                    scale: { duration: 0.4 },
                    y: { duration: 0.4 },
                    height: { duration: 0.5, delay: 0.1 }
                  }
                }}
                transition={{
                  layout: {
                    duration: 0.5,
                    ease: [0.4, 0, 0.2, 1]
                  },
                  opacity: { duration: 0.5 },
                  y: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
                  scale: { duration: 0.6, type: 'spring', stiffness: 200, damping: 25 },
                  height: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
                }}
                className="will-change-transform"
              >
                <QuestionCard
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
                    const result = await handleQuestionAction(question.id, 'approve', { answer })
                    // Retornar resultado para QuestionCard poder mostrar feedback apropriado
                    return result
                  }}
                  onEdit={async (answer) => {
                    await handleQuestionAction(question.id, 'edit', { answer })
                  }}
                />
              </motion.div>
            )
          })}
        </AnimatePresence>

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

      {/* 🎮 Gamification Modals & Toasts */}
      <XPEarnedToast
        isVisible={showXPToast}
        onClose={() => setShowXPToast(false)}
        xpAmount={xpToastData.xp}
        actionDescription={xpToastData.description}
      />

      {levelUpData && (
        <LevelUpModal
          isOpen={showLevelUpModal}
          onClose={() => setShowLevelUpModal(false)}
          oldLevel={levelUpData.oldLevel}
          newLevel={levelUpData.newLevel}
          levelName={levelUpData.levelName || 'Novo Nível'}
          levelEmoji={levelUpData.levelEmoji || '🎉'}
          levelColor={levelUpData.levelColor || 'from-gold to-yellow-500'}
          totalXP={levelUpData.newTotalXP || 0}
          characterEvolved={levelUpData.characterEvolved}
          oldCharacter={levelUpData.oldCharacter}
          newCharacter={levelUpData.newCharacter}
        />
      )}

      {achievementData && (
        <AchievementUnlockedModal
          isOpen={showAchievementModal}
          onClose={() => setShowAchievementModal(false)}
          achievement={achievementData}
        />
      )}
    </>
  )
})