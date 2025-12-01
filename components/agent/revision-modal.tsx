/**
 * Modal de Revisão Enterprise Premium - Experiência Profissional Mobile-First
 *
 * Features 2025:
 * - Mobile-first design responsivo
 * - Streaming token-by-token da revisão
 * - Feedback visual rico com haptic
 * - Validação em tempo real
 * - Animações suaves (Framer Motion)
 * - Glassmorphism premium matching com login
 * - Touch-friendly buttons e inputs
 *
 * @author ML Agent Team
 * @date 2025-11-21
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Send, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StreamingResponse } from './streaming-response'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { useWebSocket } from '@/hooks/use-websocket'
import { useState, useEffect } from 'react'

// 🔊 Haptic Feedback
const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'error' | 'success') => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    switch (type) {
      case 'light':
        navigator.vibrate(10)
        break
      case 'medium':
        navigator.vibrate(20)
        break
      case 'heavy':
        navigator.vibrate(30)
        break
      case 'error':
        navigator.vibrate([50, 50, 50])
        break
      case 'success':
        navigator.vibrate([30, 30, 60])
        break
    }
  }
}

interface RevisionModalProps {
  isOpen: boolean
  onClose: () => void
  questionId: string
  organizationId: string
  currentResponse: string
  onRevisionComplete?: (revisedResponse: string) => void
}

export function RevisionModal({
  isOpen,
  onClose,
  questionId,
  organizationId,
  currentResponse,
  onRevisionComplete,
}: RevisionModalProps) {
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { socket } = useWebSocket()
  const agentStream = useAgentStream(organizationId, socket)

  // Reset state quando modal fecha
  useEffect(() => {
    if (!isOpen) {
      setRevisionFeedback('')
      setError(null)
      setIsSubmitting(false)
      agentStream.resetStream()
    }
  }, [isOpen, agentStream])

  // Quando revisão completa, notificar parent
  useEffect(() => {
    if (agentStream.isDone && agentStream.fullResponse && !agentStream.error) {
      triggerHaptic('success')
      onRevisionComplete?.(agentStream.fullResponse)
    }
  }, [agentStream.isDone, agentStream.fullResponse, agentStream.error, onRevisionComplete])

  const handleSubmit = async () => {
    if (!revisionFeedback.trim()) {
      setError('Por favor, descreva as alterações que deseja fazer')
      triggerHaptic('error')
      return
    }

    if (revisionFeedback.trim().length < 10) {
      setError('O feedback deve ter pelo menos 10 caracteres')
      triggerHaptic('error')
      return
    }

    setIsSubmitting(true)
    setError(null)
    triggerHaptic('medium')

    try {
      // Iniciar streaming
      agentStream.startStream(questionId)

      // Enviar para API
      const response = await fetch('/api/agent/revise-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          feedback: revisionFeedback,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao revisar resposta')
      }

      // Sucesso - o streaming vai mostrar o resultado
      triggerHaptic('light')
    } catch (err: any) {
      setError(err.message || 'Erro ao revisar resposta')
      agentStream.resetStream()
      triggerHaptic('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting && !agentStream.isStreaming) {
      triggerHaptic('light')
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Premium */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
            onClick={handleClose}
          />

          {/* Modal Container - Mobile First */}
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 100 }}
              transition={{
                duration: 0.3,
                type: 'spring',
                damping: 25,
                stiffness: 300,
              }}
              className="w-full sm:max-w-3xl md:max-w-4xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-2xl bg-black/40 backdrop-blur-2xl border-t-2 sm:border-2 border-gold/20 shadow-[0_-8px_32px_rgba(0,0,0,0.5),0_0_32px_rgba(212,175,55,0.15)] sm:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_24px_rgba(212,175,55,0.15)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header - Sticky */}
              <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-white/[0.08] bg-black/60 backdrop-blur-xl">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <motion.div
                    animate={{
                      rotate: [0, 10, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="p-1.5 sm:p-2 rounded-xl bg-gold/20 border border-gold/30"
                  >
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
                  </motion.div>
                  <div>
                    <h2 className="text-base sm:text-xl font-bold text-white">Revisar Resposta</h2>
                    <p className="text-[10px] sm:text-sm text-gray-400">Gemini 3.0 Pro vai melhorar sua resposta</p>
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  disabled={isSubmitting || agentStream.isStreaming}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                </button>
              </div>

              {/* Content - Scrollable */}
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto max-h-[calc(92vh-180px)] sm:max-h-[calc(90vh-180px)]">
                {/* Resposta Atual */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-2">
                    Resposta Atual
                  </label>
                  <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-black/60 border border-white/[0.08]">
                    <p className="text-xs sm:text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {currentResponse}
                    </p>
                  </div>
                </div>

                {/* Feedback Input */}
                {!agentStream.isStreaming && !agentStream.isDone && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-2">
                      O que você gostaria de mudar?
                    </label>
                    <Textarea
                      value={revisionFeedback}
                      onChange={(e) => {
                        setRevisionFeedback(e.target.value)
                        setError(null)
                      }}
                      placeholder="Ex: Deixar mais formal, adicionar informação sobre garantia, tornar mais conciso..."
                      className="min-h-[100px] sm:min-h-[120px] bg-black/60 border-white/[0.08] text-white placeholder:text-gray-500 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 rounded-xl sm:rounded-2xl text-xs sm:text-sm"
                      disabled={isSubmitting}
                      maxLength={500}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] sm:text-xs text-gray-500">
                        {revisionFeedback.length}/500 caracteres
                      </span>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-1 text-red-400"
                        >
                          <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span className="text-[10px] sm:text-xs font-medium">{error}</span>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Streaming Response */}
                {(agentStream.isStreaming || agentStream.isDone) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <label className="block text-xs sm:text-sm font-semibold text-gray-300">
                        Resposta Revisada
                      </label>
                      {agentStream.isDone && !agentStream.error && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3, type: 'spring' }}
                        >
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                        </motion.div>
                      )}
                    </div>
                    <StreamingResponse
                      isStreaming={agentStream.isStreaming}
                      fullResponse={agentStream.fullResponse}
                      isDone={agentStream.isDone}
                      error={agentStream.error}
                    />
                  </motion.div>
                )}
              </div>

              {/* Footer - Sticky */}
              <div className="sticky bottom-0 flex items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t border-white/[0.08] bg-black/60 backdrop-blur-xl">
                {!agentStream.isStreaming && !agentStream.isDone && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="border-white/[0.08] hover:bg-white/5 text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 rounded-lg sm:rounded-xl active:scale-95"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !revisionFeedback.trim() || revisionFeedback.trim().length < 10}
                      className="bg-gradient-to-r from-gold via-gold-light to-gold text-black font-bold shadow-lg shadow-gold/30 hover:shadow-xl hover:shadow-gold/40 text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 rounded-lg sm:rounded-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                          <span>Iniciando...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span>Revisar com IA</span>
                        </div>
                      )}
                    </Button>
                  </>
                )}

                {agentStream.isDone && !agentStream.error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full sm:w-auto"
                  >
                    <Button
                      onClick={handleClose}
                      className="w-full sm:w-auto bg-gradient-to-br from-emerald-500/20 to-green-500/10 border-2 border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/30 text-xs sm:text-sm h-9 sm:h-10 px-4 sm:px-6 rounded-lg sm:rounded-xl active:scale-95 shadow-lg shadow-emerald-500/20"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>Usar Resposta Revisada</span>
                      </div>
                    </Button>
                  </motion.div>
                )}

                {agentStream.error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full sm:w-auto"
                  >
                    <Button
                      onClick={() => {
                        triggerHaptic('light')
                        agentStream.resetStream()
                        setError(null)
                      }}
                      variant="outline"
                      className="w-full sm:w-auto border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs sm:text-sm h-9 sm:h-10 px-4 rounded-lg sm:rounded-xl active:scale-95"
                    >
                      Tentar Novamente
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
