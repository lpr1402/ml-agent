'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Zap, Star, Clock, TrendingUp, Calendar, Trophy } from 'lucide-react'

interface XPSystemInfoModalProps {
  isOpen: boolean
  onClose: () => void
}

export function XPSystemInfoModal({
  isOpen,
  onClose
}: XPSystemInfoModalProps) {
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
            className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:m-4 bg-gradient-to-br from-black via-gray-950 to-black sm:rounded-3xl border-0 sm:border-2 border-gold/30 shadow-2xl shadow-gold/20 flex flex-col overflow-hidden"
          >
            {/* Glow Branding ML Agent */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold/8 via-transparent to-gold/8 opacity-60 animate-pulse pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,215,0,0.12),transparent_60%)] pointer-events-none" />

            {/* Header */}
            <div className="relative border-b border-gold/20 p-5 sm:p-6 flex-shrink-0 bg-gradient-to-r from-black/60 via-black/80 to-black/60 backdrop-blur-xl">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2.5 rounded-xl bg-black/60 hover:bg-gold/20 border border-white/10 hover:border-gold/40 transition-all duration-300 group"
              >
                <X className="h-5 w-5 text-gray-400 group-hover:text-gold transition-colors" />
              </button>

              <div className="flex items-center gap-4 pr-16">
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-gold to-gold-light shadow-2xl shadow-gold/40 border-2 border-gold/40">
                  <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-black" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent mb-1">
                    Sistema de XP
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400">Como ganhar pontos e subir de nível</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="relative overflow-y-auto custom-scrollbar flex-1">
              <div className="p-4 sm:p-6 space-y-5">
                {/* XP Base por Tempo - BRANDING GOLD */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-gold/20 to-yellow-500/20 border border-gold/30">
                      <Zap className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gold">Velocidade de Resposta</h3>
                      <p className="text-xs text-gray-500">Quanto mais rápido, mais XP!</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { time: '< 5 min', xp: 150, label: 'ULTRA', color: 'from-gold via-gold-light to-gold', bonus: 'x2 XP!' },
                      { time: '< 15 min', xp: 75, label: 'Flash', color: 'from-yellow-600 to-orange-600' },
                      { time: '< 30 min', xp: 50, label: 'Rápido', color: 'from-orange-600 to-red-600' },
                      { time: '< 1h', xp: 30, label: 'Normal', color: 'from-gray-500 to-gray-600' },
                      { time: '< 2h', xp: 15, label: 'Ok', color: 'from-gray-600 to-gray-700' },
                      { time: '> 2h', xp: 10, label: 'Básico', color: 'from-gray-700 to-gray-800' }
                    ].map((item) => (
                      <div key={item.time} className={`p-3 rounded-xl bg-gradient-to-br ${item.color} ${item.bonus ? 'ring-2 ring-gold/50 shadow-lg shadow-gold/20' : ''} border border-white/10`}>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-black">{item.time}</span>
                          <span className="text-lg font-black text-black">+{item.xp}</span>
                          <p className="text-[10px] text-black/80 font-semibold">{item.label}</p>
                          {item.bonus && (
                            <p className="text-[10px] font-black text-black bg-white/90 px-1.5 py-0.5 rounded-md mt-1 shadow-sm">{item.bonus}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bônus de Qualidade - GOLD */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-gold/20 to-yellow-500/20 border border-gold/30">
                      <Star className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gold">Bônus de Qualidade</h3>
                      <p className="text-xs text-gray-500">Respostas bem elaboradas</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-gold/10 to-yellow-500/10 border border-gold/20">
                      <p className="text-sm font-bold text-gold mb-1">+50 XP</p>
                      <p className="text-xs text-gray-400">Primeira aprovação</p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-gold/10 to-yellow-500/10 border border-gold/20">
                      <p className="text-sm font-bold text-gold mb-1">+25 XP</p>
                      <p className="text-xs text-gray-400">Completa (&gt;100 chars)</p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-gold/10 to-yellow-500/10 border border-gold/20">
                      <p className="text-sm font-bold text-gold mb-1">+50 XP</p>
                      <p className="text-xs text-gray-400">Detalhada (&gt;200 chars)</p>
                    </div>
                  </div>
                </div>

                {/* Bônus de Horário */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-gold/20 to-yellow-500/20 border border-gold/30">
                      <Clock className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gold">Bônus de Horário</h3>
                      <p className="text-xs text-gray-500">Dedicação extra recompensada</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-3 rounded-xl bg-black/40 border border-gold/15">
                      <p className="text-sm font-bold text-gold mb-1">+50 XP</p>
                      <p className="text-xs text-gray-400">Madrugada (00h-06h)</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-gold/15">
                      <p className="text-sm font-bold text-gold mb-1">+25 XP</p>
                      <p className="text-xs text-gray-400">Manhã (06h-08h)</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-gold/15">
                      <p className="text-sm font-bold text-gold mb-1">+25 XP</p>
                      <p className="text-xs text-gray-400">Noite (22h-00h)</p>
                    </div>
                  </div>
                </div>

                {/* Combos - GOLD */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-gold/20 to-yellow-500/20 border border-gold/30">
                      <TrendingUp className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gold">Combos de Sequência</h3>
                      <p className="text-xs text-gray-500">Respostas seguidas multiplicam XP</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { streak: '3x', xp: 75, emoji: '🔥' },
                      { streak: '5x', xp: 150, emoji: '💥' },
                      { streak: '10x', xp: 300, emoji: '⚡' },
                      { streak: '20x', xp: 750, emoji: '💫' }
                    ].map((combo) => (
                      <div key={combo.streak} className="p-3 rounded-xl bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-500/30 text-center">
                        <span className="text-2xl mb-1 block">{combo.emoji}</span>
                        <p className="text-sm font-bold text-orange-400 mb-1">+{combo.xp}</p>
                        <p className="text-xs text-gray-400">{combo.streak} seguidas</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Multiplicador Especial */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-gold/15 via-gold/8 to-transparent border-2 border-gold/30 shadow-xl shadow-gold/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-gold to-gold-light">
                      <Calendar className="h-6 w-6 text-black" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-gold">Multiplicador de Fim de Semana</p>
                      <p className="text-xs text-gray-400">Sábado e Domingo</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-black/40 border border-gold/20">
                    <Trophy className="h-8 w-8 text-gold" />
                    <span className="text-4xl font-black bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
                      x1.5
                    </span>
                    <Sparkles className="h-8 w-8 text-gold" />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="relative border-t border-gold/20 p-4 sm:p-5 bg-gradient-to-r from-black/60 via-black/80 to-black/60 backdrop-blur-xl flex-shrink-0">
              <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-gold/10 to-yellow-500/10 border border-gold/20">
                <p className="text-xs text-center text-gold font-semibold">
                  💡 Dica Pro: Respostas ultra-rápidas (&lt; 5 min) dão DOBRO de XP!
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-gold to-gold-light hover:shadow-2xl hover:shadow-gold/40 text-black font-black transition-all duration-300 text-sm sm:text-base"
              >
                Entendi! Vamos Ganhar XP!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
