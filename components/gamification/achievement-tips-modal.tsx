'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Lightbulb, Target, TrendingUp, Zap, Trophy } from 'lucide-react'

interface AchievementTipsModalProps {
  isOpen: boolean
  onClose: () => void
  achievement: {
    title: string
    tierName: string
    description: string
    progress: number
    total: number
    xpReward: number
    color: string
    tips: string[]
    currentTier: number
    nextTier: {
      tierName: string
      target: number
      xpReward: number
    } | null
  }
}

export function AchievementTipsModal({
  isOpen,
  onClose,
  achievement
}: AchievementTipsModalProps) {
  const progressPercentage = (achievement.progress / achievement.total) * 100

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center"
        >
          {/* Backdrop FULL-SCREEN */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
            onClick={onClose}
          />

          {/* Modal FULL-SCREEN Mobile / Max-width Desktop */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:m-4 bg-gradient-to-br from-black via-gray-950 to-black sm:rounded-3xl border-0 sm:border-2 border-gold/30 shadow-2xl shadow-gold/20 flex flex-col overflow-hidden"
          >
            {/* Glow Branding */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold/8 via-transparent to-gold/8 opacity-60 animate-pulse pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,215,0,0.12),transparent_60%)] pointer-events-none" />

            {/* Header Fixo */}
            <div className="relative border-b border-gold/20 p-5 sm:p-6 flex-shrink-0 bg-gradient-to-r from-black/60 via-black/80 to-black/60 backdrop-blur-xl">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2.5 rounded-xl bg-black/60 hover:bg-gold/20 border border-white/10 hover:border-gold/40 transition-all duration-300 group"
              >
                <X className="h-5 w-5 text-gray-400 group-hover:text-gold transition-colors" />
              </button>

              <div className="flex items-start gap-4 pr-16">
                <div className={`p-3 sm:p-4 rounded-2xl bg-gradient-to-br ${achievement.color} shadow-2xl border-2 border-white/20 flex-shrink-0`}>
                  <Trophy className="h-6 w-6 sm:h-7 sm:w-7 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl sm:text-2xl font-black text-gold">{achievement.title}</h2>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-400">{achievement.description}</p>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="relative overflow-y-auto custom-scrollbar flex-1 bg-gradient-to-b from-black/20 to-transparent">
              <div className="p-5 sm:p-6 space-y-6">
              {/* Progress Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-gold/20 to-yellow-500/20 border border-gold/30">
                    <Target className="h-5 w-5 text-gold" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-gold">Seu Progresso</h3>
                    <p className="text-xs text-gray-500">{achievement.progress}/{achievement.total} • {Math.round(progressPercentage)}% completo</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-3 bg-black/60 rounded-full overflow-hidden border border-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${achievement.color} rounded-full`}
                  />
                </div>

                <p className="text-xs text-gray-500 text-right">
                  Faltam {achievement.total - achievement.progress} para completar
                </p>
              </div>

              {/* Reward */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-gold/15 to-yellow-500/10 border-2 border-gold/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gold/70 font-medium mb-1">Recompensa</p>
                    <p className="text-3xl font-black text-gold">+{achievement.xpReward} XP</p>
                  </div>
                  <Zap className="h-10 w-10 text-gold" />
                </div>
              </div>

              {/* Tips */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-gold/20 to-yellow-500/20 border border-gold/30">
                    <Lightbulb className="h-5 w-5 text-gold" />
                  </div>
                  <h3 className="text-sm font-bold text-gold">Dicas para Conquistar</h3>
                </div>
                <div className="space-y-2">
                  {achievement.tips.map((tip, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-3 p-3 rounded-xl bg-black/40 border border-gold/10 hover:border-gold/20 transition-all"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-gold to-gold-light border border-gold/40 flex items-center justify-center">
                        <span className="text-xs font-black text-black">{index + 1}</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed flex-1">{tip}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Next Tier Preview */}
              {achievement.nextTier && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                      <TrendingUp className="h-5 w-5 text-purple-400" />
                    </div>
                    <h3 className="text-sm font-bold text-purple-400">Próximo Tier</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-bold text-white mb-1">
                        {achievement.title.split(' ')[0]} {achievement.nextTier.tierName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {achievement.nextTier.target} necessário
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-purple-400">
                        +{achievement.nextTier.xpReward}
                      </p>
                      <p className="text-xs text-gray-500">XP</p>
                    </div>
                  </div>
                </div>
              )}

              </div>
            </div>

            {/* Footer Fixo */}
            <div className="relative border-t border-gold/20 p-4 sm:p-5 bg-gradient-to-r from-black/60 via-black/80 to-black/60 backdrop-blur-xl flex-shrink-0">
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-gold to-gold-light hover:shadow-2xl hover:shadow-gold/40 text-black font-black transition-all duration-300"
              >
                Entendi! Vamos Conquistar!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
