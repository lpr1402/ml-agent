'use client'

// ML Agent PRO - Página de Aprovação Única
// Sistema de aprovação segura com PIN para respostas do Mercado Livre
// Setembro 2025 - Production Ready

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  Edit2,
  MessageSquare,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Lock,
  Loader2,
  User,
  ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { logger } from '@/lib/logger'
import { toast } from '@/hooks/use-toast'
import { PremiumLoader } from '@/components/ui/premium-loader'
import io, { Socket } from 'socket.io-client'

interface Question {
  id: string
  mlQuestionId: string
  text: string
  aiSuggestion: string | null
  answer: string | null
  status: string
  itemTitle: string | null
  itemId: string | null
  itemPermalink: string | null
  itemThumbnail: string | null
  itemPrice: number | null
  customerName: string | null
  dateCreated: string
  mlAccount: {
    nickname: string
    thumbnail: string | null
  }
}

// Componente do PIN com design premium mobile-first para iPhone
const PinScreen = ({ onSuccess, loading, error }: { onSuccess: (pin: string) => void, loading: boolean, error: boolean }) => {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Focar no primeiro input
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (error) {
      setShake(true)
      setPin('')
      inputRefs.current[0]?.focus()
      setTimeout(() => setShake(false), 500)
    }
  }, [error])

  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) return

    const newPin = pin.split('')
    newPin[index] = value
    const updatedPin = newPin.join('')
    setPin(updatedPin)

    // Auto-avançar para próximo campo
    if (value && index < 2) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submeter quando completar
    if (updatedPin.length === 3 && index === 2) {
      onSuccess(updatedPin)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center">
      {/* Background Pattern - Matching /agente page */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-72 h-72 md:w-96 md:h-96 bg-gold/3 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 md:w-96 md:h-96 bg-yellow-500/3 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm mx-4"
      >
        <Card className="bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-2xl overflow-hidden">
          {/* Background Glow - Matching account badge from /agente */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

          <div className="relative p-6 md:p-8 space-y-6">
            {/* Logo/Header - Matching /agente header exactly */}
            <div className="text-center space-y-6">
              {/* ML Agent Logo - Same as /agente */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-gold/20 blur-xl rounded-full" />
                  <Image
                    src="/mlagent-logo-3d.svg"
                    alt="ML Agent"
                    width={80}
                    height={80}
                    className="relative h-20 w-auto object-contain hover:scale-105 transition-transform duration-500 drop-shadow-2xl"
                    style={{
                      filter: 'drop-shadow(0 0 20px rgba(255, 230, 0, 0.2))'
                    }}
                    priority
                  />
                </div>
              </div>

              {/* Brand Text - Matching /agente */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-light text-white tracking-wide">
                    ML Agent
                  </h1>
                  <span className="text-2xl md:text-3xl font-bold italic bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent tracking-wider pr-2">
                    PRO
                  </span>
                </div>
                <p className="text-sm text-gray-400 font-medium">
                  Acesso exclusivo para aprovação
                </p>
              </div>
            </div>

            {/* PIN Input - Mobile optimized */}
            <div className="space-y-4 md:space-y-6">
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/10 to-yellow-500/5 border border-gold/20 flex items-center justify-center mx-auto mb-2">
                  <Lock className="h-5 w-5 text-gold" />
                </div>
                <label className="text-sm text-gray-300 font-medium">
                  Digite o PIN de segurança
                </label>
              </div>

              <div className={`flex justify-center gap-3 px-4 ${shake ? 'animate-shake' : ''}`}>
                {[0, 1, 2].map((index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={pin[index] || ''}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={`
                      w-14 h-14 md:w-16 md:h-16 text-xl md:text-2xl font-bold text-center
                      bg-black/40 backdrop-blur border-2 rounded-xl
                      transition-all duration-200
                      ${pin[index]
                        ? 'border-gold text-gold shadow-lg shadow-gold/20 scale-105'
                        : 'border-white/10 text-gray-400 hover:border-gold/30'
                      }
                      focus:outline-none focus:border-gold focus:shadow-lg focus:shadow-gold/30 focus:scale-105
                      ${error ? 'border-red-500 animate-pulse' : ''}
                    `}
                    disabled={loading}
                  />
                ))}
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-sm text-red-400"
                >
                  PIN incorreto. Tente novamente.
                </motion.p>
              )}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center gap-3 py-4">
                <Loader2 className="h-5 w-5 text-gold animate-spin" />
                <span className="text-sm text-gray-400">Verificando acesso...</span>
              </div>
            )}

            {/* Footer - Clean and minimal */}
            <div className="text-center pt-4 border-t border-white/5">
              <p className="text-xs text-gray-500 font-medium">
                Protegido por criptografia AES-256
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

// Componente principal
export default function UniqueAnswerPage() {
  const params = useParams()
  const token = params['token'] as string

  // Estados
  const [showPinScreen, setShowPinScreen] = useState(false)
  const [checkingToken, setCheckingToken] = useState(true)
  const [pinError, setPinError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState<Question | null>(null)
  const [response, setResponse] = useState('')
  const [editedResponse, setEditedResponse] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [sending, setSending] = useState(false)
  const [tokenExpired, setTokenExpired] = useState(false)
  const [tokenUsed, setTokenUsed] = useState(false)
  const [sequentialId, setSequentialId] = useState('')
  const [isRevising, setIsRevising] = useState(false)
  const [showRevisionInput, setShowRevisionInput] = useState(false)
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  // Verificar status do token ao carregar a página
  useEffect(() => {
    const checkTokenStatus = async () => {
      if (!token) {
        setTokenExpired(true)
        setCheckingToken(false)
        return
      }

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        const res = await fetch(`/api/answer/check-status?token=${encodeURIComponent(token)}`, {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        })

        clearTimeout(timeoutId)
        const data = await res.json()

        if (res.status === 410 || data.expired) {
          // Token expirado ou já usado
          setTokenExpired(true)
          setTokenUsed(data.used || false)
          if (data.sequentialId) {
            setSequentialId(data.sequentialId)
          }
          setCheckingToken(false)
          logger.info('[UniqueAnswer] Token expired or used', { token: token.slice(0, 8) })
        } else if (res.ok && data.valid) {
          // Token válido, mostrar PIN
          setShowPinScreen(true)
          setCheckingToken(false)
          logger.info('[UniqueAnswer] Token valid, showing PIN screen')
        } else {
          // Erro desconhecido
          setTokenExpired(true)
          setCheckingToken(false)
          logger.warn('[UniqueAnswer] Unknown token status', { status: res.status })
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          logger.error('[UniqueAnswer] Request timeout', { token: token.slice(0, 8) })
        } else {
          logger.error('[UniqueAnswer] Error checking token status', { error })
        }
        setTokenExpired(true)
        setCheckingToken(false)
      }
    }

    checkTokenStatus()
  }, [token])

  // Configurar WebSocket após validação do PIN
  useEffect(() => {
    if (!question || showPinScreen) return

    // Conectar WebSocket para atualizações em tempo real
    const wsUrl = process.env['NEXT_PUBLIC_WS_URL'] ||
                  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
                    ? 'ws://localhost:3008'
                    : 'wss://gugaleo.axnexlabs.com.br:3008')

    const newSocket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true
    })

    newSocket.on('connect', () => {
      logger.info('[UniqueAnswer] WebSocket connected')
      // Inscrever-se para atualizações da pergunta
      newSocket.emit('join', `question:${question.mlQuestionId}`)
    })

    newSocket.on('connect_error', (error) => {
      logger.warn('[UniqueAnswer] WebSocket connection error', { error: error.message })
    })

    newSocket.on('disconnect', (reason) => {
      logger.info('[UniqueAnswer] WebSocket disconnected', { reason })
    })

    // Escutar evento de revisão em andamento
    newSocket.on('question:revising', (data) => {
      if (data.mlQuestionId === question.mlQuestionId) {
        setIsRevising(true)
        toast({
          title: '✨ ML Agent Revisando',
          description: 'A IA está melhorando sua resposta...',
          duration: 5000
        })
      }
    })

    // Escutar evento de resposta revisada
    newSocket.on('question:awaiting_approval', (data) => {
      if (data.mlQuestionId === question.mlQuestionId && data.newResponse) {
        setResponse(data.newResponse)
        setEditedResponse(data.newResponse)
        setIsRevising(false)
        toast({
          title: '✅ Revisão Concluída',
          description: 'Nova resposta pronta para aprovação',
          duration: 5000
        })
      }
    })

    socketRef.current = newSocket

    return () => {
      if (newSocket.connected) {
        newSocket.emit('leave', `question:${question.mlQuestionId}`)
        newSocket.disconnect()
      }
      socketRef.current = null
    }
  }, [question, showPinScreen])

  // Validar PIN com segurança aprimorada
  const handlePinSubmit = async (pinValue: string) => {
    // Validação básica do PIN
    if (!pinValue || pinValue.length !== 3) {
      setPinError(true)
      setTimeout(() => setPinError(false), 2000)
      return
    }

    setLoading(true)
    setPinError(false)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

      const res = await fetch('/api/answer/validate-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Time': new Date().toISOString()
        },
        body: JSON.stringify({
          token: token,
          pin: pinValue
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))

        if (res.status === 410) {
          setTokenExpired(true)
          setShowPinScreen(false)
          logger.warn('[UniqueAnswer] Token expired during PIN validation')
          return
        }

        if (res.status === 401) {
          setPinError(true)
          setTimeout(() => setPinError(false), 3000)
          logger.warn('[UniqueAnswer] Invalid PIN attempt')
          return
        }

        throw new Error(errorData.error || 'Validation failed')
      }

      const data = await res.json()

      if (!data.question) {
        throw new Error('Invalid response from server')
      }

      setQuestion(data.question)
      setResponse(data.question.aiSuggestion || '')
      setEditedResponse(data.question.aiSuggestion || '')
      setSequentialId(data.sequentialId || '')
      setShowPinScreen(false)

      logger.info('[UniqueAnswer] PIN validated successfully', {
        questionId: data.question.id.slice(0, 8)
      })

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('[UniqueAnswer] PIN validation timeout')
        toast({
          title: '⚠️ Tempo Esgotado',
          description: 'A validação demorou muito. Tente novamente.',
          variant: 'destructive'
        })
      } else {
        logger.error('[UniqueAnswer] Error validating PIN', { error })
        toast({
          title: '❌ Erro',
          description: 'Erro ao validar PIN. Tente novamente.',
          variant: 'destructive'
        })
      }
      setPinError(true)
      setTimeout(() => setPinError(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  // Salvar edição no banco SEM enviar ao ML
  const handleSaveEdit = async () => {
    if (!question || !editedResponse.trim()) {
      toast({
        title: '⚠️ Atenção',
        description: 'A resposta não pode estar vazia.',
        variant: 'destructive'
      })
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/agent/save-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          response: editedResponse.trim()
        })
      })

      if (res.ok) {
        // Atualizar a resposta no objeto local
        setResponse(editedResponse)
        setIsEditing(false)
        toast({
          title: '✅ Resposta Atualizada',
          description: 'Alterações salvas. Use "Aprovar e Enviar" para enviar ao Mercado Livre.',
        })
      } else {
        toast({
          title: '❌ Erro ao salvar',
          description: 'Não foi possível salvar a edição.',
          variant: 'destructive'
        })
      }
    } catch (_error) {
      toast({
        title: '❌ Erro',
        description: 'Erro ao salvar resposta.',
        variant: 'destructive'
      })
    } finally {
      setSending(false)
    }
  }

  // Aprovar e enviar resposta com validações aprimoradas
  const handleApprove = async () => {
    // Usar a resposta atualizada (que pode ter sido editada e salva)
    const finalResponse = isEditing ? editedResponse : response

    if (!question || !finalResponse.trim()) {
      toast({
        title: '⚠️ Atenção',
        description: 'A resposta não pode estar vazia.',
        variant: 'destructive'
      })
      return
    }

    // Validar tamanho da resposta (ML tem limite)
    if (finalResponse.length > 2000) {
      toast({
        title: '⚠️ Resposta muito longa',
        description: 'A resposta deve ter no máximo 2000 caracteres.',
        variant: 'destructive'
      })
      return
    }

    setSending(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const res = await fetch('/api/answer/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Time': new Date().toISOString()
        },
        body: JSON.stringify({
          token: token,
          questionId: question.id,
          response: finalResponse.trim(),
          action: isEditing ? 'manual' : 'approve',
          metadata: {
            userAgent: navigator.userAgent,
            timestamp: Date.now()
          }
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to approve')
      }

      const result = await res.json()

      // Ativar animação de sucesso
      setShowSuccessAnimation(true)

      // Marcar token como usado (fire and forget)
      fetch('/api/answer/mark-used', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      }).catch(err => logger.warn('[UniqueAnswer] Failed to mark token as used', { err }))

      // Emitir evento via WebSocket se conectado
      if (socketRef.current?.connected) {
        socketRef.current.emit('question:approved', {
          mlQuestionId: question.mlQuestionId,
          status: 'RESPONDED'
        })
      }

      // Aguardar animação e mostrar sucesso
      setTimeout(() => {
        setTokenExpired(true)
        setTokenUsed(true)
      }, 3000)

      toast({
        title: '✅ Resposta Enviada com Sucesso!',
        description: result.message || 'O cliente receberá a resposta no Mercado Livre.',
        duration: 5000
      })

      // Log de sucesso
      logger.info('[UniqueAnswer] Question approved successfully', {
        questionId: question.id.slice(0, 8),
        action: isEditing ? 'manual' : 'approve'
      })

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('[UniqueAnswer] Approval timeout')
        toast({
          title: '⚠️ Tempo Esgotado',
          description: 'O envio demorou muito. Por favor, tente novamente.',
          variant: 'destructive'
        })
      } else {
        logger.error('[UniqueAnswer] Error approving', { error })
        toast({
          title: '❌ Erro ao Enviar',
          description: error instanceof Error ? error.message : 'Erro ao enviar resposta. Tente novamente.',
          variant: 'destructive'
        })
      }
    } finally {
      setSending(false)
    }
  }

  // Revisar com IA - Sistema avançado de revisão
  const handleRevise = async () => {
    if (!question || !revisionFeedback.trim()) {
      toast({
        title: '⚠️ Atenção',
        description: 'Por favor, descreva como melhorar a resposta.',
        variant: 'destructive'
      })
      return
    }

    // Limitar tamanho do feedback
    if (revisionFeedback.length > 500) {
      toast({
        title: '⚠️ Feedback muito longo',
        description: 'O feedback deve ter no máximo 500 caracteres.',
        variant: 'destructive'
      })
      return
    }

    setIsRevising(true)
    setShowRevisionInput(false)
    setRevisionFeedback('')

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 45000) // 45s timeout para revisão

      const res = await fetch('/api/answer/revise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Time': new Date().toISOString()
        },
        body: JSON.stringify({
          questionId: question.id,
          feedback: revisionFeedback.trim(),
          token: token,
          currentResponse: editedResponse
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to revise')
      }

      const data = await res.json()

      // Emitir evento via WebSocket
      if (socketRef.current?.connected) {
        socketRef.current.emit('question:revision-requested', {
          mlQuestionId: question.mlQuestionId,
          feedback: revisionFeedback
        })
      }

      toast({
        title: '🤖 ML Agent em Ação',
        description: data.message || 'Estou melhorando sua resposta com IA...',
        duration: 10000
      })

      logger.info('[UniqueAnswer] Revision requested', {
        questionId: question.id.slice(0, 8)
      })

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('[UniqueAnswer] Revision timeout')
        toast({
          title: '⚠️ Tempo Esgotado',
          description: 'A revisão demorou muito. Tente novamente.',
          variant: 'destructive'
        })
      } else {
        logger.error('[UniqueAnswer] Error requesting revision', { error })
        toast({
          title: '❌ Erro na Revisão',
          description: error instanceof Error ? error.message : 'Erro ao solicitar revisão.',
          variant: 'destructive'
        })
      }
      setIsRevising(false)
    }
  }

  // Formatar data
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

  // Loading inicial - verificando token
  if (checkingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <PremiumLoader />
          <p className="text-gray-400 text-sm">Verificando acesso...</p>
        </div>
      </div>
    )
  }

  // Tela de PIN
  if (showPinScreen && !tokenExpired) {
    return <PinScreen onSuccess={handlePinSubmit} loading={loading} error={pinError} />
  }

  // Token expirado ou já usado
  if (tokenExpired || tokenUsed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
        {/* Background Pattern */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative max-w-md w-full"
        >
          <Card className="bg-gradient-to-br from-black via-gray-900/50 to-black backdrop-blur-xl border border-white/10 shadow-2xl">
            <div className="p-8 text-center space-y-8">
              {/* Logo ML Agent Principal - Bem Destacada */}
              <div className="flex justify-center">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-gold/40 via-yellow-500/40 to-gold/40 blur-3xl rounded-full scale-150 group-hover:scale-[1.6] transition-transform duration-700" />
                  <Image
                    src="/mlagent-logo-3d.svg"
                    alt="ML Agent"
                    width={100}
                    height={100}
                    className="relative drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                    style={{
                      filter: 'drop-shadow(0 10px 40px rgba(255, 230, 0, 0.3))'
                    }}
                    priority
                  />
                </div>
              </div>

              {/* Check Minimalista e Elegante */}
              <div className="relative inline-flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-full blur-xl" />
                <div className="relative bg-black/90 rounded-full p-3 border border-emerald-500/40">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" strokeWidth={2.5} />
                </div>
              </div>

              {/* Mensagem de Sucesso */}
              <div className="space-y-3">
                <h2 className="text-2xl font-light text-white tracking-wide">
                  Resposta Enviada com Sucesso
                </h2>
                <p className="text-gray-400 font-light">
                  {sequentialId ? (
                    <span>
                      Pergunta <span className="text-gold font-mono font-medium">#{sequentialId}</span> respondida
                    </span>
                  ) : (
                    'Sua resposta foi entregue ao cliente no Mercado Livre'
                  )}
                </p>
              </div>

              {/* Ações */}
              <div className="space-y-3 pt-4 border-t border-white/5">
                {/* Botão Ver no Mercado Livre */}
                {question?.itemPermalink || question?.itemId ? (
                  <Button
                    onClick={() => {
                      const url = question.itemPermalink || `https://produto.mercadolivre.com.br/MLB-${question.itemId}`
                      window.open(url, '_blank')
                    }}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 font-medium shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-500/20"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Resposta no Mercado Livre
                  </Button>
                ) : null}

                {/* Botão Acessar ML Agent */}
                <Button
                  onClick={() => window.location.href = '/agente'}
                  variant="outline"
                  className="w-full bg-black/50 border-gold/20 text-gold hover:bg-gold/5 hover:border-gold/40 transition-all duration-300 hover:shadow-lg hover:shadow-gold/10"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Acessar ML Agent
                </Button>
              </div>

              {/* Nota Final */}
              <p className="text-xs text-gray-500 font-light">
                Link de aprovação utilizado com sucesso
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    )
  }

  // Interface principal
  if (!question) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Header - Matching /agente styling */}
      <div className="sticky top-0 z-50 backdrop-blur-2xl bg-gradient-to-b from-black/90 to-black/80 border-b border-white/5 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-gold/3 via-transparent to-gold/3 opacity-50"></div>
        <div className="container mx-auto px-4 md:px-8">
          <div className="h-16 md:h-20 flex items-center justify-between relative">
            {/* Logo and Brand - Same as /agente */}
            <div className="flex items-center gap-3 md:gap-4">
              <Image
                src="/mlagent-logo-3d.svg"
                alt="ML Agent"
                width={48}
                height={48}
                className="h-10 md:h-12 w-auto object-contain hover:scale-105 transition-transform duration-500"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(255, 230, 0, 0.2))'
                }}
                priority
              />
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl md:text-2xl font-light text-white tracking-wide">
                  ML Agent
                </h1>
                <span className="text-xl md:text-2xl font-bold italic bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent tracking-wider pr-2">
                  PRO
                </span>
              </div>
            </div>

            {/* Sequential ID Badge - Premium design */}
            {sequentialId && (
              <div className="relative rounded-lg bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />
                <div className="relative flex items-center gap-2 px-3 py-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-gold" />
                  <span className="text-sm font-mono font-bold text-gold">{sequentialId}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className={`
          relative overflow-hidden
          bg-gradient-to-br from-white/[0.03] to-white/[0.01]
          border border-white/5
          backdrop-blur-sm
          rounded-xl
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
                    <div className="h-full bg-gradient-to-r from-gold via-yellow-500 to-gold rounded-full animate-shimmer"
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

          <div className="relative p-6 space-y-6">
            {/* Header do Card - Mobile optimized with status in top left */}
            <div className="relative">

              {/* Seller info and time */}
              <div className="flex items-start gap-3 pt-3">
                {question.mlAccount.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={question.mlAccount.thumbnail}
                    alt={question.mlAccount.nickname}
                    className="h-10 w-10 rounded-full border-2 border-gold/30"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gold/20 to-yellow-500/10 border border-gold/30 flex items-center justify-center">
                    <User className="h-5 w-5 text-gold" />
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {question.mlAccount.nickname}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3 text-gold/60" />
                    <span className="text-xs text-gold/80">
                      Recebida {formatDate(question.dateCreated)}
                    </span>
                  </div>
                  {question.customerName && (
                    <p className="text-xs text-gray-500 mt-1">
                      Cliente: {question.customerName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Produto */}
            {question.itemTitle && (
              <div className="flex items-start gap-4 p-4 rounded-xl bg-black/30 border border-white/5">
                {question.itemThumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={question.itemThumbnail}
                    alt={question.itemTitle}
                    className="w-20 h-20 object-cover rounded-lg border border-white/10"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">
                    {question.itemTitle}
                  </h3>
                  {question.itemPrice && (
                    <p className="text-lg font-bold text-gold mt-1">
                      R$ {question.itemPrice.toFixed(2).replace('.', ',')}
                    </p>
                  )}
                  {(question.itemPermalink || question.itemId) && (
                    <a
                      href={question.itemPermalink || `https://produto.mercadolivre.com.br/MLB-${question.itemId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2"
                    >
                      Ver no Mercado Livre <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Pergunta */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gold" />
                <span className="text-sm font-semibold text-gold">Pergunta do Cliente</span>
              </div>
              <div className="p-4 rounded-lg bg-black/30 border border-white/5">
                <p className="text-white whitespace-pre-wrap">{question.text}</p>
              </div>
            </div>

            {/* Resposta da IA / Edição */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gold/10 border border-gold/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/icone-amarelo.svg"
                      alt="ML Agent"
                      className="w-4 h-4"
                    />
                  </div>
                  <span className="text-sm font-semibold text-gold">
                    {isRevising ? 'ML Agent revisando...' :
                     isEditing ? 'Editando Resposta' : 'Resposta do ML Agent'}
                  </span>
                </div>

                {!isEditing && !isRevising && (
                  <Button
                    onClick={() => setIsEditing(true)}
                    size="sm"
                    variant="ghost"
                    className="text-gold hover:text-gold/80 hover:bg-gold/10"
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                )}
              </div>

              {/* Loading state para revisão */}
              {isRevising && (
                <div className="relative overflow-hidden">
                  <div className="text-gray-400 p-4 bg-white/[0.02] rounded-lg border border-white/5">
                    <div className="flex items-center justify-center gap-3">
                      <RefreshCw className="h-5 w-5 text-gold animate-spin" />
                      <span className="text-sm">Revisando resposta com IA...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Editor/Visualizador de resposta */}
              {!isRevising && (
                <>
                  {isEditing ? (
                    <Textarea
                      value={editedResponse}
                      onChange={(e) => setEditedResponse(e.target.value)}
                      className="min-h-[150px] bg-black/50 border-gold/30 text-white focus:border-gold"
                      placeholder="Digite sua resposta..."
                    />
                  ) : (
                    <div className="p-4 rounded-lg bg-gradient-to-r from-gold/5 to-yellow-500/5 border border-gold/20">
                      <p className="text-white whitespace-pre-wrap">{editedResponse || response}</p>
                    </div>
                  )}

                  {isEditing && (
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => {
                          setIsEditing(false)
                          setEditedResponse(response)
                        }}
                        size="sm"
                        variant="ghost"
                        className="text-gray-400 hover:text-white"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleSaveEdit}
                        size="sm"
                        disabled={sending}
                        className="bg-gradient-to-r from-gold to-yellow-500 text-black hover:from-gold/90 hover:to-yellow-500/90 disabled:opacity-50"
                      >
                        {sending ? 'Salvando...' : 'Salvar Edição'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input de Revisão */}
            {showRevisionInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Edit2 className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-semibold text-purple-400">
                    Como você gostaria de melhorar a resposta?
                  </span>
                </div>
                <Textarea
                  value={revisionFeedback}
                  onChange={(e) => setRevisionFeedback(e.target.value)}
                  placeholder="Ex: Tornar mais amigável, adicionar mais detalhes sobre garantia..."
                  className="min-h-[80px] bg-black/50 border-purple-500/30 text-white focus:border-purple-400"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => {
                      setShowRevisionInput(false)
                      setRevisionFeedback('')
                    }}
                    size="sm"
                    variant="ghost"
                    className="text-gray-400 hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleRevise}
                    size="sm"
                    disabled={!revisionFeedback.trim() || isRevising}
                    className="bg-gradient-to-r from-purple-500 to-violet-500 text-white hover:from-purple-600 hover:to-violet-600"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Revisar com o ML Agent
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/5">
              <Button
                onClick={handleApprove}
                disabled={sending || !editedResponse.trim() || isRevising}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-emerald-500/30 hover:scale-[1.02]"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Aprovar e Enviar
                  </>
                )}
              </Button>

              {!showRevisionInput && !isRevising && (
                <Button
                  onClick={() => setShowRevisionInput(true)}
                  variant="outline"
                  className="flex-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all hover:shadow-purple-500/20 hover:scale-[1.02]"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Revisar com o ML Agent
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Footer Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Este link é de uso único e expirará após a aprovação
          </p>
        </div>
      </div>

      {/* Estilos adicionais para animações */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shake {
          animation: shake 0.5s;
        }
        .animate-shimmer {
          animation: shimmer 1.5s ease-in-out infinite;
          background-size: 200% 100%;
        }
        .animation-delay-200 {
          animation-delay: 200ms;
        }
        .animation-delay-400 {
          animation-delay: 400ms;
        }
      `}</style>
    </div>
  )
}