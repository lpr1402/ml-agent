'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Award, Zap, Flame, Target, Clock, Star } from 'lucide-react'

interface AchievementsInfoModalProps {
  isOpen: boolean
  onClose: () => void
}

const ACHIEVEMENT_TYPES = [
  {
    name: 'Flash',
    icon: Zap,
    color: 'from-yellow-500 to-orange-500',
    description: 'Respostas ultra-rápidas (< 5 minutos)',
    tiers: [
      { tier: 'Bronze', target: 5, xp: 200 },
      { tier: 'Prata', target: 25, xp: 500 },
      { tier: 'Ouro', target: 50, xp: 1200 },
      { tier: 'Platina', target: 100, xp: 3000 },
      { tier: 'Diamante', target: 250, xp: 7500 }
    ],
    tip: 'Esta é a conquista mais valiosa! DOBRO de XP por resposta.'
  },
  {
    name: 'Velocista',
    icon: Zap,
    color: 'from-blue-500 to-cyan-500',
    description: 'Respostas rápidas (< 30 minutos)',
    tiers: [
      { tier: 'Bronze', target: 10, xp: 100 },
      { tier: 'Prata', target: 50, xp: 300 },
      { tier: 'Ouro', target: 100, xp: 750 },
      { tier: 'Platina', target: 200, xp: 2000 },
      { tier: 'Diamante', target: 500, xp: 5000 }
    ],
    tip: 'Responder rápido aumenta satisfação do cliente.'
  },
  {
    name: 'Combo Master',
    icon: Flame,
    color: 'from-red-500 to-orange-500',
    description: 'Sequências de respostas seguidas',
    tiers: [
      { tier: 'Bronze', target: 5, xp: 150 },
      { tier: 'Prata', target: 10, xp: 400 },
      { tier: 'Ouro', target: 20, xp: 1000 },
      { tier: 'Platina', target: 50, xp: 2500 },
      { tier: 'Diamante', target: 100, xp: 6000 }
    ],
    tip: 'Sequências maiores multiplicam seu XP!'
  },
  {
    name: 'Qualidade Premium',
    icon: Star,
    color: 'from-purple-500 to-pink-500',
    description: 'Aprovadas na primeira tentativa',
    tiers: [
      { tier: 'Bronze', target: 20, xp: 100 },
      { tier: 'Prata', target: 100, xp: 400 },
      { tier: 'Ouro', target: 200, xp: 1000 },
      { tier: 'Platina', target: 500, xp: 2500 },
      { tier: 'Diamante', target: 1000, xp: 6000 }
    ],
    tip: 'O ML Agent já sugere respostas excelentes.'
  },
  {
    name: 'Madrugador',
    icon: Clock,
    color: 'from-cyan-500 to-blue-500',
    description: 'Respostas antes das 8h',
    tiers: [
      { tier: 'Bronze', target: 5, xp: 100 },
      { tier: 'Prata', target: 20, xp: 350 },
      { tier: 'Ouro', target: 50, xp: 900 },
      { tier: 'Platina', target: 100, xp: 2200 },
      { tier: 'Diamante', target: 200, xp: 5500 }
    ],
    tip: 'Ganhe +25 XP de bônus em cada uma!'
  },
  {
    name: 'Contador de Histórias',
    icon: Target,
    color: 'from-green-500 to-emerald-500',
    description: 'Total de perguntas respondidas',
    tiers: [
      { tier: 'Bronze', target: 50, xp: 200 },
      { tier: 'Prata', target: 200, xp: 600 },
      { tier: 'Ouro', target: 500, xp: 1500 },
      { tier: 'Platina', target: 1000, xp: 4000 },
      { tier: 'Diamante', target: 2500, xp: 10000 }
    ],
    tip: 'Consistência é a chave do sucesso!'
  }
]

export function AchievementsInfoModal({
  isOpen,
  onClose
}: AchievementsInfoModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:m-4 bg-gradient-to-br from-gray-950 via-black to-gray-950 sm:rounded-3xl border-0 sm:border border-gold/20 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-60 pointer-events-none" />

            {/* Header */}
            <div className="relative border-b border-white/10 p-5 sm:p-6 flex-shrink-0 bg-black/40 backdrop-blur-xl">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 hover:border-gold/30 transition-all duration-300 group"
              >
                <X className="h-5 w-5 text-gray-400 group-hover:text-gold transition-colors" />
              </button>

              <div className="flex items-center gap-4 pr-16">
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-gold to-gold-light shadow-2xl shadow-gold/40 border border-gold/30">
                  <Award className="h-7 w-7 sm:h-8 sm:w-8 text-black" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-gold mb-1">Sistema de Conquistas</h2>
                  <p className="text-xs sm:text-sm text-gray-400">6 tipos • 5 tiers cada • 30 conquistas totais</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="relative overflow-y-auto custom-scrollbar flex-1 bg-gradient-to-b from-black/20 to-transparent">
              <div className="p-4 sm:p-6 space-y-4">
                {ACHIEVEMENT_TYPES.map((type, index) => {
                  const TypeIcon = type.icon

                  return (
                    <motion.div
                      key={type.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative p-5 rounded-2xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/10 hover:border-gold/20 transition-all"
                    >
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${type.color} shadow-lg`}>
                          <TypeIcon className="h-6 w-6 text-white" strokeWidth={2.5} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">{type.name}</h3>
                          <p className="text-xs text-gray-400">{type.description}</p>
                        </div>
                      </div>

                      {/* Tiers Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-3">
                        {type.tiers.map((tier, tierIndex) => (
                          <div
                            key={tier.tier}
                            className={`p-3 rounded-lg border text-center ${
                              tierIndex === 0 ? 'bg-amber-900/20 border-amber-600/30' :
                              tierIndex === 1 ? 'bg-gray-700/20 border-gray-400/30' :
                              tierIndex === 2 ? 'bg-gold/10 border-gold/30' :
                              tierIndex === 3 ? 'bg-cyan-900/20 border-cyan-500/30' :
                              'bg-purple-900/20 border-purple-500/30'
                            }`}
                          >
                            <p className="text-xs font-bold text-white mb-1">{tier.tier}</p>
                            <p className="text-xs text-gray-400 mb-1">{tier.target}x</p>
                            <p className="text-xs font-bold text-gold">+{tier.xp}</p>
                          </div>
                        ))}
                      </div>

                      {/* Tip */}
                      <div className="p-3 rounded-lg bg-gold/10 border border-gold/20">
                        <p className="text-xs text-gold font-medium">{type.tip}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="relative border-t border-white/10 p-4 sm:p-5 bg-black/40 backdrop-blur-xl flex-shrink-0">
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-gold to-gold-light hover:shadow-lg hover:shadow-gold/30 text-black font-bold transition-all duration-300"
              >
                Entendi!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
