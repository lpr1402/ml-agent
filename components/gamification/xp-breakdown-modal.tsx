'use client'

/**
 * XP BREAKDOWN MODAL 2.0
 * Modal detalhado mostrando exatamente como o XP foi calculado
 * Exibido apos aprovacao de pergunta
 *
 * Usando branding gold/black e avatares DiceBear
 */

import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Star, Flame, Clock, User } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { XPBreakdown, SpeedTier } from '@/lib/gamification/xp-calculator'
import { getCharacterAvatar } from '@/lib/gamification/characters-data'

interface XPBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
  breakdown: XPBreakdown | null
  levelProgress?: {
    level: number
    name: string
    progressPercent: number
    xpToNextLevel: number
    nextLevelName?: string
  }
}

const SPEED_TIER_CONFIG: Record<SpeedTier, { color: string; bgColor: string; label: string }> = {
  S: { color: 'text-gold', bgColor: 'bg-gold/20', label: 'LIGHTNING' },
  A: { color: 'text-amber-400', bgColor: 'bg-amber-500/20', label: 'ULTRA' },
  B: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', label: 'RAPIDO' },
  C: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'BOM' },
  D: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', label: 'NORMAL' },
  E: { color: 'text-gray-500', bgColor: 'bg-gray-600/20', label: 'LENTO' },
  F: { color: 'text-gray-600', bgColor: 'bg-gray-700/20', label: 'MUITO LENTO' }
}

export function XPBreakdownModal({ isOpen, onClose, breakdown, levelProgress }: XPBreakdownModalProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [animatedTotal, setAnimatedTotal] = useState(0)

  // Animate the total XP counter
  useEffect(() => {
    if (!isOpen || !breakdown) {
      return
    }

    setShowDetails(false)
    setAnimatedTotal(0)

    const duration = 1000 // 1 second animation
    const steps = 30
    const increment = breakdown.total / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      if (current >= breakdown.total) {
        setAnimatedTotal(breakdown.total)
        clearInterval(timer)
        setTimeout(() => setShowDetails(true), 200)
      } else {
        setAnimatedTotal(Math.floor(current))
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [isOpen, breakdown])

  // Auto close after 6 seconds
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const timer = setTimeout(() => {
      onClose()
    }, 6000)
    return () => clearTimeout(timer)
  }, [isOpen, onClose])

  if (!breakdown) return null

  const tierConfig = SPEED_TIER_CONFIG[breakdown.speedTier]
  const isLightning = breakdown.speedTier === 'S'
  const isUltraFast = breakdown.speedTier === 'A'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm bg-gradient-to-b from-gray-900 via-gray-950 to-black rounded-2xl border border-gold/20 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightning effect for S tier */}
            {isLightning && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-b from-gold/20 to-transparent pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.5, 1, 0.5] }}
                transition={{ duration: 0.5 }}
              />
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-gray-800 transition-colors z-10 border border-white/10"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>

            {/* Header - XP Total */}
            <div className="pt-6 pb-4 px-6 text-center">
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: [0.5, 1.2, 1] }}
                transition={{ duration: 0.5, times: [0, 0.6, 1] }}
                className="mb-2"
              >
                <span className={`text-5xl font-bold ${isLightning ? 'text-gold' : isUltraFast ? 'text-amber-400' : 'text-white'}`}>
                  +{animatedTotal}
                </span>
                <span className="text-2xl text-gray-400 ml-1">XP</span>
              </motion.div>

              {/* Speed tier badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${tierConfig.bgColor} border-white/10`}
              >
                <Zap className={`w-4 h-4 ${tierConfig.color}`} />
                <span className={`font-semibold ${tierConfig.color}`}>
                  {breakdown.speedLabel}
                </span>
                <span className={`text-sm ${tierConfig.color} opacity-80`}>
                  ({breakdown.speedMultiplier}x)
                </span>
              </motion.div>
            </div>

            {/* Breakdown details */}
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 pb-4"
                >
                  <div className="space-y-2">
                    {/* Speed XP */}
                    <BreakdownRow
                      icon={<Zap className="w-4 h-4" />}
                      iconColor={tierConfig.color}
                      label={`VELOCIDADE (${breakdown.speedMultiplier}x)`}
                      value={`${breakdown.baseXP} → ${breakdown.speedXP}`}
                      highlight={isLightning || isUltraFast}
                    />

                    {/* Quality bonus */}
                    {breakdown.qualityBonus > 0 && (
                      <BreakdownRow
                        icon={<Star className="w-4 h-4" />}
                        iconColor="text-violet-400"
                        label="QUALIDADE"
                        value={`+${breakdown.qualityBonus}`}
                        subLabel={breakdown.qualityDetails.join(', ')}
                      />
                    )}

                    {/* Streak bonus */}
                    {breakdown.streakBonus > 0 && (
                      <BreakdownRow
                        icon={<Flame className="w-4 h-4" />}
                        iconColor="text-orange-500"
                        label={`STREAK (${breakdown.streakDays} dias)`}
                        value={`+${breakdown.streakBonus}`}
                        highlight
                      />
                    )}

                    {/* Schedule bonus */}
                    {breakdown.scheduleBonus > 0 && (
                      <BreakdownRow
                        icon={<Clock className="w-4 h-4" />}
                        iconColor="text-blue-400"
                        label={breakdown.scheduleLabel || 'HORARIO'}
                        value={`+${breakdown.scheduleBonus}`}
                      />
                    )}

                    {/* Character multiplier */}
                    {breakdown.characterMultiplier > 1 && (
                      <BreakdownRow
                        icon={
                          breakdown.characterAvatarSeed ? (
                            <Image
                              src={getCharacterAvatar(breakdown.characterAvatarSeed, 16)}
                              alt={breakdown.characterName}
                              width={16}
                              height={16}
                              className="rounded-full"
                              unoptimized
                            />
                          ) : (
                            <User className="w-4 h-4" />
                          )
                        }
                        iconColor="text-gold"
                        label={`BONUS ${breakdown.characterName.toUpperCase()}`}
                        value={`x${breakdown.characterMultiplier.toFixed(2)}`}
                        highlight
                      />
                    )}
                  </div>

                  {/* Divider */}
                  <div className="my-4 border-t border-gray-800" />

                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-medium">TOTAL</span>
                    <span className={`text-xl font-bold ${isLightning ? 'text-gold' : 'text-white'}`}>
                      {breakdown.total} XP
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Level progress */}
            {levelProgress && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="px-6 pb-6"
              >
                <div className="p-3 bg-black/40 rounded-xl border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-300">
                        Level {levelProgress.level}
                      </span>
                      <span className="text-sm text-gray-500">
                        {levelProgress.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {levelProgress.progressPercent}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-gold to-amber-500 rounded-full"
                      initial={{ width: `${Math.max(0, levelProgress.progressPercent - 5)}%` }}
                      animate={{ width: `${levelProgress.progressPercent}%` }}
                      transition={{ duration: 0.5, delay: 1 }}
                    />
                  </div>

                  <div className="mt-2 text-xs text-gray-500 text-center">
                    {levelProgress.xpToNextLevel > 0 ? (
                      <>
                        {levelProgress.xpToNextLevel.toLocaleString()} XP para{' '}
                        <span className="text-gray-400">Level {levelProgress.level + 1}</span>
                        {levelProgress.nextLevelName && (
                          <span className="text-gray-500"> ({levelProgress.nextLevelName})</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gold">NIVEL MAXIMO!</span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tap to close hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="pb-4 text-center"
            >
              <span className="text-xs text-gray-600">Toque para fechar</span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Breakdown row component
function BreakdownRow({
  icon,
  iconColor,
  label,
  value,
  subLabel,
  highlight
}: {
  icon: React.ReactNode
  iconColor: string
  label: string
  value: string
  subLabel?: string
  highlight?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center justify-between p-2 rounded-lg ${highlight ? 'bg-gold/10 border border-gold/20' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className={iconColor}>{icon}</span>
        <div>
          <span className="text-sm text-gray-300">{label}</span>
          {subLabel && (
            <span className="block text-xs text-gray-500">{subLabel}</span>
          )}
        </div>
      </div>
      <span className={`text-sm font-medium ${highlight ? 'text-gold' : 'text-gray-400'}`}>
        {value}
      </span>
    </motion.div>
  )
}

// Export type for usage in other components
export type { XPBreakdownModalProps }
