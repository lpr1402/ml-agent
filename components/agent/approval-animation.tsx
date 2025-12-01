'use client'

/**
 * 🎯 APPROVAL ANIMATION - Premium Brand Experience
 *
 * Animação premium de aprovação com cores da marca (Gold + Black + Emerald).
 * Design inspirado na página de /login - elegante, clean e high-end.
 *
 * Cores da Marca:
 * - Gold (#D4AF37) para loading/processando
 * - Emerald (#10B981) para sucesso
 * - Red (#EF4444) para erros
 * - Amber (#F59E0B) para warnings
 *
 * SEM azul ou roxo - apenas cores da marca!
 *
 * @author ML Agent Team
 * @date 2025-11-24
 */

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'

export type ApprovalAnimationState = 'loading' | 'success' | 'error' | 'warning'

interface ApprovalAnimationProps {
  state: ApprovalAnimationState | null
  message?: string
  details?: string
  onComplete?: () => void
  onRetry?: () => void
  showRetry?: boolean
}

export function ApprovalAnimation({
  state,
  message,
  details,
  onComplete,
  onRetry,
  showRetry = false
}: ApprovalAnimationProps) {
  const [mounted, setMounted] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640)
    return () => setMounted(false)
  }, [])

  React.useEffect(() => {
    if (state === 'success' && onComplete && mounted) {
      const timer = setTimeout(() => {
        onComplete()
      }, 3500)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [state, onComplete, mounted])

  // Configuração visual por estado - CORES DA MARCA
  const getStateConfig = () => {
    switch (state) {
      case 'loading':
        return {
          // Gold para loading - cor principal da marca
          gradient: 'from-gold/15 via-gold-light/10 to-gold/15',
          borderColor: 'border-gold/40',
          glowColor: 'rgba(212, 175, 55, 0.35)',
          icon: null,
          iconBgGradient: 'from-gold/20 to-gold-light/15',
          iconBorderColor: 'border-gold/50',
          primaryText: 'text-gold',
          secondaryText: 'text-gold/70',
          progressColor: 'bg-gradient-to-r from-gold via-gold-light to-gold',
          defaultMessage: 'Enviando ao Mercado Livre...',
          defaultDetails: 'Publicando sua resposta'
        }
      case 'success':
        return {
          // Emerald para sucesso
          gradient: 'from-emerald-500/15 via-green-500/10 to-emerald-500/15',
          borderColor: 'border-emerald-500/40',
          glowColor: 'rgba(16, 185, 129, 0.35)',
          icon: CheckCircle2,
          iconBgGradient: 'from-emerald-500/20 to-green-500/15',
          iconBorderColor: 'border-emerald-400/50',
          primaryText: 'text-emerald-400',
          secondaryText: 'text-emerald-300/80',
          progressColor: 'bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500',
          defaultMessage: 'Publicado!',
          defaultDetails: 'Sua resposta está no Mercado Livre'
        }
      case 'error':
        return {
          gradient: 'from-red-500/15 via-rose-500/10 to-red-500/15',
          borderColor: 'border-red-500/40',
          glowColor: 'rgba(239, 68, 68, 0.3)',
          icon: XCircle,
          iconBgGradient: 'from-red-500/20 to-rose-500/15',
          iconBorderColor: 'border-red-400/50',
          primaryText: 'text-red-400',
          secondaryText: 'text-red-300/80',
          progressColor: 'bg-gradient-to-r from-red-500 via-rose-500 to-red-500',
          defaultMessage: 'Falha no Envio',
          defaultDetails: 'Tente novamente'
        }
      case 'warning':
        return {
          gradient: 'from-amber-500/15 via-yellow-500/10 to-amber-500/15',
          borderColor: 'border-amber-500/40',
          glowColor: 'rgba(245, 158, 11, 0.3)',
          icon: AlertTriangle,
          iconBgGradient: 'from-amber-500/20 to-yellow-500/15',
          iconBorderColor: 'border-amber-400/50',
          primaryText: 'text-amber-400',
          secondaryText: 'text-amber-300/80',
          progressColor: 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500',
          defaultMessage: 'Rate Limit',
          defaultDetails: 'Tentaremos novamente em instantes'
        }
      default:
        return null
    }
  }

  const config = state ? getStateConfig() : null
  const Icon = config?.icon

  return (
    <AnimatePresence mode="wait">
      {state && config && (
        <motion.div
          key={state}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden touch-none will-change-[opacity]"
        >
          {/* Background Premium - Estilo Login Page */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/98 via-black to-gray-900/98 backdrop-blur-2xl rounded-xl sm:rounded-2xl" />

          {/* Glow Effect no Background */}
          <motion.div
            className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-60 rounded-xl sm:rounded-2xl`}
            animate={{
              opacity: [0.4, 0.7, 0.4]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />

          {/* Border Glow Animado */}
          <motion.div
            className={`absolute inset-0 rounded-xl sm:rounded-2xl border ${config.borderColor}`}
            style={{
              boxShadow: `0 0 40px ${config.glowColor}, inset 0 1px 1px rgba(255,255,255,0.05)`
            }}
            animate={{
              opacity: [0.6, 1, 0.6]
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />

          {/* Noise Texture - Premium */}
          <div
            className="absolute inset-0 opacity-[0.02] pointer-events-none rounded-xl sm:rounded-2xl"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat'
            }}
          />

          {/* Partículas de Celebração - Success Only */}
          {state === 'success' && Array.from({ length: isMobile ? 20 : 35 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{
                opacity: 1,
                x: '50%',
                y: '50%',
                scale: 0,
              }}
              animate={{
                opacity: 0,
                x: `${50 + (Math.random() - 0.5) * 160}%`,
                y: `${50 + (Math.random() - 0.5) * 160}%`,
                scale: Math.random() * 2 + 0.5,
                rotate: Math.random() * 720 - 360,
              }}
              transition={{
                duration: 2.5,
                ease: 'easeOut',
                delay: Math.random() * 0.5,
              }}
              className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full"
              style={{
                background: ['#D4AF37', '#F4E4C1', '#10B981', '#34D399', '#A7F3D0'][Math.floor(Math.random() * 5)],
              }}
            />
          ))}

          {/* Main Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -15 }}
            transition={{
              duration: 0.5,
              type: 'spring',
              damping: 28,
              stiffness: 350,
            }}
            className="relative flex flex-col items-center gap-5 sm:gap-6 p-6 sm:p-8"
          >
            {/* Logo Container Premium */}
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                delay: 0.1,
                type: 'spring',
                stiffness: 200,
                damping: 18
              }}
              className="relative"
            >
              {/* Pulse Rings - Gold Branded */}
              {(state === 'loading' || state === 'success') && (
                <>
                  <motion.div
                    className={`absolute inset-0 rounded-2xl border-2 ${config.iconBorderColor}`}
                    animate={{
                      scale: [1, 1.8, 1.8],
                      opacity: [0.5, 0, 0],
                    }}
                    transition={{
                      duration: state === 'loading' ? 1.5 : 2,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  />
                  <motion.div
                    className={`absolute inset-0 rounded-2xl border-2 ${config.iconBorderColor}`}
                    animate={{
                      scale: [1, 1.5, 1.5],
                      opacity: [0.3, 0, 0],
                    }}
                    transition={{
                      duration: state === 'loading' ? 1.5 : 2,
                      repeat: Infinity,
                      ease: 'easeOut',
                      delay: 0.4
                    }}
                  />
                </>
              )}

              {/* Logo Container */}
              <motion.div
                animate={state === 'loading' ? {
                  rotate: [0, 360]
                } : state === 'success' ? {
                  scale: [1, 1.08, 1, 1.04, 1]
                } : {}}
                transition={state === 'loading' ? {
                  duration: 4,
                  repeat: Infinity,
                  ease: 'linear'
                } : state === 'success' ? {
                  duration: 0.8,
                  delay: 0.2,
                  ease: 'easeInOut'
                } : {}}
                className={`relative bg-gradient-to-br ${config.iconBgGradient} rounded-2xl p-4 sm:p-5 border-2 ${config.iconBorderColor} will-change-transform`}
                style={{
                  boxShadow: `0 0 50px ${config.glowColor}, inset 0 1px 2px rgba(255,255,255,0.1)`
                }}
              >
                <Image
                  src="/mlagent-logo-3d.png"
                  alt="ML Agent"
                  width={80}
                  height={80}
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                  priority
                  style={{
                    filter: `drop-shadow(0 8px 20px ${config.glowColor})`
                  }}
                />
              </motion.div>

              {/* Icon Badge (success, error, warning) */}
              {Icon && (
                <motion.div
                  initial={{ scale: 0, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.35,
                    type: 'spring',
                    stiffness: 350,
                    damping: 20
                  }}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2"
                >
                  <div
                    className={`bg-gradient-to-br ${config.iconBgGradient} rounded-full p-1.5 sm:p-2 border ${config.iconBorderColor}`}
                    style={{
                      boxShadow: `0 0 20px ${config.glowColor}`
                    }}
                  >
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${config.primaryText}`} strokeWidth={2.5} />
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Message */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="text-center space-y-2"
            >
              <h3 className={`text-xl sm:text-2xl font-bold ${config.primaryText} tracking-tight`}>
                {message || config.defaultMessage}
              </h3>
              <p className={`text-sm sm:text-base ${config.secondaryText} font-medium max-w-xs`}>
                {details || config.defaultDetails}
              </p>
            </motion.div>

            {/* Progress Bar - Premium Style */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0.8 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="w-full max-w-[200px] sm:max-w-[240px]"
            >
              <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{
                    width: state === 'loading' ? ['0%', '85%'] : '100%'
                  }}
                  transition={state === 'loading' ? {
                    duration: 25,
                    ease: 'easeOut'
                  } : {
                    duration: 3,
                    ease: 'easeOut'
                  }}
                  className={`h-full ${config.progressColor} rounded-full relative overflow-hidden`}
                >
                  {/* Shimmer */}
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: 'linear'
                    }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    style={{ width: '50%' }}
                  />
                </motion.div>
              </div>

              {/* Loading Indicator */}
              {state === 'loading' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center justify-center mt-3 gap-2"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <RefreshCw className="w-3 h-3 text-gold/60" />
                  </motion.div>
                  <span className="text-[10px] sm:text-xs text-gold/70 font-medium">
                    Processando...
                  </span>
                </motion.div>
              )}
            </motion.div>

            {/* Retry Button */}
            {state === 'error' && showRetry && onRetry && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                onClick={onRetry}
                className="mt-1 min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/35 active:scale-95 transition-all duration-200"
              >
                Tentar Novamente
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
