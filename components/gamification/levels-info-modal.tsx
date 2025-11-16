'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Crown, Sparkles, ChevronRight, TrendingUp } from 'lucide-react'
import { LEVELS } from '@/lib/gamification/level-calculator'

interface LevelsInfoModalProps {
  isOpen: boolean
  onClose: () => void
  currentLevel: number
}

export function LevelsInfoModal({
  isOpen,
  onClose,
  currentLevel
}: LevelsInfoModalProps) {
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
            className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:m-4 bg-gradient-to-br from-gray-950 via-black to-gray-950 sm:rounded-3xl border-0 sm:border border-gold/20 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-60 pointer-events-none" />

            {/* Header Fixo */}
            <div className="relative border-b border-white/10 p-5 sm:p-6 flex-shrink-0 bg-black/40 backdrop-blur-xl">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 hover:border-gold/30 transition-all duration-300 group"
              >
                <X className="h-5 w-5 text-gray-400 group-hover:text-gold transition-colors" />
              </button>

              <div className="flex items-center gap-4 pr-16">
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-gold to-gold-light shadow-2xl shadow-gold/40 border border-gold/30">
                  <Crown className="h-7 w-7 sm:h-8 sm:w-8 text-black" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-gold mb-1">Sistema de Níveis</h2>
                  <p className="text-xs sm:text-sm text-gray-400">15 níveis épicos da organização • Newbie ao GOAT</p>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="relative overflow-y-auto custom-scrollbar flex-1 bg-gradient-to-b from-black/20 to-transparent">
              <div className="p-4 sm:p-6 space-y-2.5 sm:space-y-3">
                {LEVELS.map((level, index) => {
                  const isCurrentLevel = level.level === currentLevel
                  const isPastLevel = level.level < currentLevel

                  return (
                    <motion.div
                      key={level.level}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={`relative p-4 sm:p-5 rounded-xl sm:rounded-2xl border transition-all duration-300 ${
                        isCurrentLevel
                          ? 'bg-gradient-to-br from-gold/15 via-gold/8 to-transparent border-gold/40 shadow-xl shadow-gold/20'
                          : isPastLevel
                          ? 'bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/20'
                          : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Level Badge */}
                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-3xl sm:text-4xl border-2 transition-all ${
                            isCurrentLevel
                              ? `bg-gradient-to-br ${level.color} border-gold/60 shadow-2xl shadow-gold/40 scale-110`
                              : isPastLevel
                              ? `bg-gradient-to-br ${level.color} border-emerald-500/40 opacity-80`
                              : 'bg-gray-900/50 border-gray-700/30'
                          }`}>
                            {level.emoji}
                          </div>
                          <span className={`text-xs font-black ${
                            isCurrentLevel ? 'text-gold' :
                            isPastLevel ? 'text-emerald-400' :
                            'text-gray-600'
                          }`}>
                            Nv {level.level}
                          </span>
                        </div>

                        {/* Level Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className={`text-base sm:text-lg font-black ${
                              isCurrentLevel ? 'text-gold' :
                              isPastLevel ? 'text-white' :
                              'text-gray-500'
                            }`}>
                              {level.name}
                            </h3>
                            {isCurrentLevel && (
                              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-gold/30 to-yellow-500/30 border border-gold/40 text-xs font-black text-gold uppercase tracking-wide">
                                Você está aqui
                              </span>
                            )}
                            {isPastLevel && (
                              <Sparkles className="h-4 w-4 text-emerald-400" />
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-400 mb-3 leading-relaxed">
                            {level.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                              <TrendingUp className="h-3.5 w-3.5 text-gold" />
                              <span className="text-gray-500">
                                XP: <span className="font-bold text-white">{level.xpRequired.toLocaleString()}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Indicador Atual */}
                      {isCurrentLevel && (
                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 hidden sm:block">
                          <div className="bg-gradient-to-r from-gold to-yellow-500 rounded-full p-2 shadow-xl shadow-gold/50 border-2 border-gold/40">
                            <ChevronRight className="h-5 w-5 text-black" strokeWidth={3} />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Footer Fixo com Dica */}
            <div className="relative border-t border-white/10 p-4 sm:p-5 bg-gradient-to-r from-gold/10 via-black/40 to-transparent backdrop-blur-xl flex-shrink-0">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-gold/20 border border-gold/30 flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-gold" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-gold mb-1">Dica Pro</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Respostas ultra-rápidas (&lt; 5 min) dão <span className="font-bold text-gold">DOBRO de XP</span>! Ative notificações para não perder nenhuma pergunta.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
