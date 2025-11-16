'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Crown, Sparkles, X } from 'lucide-react'
import Image from 'next/image'
import { useEffect } from 'react'

interface LevelUpModalProps {
  isOpen: boolean
  onClose: () => void
  oldLevel: number
  newLevel: number
  levelName: string
  levelColor: string
  totalXP: number
}

export function LevelUpModal({
  isOpen,
  onClose,
  oldLevel,
  newLevel,
  levelName,
  levelColor,
  totalXP
}: LevelUpModalProps) {
  // Auto-close após 5 segundos
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 5000)

      return () => clearTimeout(timer)
    }
    return undefined
  }, [isOpen, onClose])

  // Reproduzir som de level up
  useEffect(() => {
    if (isOpen) {
      try {
        const audio = new Audio('/notification-new.mp3')
        audio.volume = 0.5
        audio.play().catch(() => {})
      } catch (error) {
        // Silently fail
      }
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none"
        >
          {/* Backdrop com blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-auto"
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 25,
              duration: 0.5
            }}
            className="relative bg-gradient-to-br from-black via-gray-950 to-black backdrop-blur-xl rounded-3xl border border-gold/30 shadow-2xl max-w-md w-full overflow-hidden pointer-events-auto"
          >
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold/20 via-transparent to-gold/20 opacity-40 animate-pulse pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,215,0,0.15),transparent_60%)] pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 transition-all duration-200"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-white" />
            </button>

            {/* Content */}
            <div className="relative p-8 sm:p-10 flex flex-col items-center text-center space-y-6">
              {/* ML Agent Logo com glow */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-gold/60 to-yellow-500/60 rounded-full blur-3xl scale-150 animate-pulse" />
                <Image
                  src="/mlagent-logo-3d.svg"
                  alt="ML Agent"
                  width={80}
                  height={80}
                  className="relative drop-shadow-2xl"
                  style={{
                    filter: 'drop-shadow(0 20px 50px rgba(255, 215, 0, 0.5))'
                  }}
                  priority
                />
              </motion.div>

              {/* Level Up Badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-gold/60 to-yellow-500/60 rounded-3xl blur-2xl animate-pulse" />
                <div className="relative bg-gradient-to-br from-gold to-gold-light rounded-2xl p-6 border-2 border-gold/50 shadow-2xl shadow-gold/50">
                  <Crown className="h-16 w-16 text-black" strokeWidth={2.5} />
                </div>
              </motion.div>

              {/* Level Numbers */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <h2 className="text-2xl sm:text-3xl font-black text-gold uppercase tracking-wider">
                  Level Up!
                </h2>

                <div className="flex items-center justify-center gap-4">
                  <span className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-gray-500 to-gray-600 bg-clip-text text-transparent">
                    {oldLevel}
                  </span>
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Sparkles className="h-8 w-8 text-gold" />
                  </motion.div>
                  <span className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
                    {newLevel}
                  </span>
                </div>

                <p className={`text-xl sm:text-2xl font-bold bg-gradient-to-r ${levelColor} bg-clip-text text-transparent`}>
                  {levelName}
                </p>
              </motion.div>

              {/* XP Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="w-full px-6 py-4 rounded-xl bg-black/40 border border-gold/20"
              >
                <p className="text-sm text-gray-400 mb-1">XP Total</p>
                <p className="text-2xl font-bold text-gold">{totalXP.toLocaleString()}</p>
              </motion.div>

              {/* Progress Bar Animation */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10"
              >
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ delay: 0.8, duration: 2, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-gold via-yellow-500 to-gold"
                />
              </motion.div>

              {/* Motivational Message */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-sm text-gray-400"
              >
                Continue assim para alcançar o próximo nível!
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
