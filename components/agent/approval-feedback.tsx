/**
 * ApprovalFeedback - Componente Enterprise Premium para Feedback de Aprovação
 *
 * Features 2025:
 * - Mobile-first design com haptic feedback
 * - Animações fluídas e profissionais (Framer Motion)
 * - Glassmorphism premium matching com login
 * - Feedback visual rico (success/error/loading)
 * - Confetti particles em sucesso
 * - Auto-dismiss inteligente com progress bar
 * - Minimalista e high-end
 *
 * @author ML Agent Team
 * @date 2025-11-21
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, AlertCircle, Loader2, ExternalLink, Clock, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

type FeedbackType = 'success' | 'error' | 'loading' | 'warning'

interface ApprovalFeedbackProps {
  type: FeedbackType
  message: string
  isVisible: boolean
  onDismiss?: () => void
  autoDismiss?: boolean
  dismissDelay?: number
  actionLabel?: string
  actionUrl?: string
  details?: string
  showRetry?: boolean
  onRetry?: () => void
}

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
        navigator.vibrate([50, 50, 50]) // 3 vibrações curtas
        break
      case 'success':
        navigator.vibrate([30, 30, 60]) // 2 curtas + 1 longa
        break
    }
  }
}

export function ApprovalFeedbackComponent({
  type,
  message,
  isVisible,
  onDismiss,
  autoDismiss = true,
  dismissDelay = 5000,
  actionLabel,
  actionUrl,
  details,
  showRetry = false,
  onRetry,
}: ApprovalFeedbackProps) {
  const [progress, setProgress] = useState(100)

  // Auto-dismiss com barra de progresso
  useEffect(() => {
    if (!isVisible || !autoDismiss || type === 'loading') return

    setProgress(100)
    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev - (100 / (dismissDelay / 50))
        if (newProgress <= 0) {
          clearInterval(interval)
          onDismiss?.()
          return 0
        }
        return newProgress
      })
    }, 50)

    return () => clearInterval(interval)
  }, [isVisible, autoDismiss, dismissDelay, onDismiss, type])

  // Haptic feedback ao aparecer
  useEffect(() => {
    if (isVisible) {
      if (type === 'success') triggerHaptic('success')
      else if (type === 'error') triggerHaptic('error')
      else if (type === 'warning') triggerHaptic('medium')
    }
  }, [isVisible, type])

  const config = {
    success: {
      icon: CheckCircle2,
      gradient: 'from-emerald-500/20 to-green-500/10',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
      textColor: 'text-emerald-300',
      progressColor: 'bg-emerald-500/50',
      shadow: 'shadow-emerald-500/20',
    },
    error: {
      icon: XCircle,
      gradient: 'from-red-500/20 to-rose-500/10',
      border: 'border-red-500/30',
      iconColor: 'text-red-400',
      textColor: 'text-red-300',
      progressColor: 'bg-red-500/50',
      shadow: 'shadow-red-500/20',
    },
    loading: {
      icon: Loader2,
      gradient: 'from-gold/20 to-gold-light/10',
      border: 'border-gold/30',
      iconColor: 'text-gold',
      textColor: 'text-gold-light',
      progressColor: 'bg-gold/50',
      shadow: 'shadow-gold/30',
    },
    warning: {
      icon: AlertCircle,
      gradient: 'from-amber-500/20 to-yellow-500/10',
      border: 'border-amber-500/30',
      iconColor: 'text-amber-400',
      textColor: 'text-amber-300',
      progressColor: 'bg-amber-500/50',
      shadow: 'shadow-amber-500/20',
    },
  }

  const { icon: Icon, gradient, border, iconColor, textColor, progressColor, shadow } = config[type]

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{
            duration: 0.4,
            type: 'spring',
            damping: 25,
            stiffness: 300,
          }}
          className="relative overflow-hidden"
        >
          <div
            className={`
              relative p-3.5 sm:p-4 rounded-xl sm:rounded-2xl
              bg-gradient-to-br ${gradient}
              border ${border}
              backdrop-blur-2xl
              shadow-lg ${shadow}
            `}
          >
            {/* Conteúdo Principal */}
            <div className="flex items-start gap-2.5 sm:gap-3">
              {/* Ícone */}
              <div className={`
                flex-shrink-0 p-1.5 sm:p-2 rounded-lg sm:rounded-xl
                ${type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/30' : ''}
                ${type === 'error' ? 'bg-red-500/20 border border-red-500/30' : ''}
                ${type === 'loading' ? 'bg-gold/20 border border-gold/30' : ''}
                ${type === 'warning' ? 'bg-amber-500/20 border border-amber-500/30' : ''}
              `}>
                <Icon
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor} ${type === 'loading' ? 'animate-spin' : ''}`}
                  strokeWidth={2.5}
                />
              </div>

              {/* Mensagem */}
              <div className="flex-1 min-w-0">
                <p className={`text-xs sm:text-sm font-semibold ${textColor} leading-tight`}>
                  {message}
                </p>

                {/* Detalhes */}
                {details && (
                  <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-gray-400 leading-relaxed">
                    {details}
                  </p>
                )}

                {/* Ação */}
                {(actionLabel || showRetry) && (
                  <div className="flex items-center gap-2 mt-2 sm:mt-3">
                    {showRetry && onRetry && (
                      <button
                        onClick={() => {
                          triggerHaptic('light')
                          onRetry()
                        }}
                        className={`
                          text-[10px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg
                          bg-white/5 border border-white/10
                          hover:bg-white/10 hover:border-white/20
                          transition-all duration-200
                          active:scale-95
                          ${textColor}
                        `}
                      >
                        Tentar Novamente
                      </button>
                    )}

                    {actionLabel && actionUrl && (
                      <a
                        href={actionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => triggerHaptic('light')}
                        className={`
                          flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg
                          bg-white/5 border border-white/10
                          hover:bg-white/10 hover:border-white/20
                          transition-all duration-200
                          active:scale-95
                          ${textColor}
                        `}
                      >
                        <span>{actionLabel}</span>
                        <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.5} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Botão Fechar */}
              {onDismiss && type !== 'loading' && (
                <button
                  onClick={() => {
                    triggerHaptic('light')
                    onDismiss()
                  }}
                  className="flex-shrink-0 p-0.5 sm:p-1 rounded-lg hover:bg-white/10 transition-all active:scale-95"
                >
                  <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 hover:text-white transition-colors" />
                </button>
              )}
            </div>

            {/* Barra de Progresso Auto-Dismiss */}
            {autoDismiss && type !== 'loading' && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5"
              >
                <motion.div
                  className={`h-full ${progressColor}`}
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.05, ease: 'linear' }}
                />
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * ApprovalAnimation - Animação Premium de Aprovação (Mobile-First)
 * Overlay full-screen com animação de sucesso sofisticada
 */
interface ApprovalAnimationProps {
  isVisible: boolean
  onComplete?: () => void
  questionSequentialId?: string
  productTitle?: string
}

export function ApprovalAnimation({
  isVisible,
  onComplete,
  questionSequentialId,
  productTitle,
}: ApprovalAnimationProps) {
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (isVisible) {
      // Haptic feedback de sucesso
      triggerHaptic('success')

      // Mostrar confetti após ícone aparecer
      setTimeout(() => setShowConfetti(true), 400)

      // Auto-dismiss após animação
      const timer = setTimeout(() => {
        onComplete?.()
      }, 2500)

      return () => clearTimeout(timer)
    } else {
      setShowConfetti(false)
    }
    return undefined
  }, [isVisible, onComplete])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md px-4 pointer-events-none"
        >
          {/* Confetti Particles */}
          {showConfetti && (
            <>
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{
                    opacity: 1,
                    x: '50vw',
                    y: '50vh',
                    scale: 0,
                  }}
                  animate={{
                    opacity: 0,
                    x: `${50 + (Math.random() - 0.5) * 100}vw`,
                    y: `${50 + (Math.random() - 0.5) * 100}vh`,
                    scale: Math.random() * 1.5 + 0.5,
                    rotate: Math.random() * 720 - 360,
                  }}
                  transition={{
                    duration: 1.5,
                    ease: 'easeOut',
                    delay: Math.random() * 0.3,
                  }}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    background: ['#D4AF37', '#F4E4C1', '#10B981', '#34D399'][Math.floor(Math.random() * 4)],
                  }}
                />
              ))}
            </>
          )}

          {/* Card de Sucesso Premium - Mobile First */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -30 }}
            transition={{
              duration: 0.5,
              type: 'spring',
              damping: 20,
              stiffness: 300,
            }}
            className="w-full max-w-sm p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-black/40 backdrop-blur-2xl border-2 border-emerald-500/30 shadow-[0_0_60px_rgba(16,185,129,0.3)]"
          >
            {/* Ícone de Sucesso com Pulse Premium */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.2,
                duration: 0.6,
                type: 'spring',
                damping: 12,
              }}
              className="flex justify-center mb-5 sm:mb-6"
            >
              <div className="relative">
                {/* Ícone Principal */}
                <motion.div
                  animate={{
                    rotate: [0, 10, -10, 5, -5, 0],
                  }}
                  transition={{
                    duration: 0.6,
                    delay: 0.3,
                  }}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-emerald-500/30 to-green-500/20 border-2 border-emerald-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                >
                  <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400" strokeWidth={2.5} />
                </motion.div>

                {/* Pulse Rings - Premium */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-emerald-500/60"
                  animate={{
                    scale: [1, 1.8, 1.8],
                    opacity: [0.6, 0, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-emerald-500/40"
                  animate={{
                    scale: [1, 2.4, 2.4],
                    opacity: [0.4, 0, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeOut',
                    delay: 0.5,
                  }}
                />

                {/* Sparkles */}
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0],
                      x: [0, (i - 1) * 40],
                      y: [0, -20 - i * 10],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: 0.4 + i * 0.15,
                      repeat: Infinity,
                      repeatDelay: 1,
                    }}
                    className="absolute top-0 left-1/2"
                  >
                    <Sparkles className="w-4 h-4 text-gold" />
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Mensagem */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center space-y-2 sm:space-y-3"
            >
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Resposta Publicada!
              </h3>

              {questionSequentialId && (
                <p className="text-xs sm:text-sm text-gray-400">
                  Pergunta <span className="font-mono text-gold font-semibold">{questionSequentialId}</span>
                </p>
              )}

              {productTitle && (
                <p className="text-[10px] sm:text-xs text-gray-500 line-clamp-2 px-2">
                  {productTitle}
                </p>
              )}

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="flex items-center justify-center gap-2 text-emerald-400 mt-3 sm:mt-4 pt-3 border-t border-white/[0.08]"
              >
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-xs font-medium">
                  Visível no Mercado Livre
                </span>
              </motion.div>
            </motion.div>

            {/* Progress Bar */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 2.5, ease: 'linear', delay: 0.5 }}
              className="mt-5 sm:mt-6 h-1 rounded-full bg-emerald-500/30 origin-left"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * ErrorFeedback - Feedback de erro elegante e informativo (Mobile-First)
 */
interface ErrorFeedbackProps {
  isVisible: boolean
  title: string
  description: string
  errorCode?: string | undefined
  isRateLimit?: boolean | undefined
  canRetry?: boolean | undefined
  onRetry?: (() => void) | undefined
  onDismiss?: (() => void) | undefined
  retryLabel?: string | undefined
}

export function ErrorFeedback({
  isVisible,
  title,
  description,
  errorCode,
  isRateLimit = false,
  canRetry = false,
  onRetry,
  onDismiss,
  retryLabel = 'Tentar Novamente',
}: ErrorFeedbackProps) {
  // Haptic feedback ao aparecer
  useEffect(() => {
    if (isVisible) {
      triggerHaptic(isRateLimit ? 'medium' : 'error')
    }
  }, [isVisible, isRateLimit])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.3, type: 'spring', damping: 25 }}
          className="relative overflow-hidden"
        >
          <div className={`
            p-3.5 sm:p-4 rounded-xl sm:rounded-2xl
            bg-gradient-to-br ${isRateLimit ? 'from-amber-500/20 to-yellow-500/10' : 'from-red-500/20 to-rose-500/10'}
            border ${isRateLimit ? 'border-amber-500/30' : 'border-red-500/30'}
            backdrop-blur-2xl
            shadow-lg ${isRateLimit ? 'shadow-amber-500/20' : 'shadow-red-500/20'}
          `}>
            <div className="flex items-start gap-2.5 sm:gap-3">
              {/* Ícone */}
              <div className={`
                flex-shrink-0 p-1.5 sm:p-2 rounded-lg sm:rounded-xl
                ${isRateLimit ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-red-500/20 border border-red-500/30'}
              `}>
                {isRateLimit ? (
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" strokeWidth={2.5} />
                ) : (
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" strokeWidth={2.5} />
                )}
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                {/* Título */}
                <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                  <h4 className={`text-xs sm:text-sm font-bold ${isRateLimit ? 'text-amber-400' : 'text-red-400'}`}>
                    {title}
                  </h4>
                  {errorCode && (
                    <span className="text-[9px] sm:text-[10px] font-mono px-1 sm:px-1.5 py-0.5 rounded bg-black/40 text-gray-500">
                      {errorCode}
                    </span>
                  )}
                </div>

                {/* Descrição */}
                <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed">
                  {description}
                </p>

                {/* Ações */}
                {canRetry && onRetry && (
                  <button
                    onClick={() => {
                      triggerHaptic('light')
                      onRetry()
                    }}
                    className={`
                      mt-2 sm:mt-3 text-[10px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg
                      ${isRateLimit
                        ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30'
                        : 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                      }
                      transition-all duration-200
                      active:scale-95
                    `}
                  >
                    {retryLabel}
                  </button>
                )}
              </div>

              {/* Botão Fechar */}
              {onDismiss && (
                <button
                  onClick={() => {
                    triggerHaptic('light')
                    onDismiss()
                  }}
                  className="flex-shrink-0 p-0.5 sm:p-1 rounded-lg hover:bg-white/10 transition-all active:scale-95"
                >
                  <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 hover:text-white transition-colors" />
                </button>
              )}
            </div>

            {/* Progress Bar para Rate Limit */}
            {isRateLimit && (
              <div className="mt-2.5 sm:mt-3 h-0.5 sm:h-1 rounded-full bg-black/40 overflow-hidden">
                <motion.div
                  className="h-full bg-amber-500/50"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 15, ease: 'linear' }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * LoadingState - Estado de loading minimalista (Mobile-First)
 */
interface LoadingStateProps {
  isVisible: boolean
  message: string
  subMessage?: string | undefined
}

export function LoadingState({ isVisible, message, subMessage }: LoadingStateProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-black/40 backdrop-blur-2xl border border-gold/20 shadow-lg shadow-gold/20"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gold/20 border border-gold/30">
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-gold animate-spin" strokeWidth={2.5} />
            </div>

            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-gold-light">{message}</p>
              {subMessage && (
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{subMessage}</p>
              )}
            </div>
          </div>

          {/* Shimmer Effect */}
          <motion.div
            className="absolute inset-0 rounded-xl sm:rounded-2xl"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.1), transparent)',
            }}
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
