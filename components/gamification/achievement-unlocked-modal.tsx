'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy,
  Zap,
  Target,
  Clock,
  Star,
  Flame,
  X,
  Sparkles
} from 'lucide-react'
import { useEffect } from 'react'

interface AchievementUnlockedModalProps {
  isOpen: boolean
  onClose: () => void
  achievement: {
    title: string
    description: string
    xpReward: number
    iconType: string
    color: string
    rarity: string
  }
}

const ACHIEVEMENT_ICONS: Record<string, typeof Zap> = {
  speed: Zap,
  dedication: Flame,
  early_bird: Clock,
  milestone: Target,
  quality: Star,
  streak: Flame
}

const RARITY_CONFIG: Record<string, { glow: string; border: string; text: string }> = {
  legendary: {
    glow: 'from-gold/60 to-yellow-500/60',
    border: 'border-gold/50',
    text: 'text-gold'
  },
  epic: {
    glow: 'from-purple-500/60 to-pink-500/60',
    border: 'border-purple-500/50',
    text: 'text-purple-400'
  },
  rare: {
    glow: 'from-blue-500/60 to-cyan-500/60',
    border: 'border-blue-500/50',
    text: 'text-blue-400'
  },
  common: {
    glow: 'from-gray-500/60 to-gray-600/60',
    border: 'border-gray-500/50',
    text: 'text-gray-400'
  }
}

export function AchievementUnlockedModal({
  isOpen,
  onClose,
  achievement
}: AchievementUnlockedModalProps) {
  const AchievementIcon = ACHIEVEMENT_ICONS[achievement.iconType] || Trophy
  const rarityConfig = RARITY_CONFIG[achievement.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG['common']!

  // Auto-close após 6 segundos
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 6000)

      return () => clearTimeout(timer)
    }
    return undefined
  }, [isOpen, onClose])

  // Reproduzir som de conquista
  useEffect(() => {
    if (isOpen) {
      try {
        const audio = new Audio('/notification-new.mp3')
        audio.volume = 0.6
        audio.play().catch(() => {})
      } catch (error) {
        // Silently fail
      }
    }
    return undefined
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
            className="absolute inset-0 bg-black/70 backdrop-blur-lg pointer-events-auto"
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotateY: -90 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotateY: 90 }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 20,
              duration: 0.6
            }}
            className={`relative bg-gradient-to-br from-black via-gray-950 to-black backdrop-blur-xl rounded-3xl border-2 ${rarityConfig.border} shadow-2xl max-w-lg w-full overflow-hidden pointer-events-auto`}
            style={{
              transformStyle: 'preserve-3d'
            }}
          >
            {/* Animated Background Glow */}
            <div className={`absolute inset-0 bg-gradient-to-br ${rarityConfig.glow} opacity-30 animate-pulse pointer-events-none`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.15),transparent_60%)] pointer-events-none" />

            {/* Confetti effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ y: -20, opacity: 1, x: Math.random() * 100 + '%' }}
                  animate={{
                    y: '100vh',
                    opacity: 0,
                    rotate: Math.random() * 360
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    delay: Math.random() * 0.5,
                    ease: 'easeOut'
                  }}
                  className={`absolute w-2 h-2 rounded-full ${
                    i % 3 === 0 ? 'bg-gold' :
                    i % 3 === 1 ? 'bg-yellow-500' :
                    'bg-orange-500'
                  }`}
                />
              ))}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 z-10 p-2 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 transition-all duration-200"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-white" />
            </button>

            {/* Content */}
            <div className="relative p-8 sm:p-12 flex flex-col items-center text-center space-y-6">
              {/* Achievement Badge */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                className="relative"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${rarityConfig.glow} rounded-3xl blur-3xl scale-150 animate-pulse`} />
                <div className={`relative bg-gradient-to-br ${achievement.color} rounded-2xl p-8 border-2 border-white/20 shadow-2xl`}>
                  <AchievementIcon className="h-16 w-16 text-white" strokeWidth={2.5} />
                </div>
              </motion.div>

              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className={`h-5 w-5 ${rarityConfig.text}`} />
                  <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide">
                    Conquista Desbloqueada!
                  </h2>
                  <Sparkles className={`h-5 w-5 ${rarityConfig.text}`} />
                </div>

                <h3 className={`text-2xl sm:text-3xl font-black ${rarityConfig.text}`}>
                  {achievement.title}
                </h3>

                <p className="text-sm sm:text-base text-gray-400 leading-relaxed max-w-sm">
                  {achievement.description}
                </p>
              </motion.div>

              {/* XP Reward */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7, type: 'spring', stiffness: 300 }}
                className="w-full px-8 py-5 rounded-2xl bg-gradient-to-br from-gold/10 to-yellow-500/10 border border-gold/30 backdrop-blur-sm"
              >
                <p className="text-sm text-gold/70 font-medium mb-1">Recompensa</p>
                <p className="text-4xl font-black text-gold">+{achievement.xpReward} XP</p>
              </motion.div>

              {/* Rarity Badge */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className={`px-4 py-2 rounded-full ${rarityConfig.text} bg-black/40 border ${rarityConfig.border} backdrop-blur-sm`}
              >
                <span className="text-xs font-bold uppercase tracking-wider">
                  {achievement.rarity === 'legendary' ? '⚡ Lendária' :
                   achievement.rarity === 'epic' ? '🔥 Épica' :
                   achievement.rarity === 'rare' ? '💎 Rara' :
                   '⭐ Comum'}
                </span>
              </motion.div>

              {/* Progress Bar */}
              <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ delay: 1, duration: 4, ease: 'linear' }}
                  className="h-full bg-gradient-to-r from-gold via-yellow-500 to-gold"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
