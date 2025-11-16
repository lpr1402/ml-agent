'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, TrendingUp } from 'lucide-react'
import { useEffect } from 'react'

interface XPEarnedToastProps {
  isVisible: boolean
  onClose: () => void
  xpAmount: number
  actionDescription: string
}

export function XPEarnedToast({
  isVisible,
  onClose,
  xpAmount,
  actionDescription
}: XPEarnedToastProps) {
  // Auto-close após 3 segundos
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose()
      }, 3000)

      return () => clearTimeout(timer)
    }
    return undefined
  }, [isVisible, onClose])

  // Som suave de XP
  useEffect(() => {
    if (isVisible) {
      try {
        const audio = new Audio('/notification-new.mp3')
        audio.volume = 0.3
        audio.play().catch(() => {})
      } catch (error) {
        // Silently fail
      }
    }
  }, [isVisible])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -100, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-24 left-1/2 z-[150] pointer-events-auto"
        >
          <div className="relative bg-gradient-to-br from-black via-gray-950 to-black backdrop-blur-xl rounded-2xl border border-gold/30 shadow-2xl shadow-gold/20 overflow-hidden">
            {/* Animated Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold/15 via-transparent to-gold/15 opacity-60 animate-pulse pointer-events-none" />

            {/* Content */}
            <div className="relative p-4 flex items-center gap-4">
              {/* Icon */}
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-gold/60 to-yellow-500/60 rounded-xl blur-xl animate-pulse" />
                <div className="relative bg-gradient-to-br from-gold to-gold-light rounded-xl p-3 border border-gold/40 shadow-lg">
                  <TrendingUp className="h-6 w-6 text-black" strokeWidth={2.5} />
                </div>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-gold flex-shrink-0" />
                  <p className="text-sm font-bold text-white truncate">{actionDescription}</p>
                </div>
                <p className="text-xs text-gray-400">Você ganhou XP!</p>
              </div>

              {/* XP Amount */}
              <div className="flex-shrink-0 text-right">
                <motion.p
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-2xl font-black text-gold"
                >
                  +{xpAmount}
                </motion.p>
                <p className="text-xs text-gold/60 font-medium">XP</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-black/60">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 3, ease: 'linear' }}
                className="h-full bg-gradient-to-r from-gold via-yellow-500 to-gold"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
