'use client'

/**
 * LEVEL UP MODAL 2.0
 * Modal de celebração para level up com evolução de personagem
 *
 * Design: Mobile-first, branding gold/black/amber
 * Features: 100 níveis, 10 personagens, DiceBear avatars
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Crown, Sparkles, X, ArrowRight, Star } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { Character } from '@/lib/gamification/characters-data'
import { getCharacterAvatar } from '@/lib/gamification/characters-data'
import { cn } from '@/lib/utils'

interface LevelUpModalProps {
  isOpen: boolean
  onClose: () => void
  oldLevel: number
  newLevel: number
  levelName: string
  levelEmoji?: string
  levelColor: string
  totalXP: number
  characterEvolved?: boolean
  oldCharacter?: Character | null
  newCharacter?: Character | null
}

export function LevelUpModal({
  isOpen,
  onClose,
  oldLevel,
  newLevel,
  levelName,
  levelColor,
  totalXP,
  characterEvolved = false,
  oldCharacter,
  newCharacter
}: LevelUpModalProps) {
  const [showCharacterEvolution, setShowCharacterEvolution] = useState(false)
  const [animatedLevel, setAnimatedLevel] = useState(oldLevel)

  // Animate level number
  useEffect(() => {
    if (isOpen) {
      setAnimatedLevel(oldLevel)
      setShowCharacterEvolution(false)

      // Animate level counting
      const timer = setTimeout(() => {
        setAnimatedLevel(newLevel)
      }, 600)

      // Show character evolution after level animation
      if (characterEvolved) {
        const evolutionTimer = setTimeout(() => setShowCharacterEvolution(true), 2000)
        return () => {
          clearTimeout(timer)
          clearTimeout(evolutionTimer)
        }
      }

      return () => clearTimeout(timer)
    }
    return undefined
  }, [isOpen, oldLevel, newLevel, characterEvolved])

  // Auto-close
  useEffect(() => {
    if (isOpen) {
      const closeDelay = characterEvolved ? 8000 : 5000
      const timer = setTimeout(onClose, closeDelay)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [isOpen, characterEvolved, onClose])

  // Sound effect
  useEffect(() => {
    if (isOpen) {
      try {
        const audio = new Audio('/notification-new.mp3')
        audio.volume = 0.5
        audio.play().catch(() => {})
      } catch {
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
          className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4"
        >
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-lg"
            onClick={onClose}
          />

          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-gold rounded-full"
                initial={{
                  x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 400),
                  y: typeof window !== 'undefined' ? window.innerHeight + 20 : 800,
                  opacity: 0.6
                }}
                animate={{
                  y: -20,
                  opacity: 0
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: i * 0.5,
                  ease: "linear"
                }}
              />
            ))}
          </div>

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={cn(
              "relative w-full max-w-[340px] sm:max-w-sm overflow-hidden",
              "bg-gradient-to-b from-gray-900 via-black to-black",
              "rounded-2xl sm:rounded-3xl",
              "border border-gold/30",
              "shadow-2xl shadow-gold/20"
            )}
          >
            {/* Gold gradient top border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />

            {/* Background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.15),transparent_50%)] pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className={cn(
                "absolute top-3 right-3 z-10",
                "p-2 rounded-full",
                "bg-black/60 hover:bg-black/80",
                "border border-white/10 hover:border-white/20",
                "transition-all duration-200",
                "touch-manipulation"
              )}
            >
              <X className="h-4 w-4 text-gray-400 hover:text-white" />
            </button>

            <div className="relative p-5 sm:p-8 flex flex-col items-center text-center">
              {/* Content switching between level up and character evolution */}
              <AnimatePresence mode="wait">
                {showCharacterEvolution && characterEvolved && oldCharacter && newCharacter ? (
                  <motion.div
                    key="evolution"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full"
                  >
                    <CharacterEvolutionView
                      oldCharacter={oldCharacter}
                      newCharacter={newCharacter}
                      newLevel={newLevel}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="levelup"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full"
                  >
                    <StandardLevelUpView
                      oldLevel={oldLevel}
                      animatedLevel={animatedLevel}
                      levelName={levelName}
                      levelColor={levelColor}
                      totalXP={totalXP}
                      hasCharacterEvolution={characterEvolved}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Standard level up view
function StandardLevelUpView({
  oldLevel,
  animatedLevel,
  levelName,
  levelColor,
  totalXP,
  hasCharacterEvolution
}: {
  oldLevel: number
  animatedLevel: number
  levelName: string
  levelColor: string
  totalXP: number
  hasCharacterEvolution: boolean
}) {
  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Logo with epic glow */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="relative mx-auto w-fit"
      >
        {/* Outer glow */}
        <div className="absolute inset-0 -m-4 bg-gold/30 rounded-full blur-2xl animate-pulse" />

        {/* Logo */}
        <div className="relative">
          <Image
            src="/mlagent-logo-3d.png"
            alt="ML Agent"
            width={64}
            height={64}
            className="drop-shadow-2xl sm:w-20 sm:h-20"
            style={{ filter: 'drop-shadow(0 10px 30px rgba(212, 175, 55, 0.5))' }}
            priority
          />
        </div>
      </motion.div>

      {/* Crown badge */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
        className="relative mx-auto w-fit"
      >
        <div className="absolute inset-0 -m-2 bg-gold/40 rounded-2xl blur-xl animate-pulse" />
        <div className={cn(
          "relative p-4 sm:p-5 rounded-xl sm:rounded-2xl",
          "bg-gradient-to-br from-gold via-gold to-gold-dark",
          "shadow-lg shadow-gold/40",
          "border border-gold-light/30"
        )}>
          <Crown className="h-10 w-10 sm:h-12 sm:w-12 text-black" strokeWidth={2.5} />
        </div>
      </motion.div>

      {/* Level Up Title */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-1"
      >
        <h2 className="text-xl sm:text-2xl font-black text-gold uppercase tracking-widest">
          Level Up!
        </h2>
      </motion.div>

      {/* Level Numbers - Animated */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-center gap-3 sm:gap-4"
      >
        <span className="text-4xl sm:text-5xl font-black text-gray-600">
          {oldLevel}
        </span>

        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.5, type: 'spring' }}
        >
          <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-gold" />
        </motion.div>

        <motion.span
          className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent"
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
        >
          {animatedLevel}
        </motion.span>
      </motion.div>

      {/* Level Name */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <p className={cn(
          "text-lg sm:text-xl font-bold",
          `bg-gradient-to-r ${levelColor} bg-clip-text text-transparent`
        )}>
          {levelName}
        </p>
      </motion.div>

      {/* XP Stats Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className={cn(
          "w-full p-3 sm:p-4 rounded-xl",
          "bg-black/60 backdrop-blur-sm",
          "border border-gold/20"
        )}
      >
        <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">XP Total</p>
        <p className="text-xl sm:text-2xl font-bold text-gold">
          {totalXP.toLocaleString('pt-BR')}
        </p>
      </motion.div>

      {/* Progress animation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="w-full h-1.5 sm:h-2 bg-gray-800/80 rounded-full overflow-hidden"
      >
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ delay: 1, duration: 1.5, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-gold via-gold-light to-gold rounded-full"
        />
      </motion.div>

      {/* Footer message */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="text-[11px] sm:text-xs text-gray-500"
      >
        {hasCharacterEvolution
          ? 'Preparando evolução de personagem...'
          : 'Continue assim para alcançar o próximo nível!'}
      </motion.p>
    </div>
  )
}

// Character evolution view
function CharacterEvolutionView({
  oldCharacter,
  newCharacter,
  newLevel
}: {
  oldCharacter: Character
  newCharacter: Character
  newLevel: number
}) {
  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Evolution header */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <div className="flex items-center justify-center gap-2">
          <Star className="w-5 h-5 sm:w-6 sm:h-6 text-gold fill-gold" />
          <h2 className="text-lg sm:text-xl font-black text-gold uppercase tracking-wider">
            Evolução!
          </h2>
          <Star className="w-5 h-5 sm:w-6 sm:h-6 text-gold fill-gold" />
        </div>
        <p className="text-[11px] sm:text-xs text-gray-400">
          Novo personagem desbloqueado!
        </p>
      </motion.div>

      {/* Character transformation */}
      <div className="flex items-center justify-center gap-3 sm:gap-5 py-2 sm:py-4">
        {/* Old character - fading out */}
        <motion.div
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: 0.4, scale: 0.85, filter: 'grayscale(0.5)' }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-center"
        >
          <div
            className={cn(
              "w-14 h-14 sm:w-18 sm:h-18 rounded-xl sm:rounded-2xl flex items-center justify-center overflow-hidden",
              "ring-1 ring-gray-700"
            )}
            style={{
              background: `linear-gradient(135deg, ${oldCharacter.primaryColor}30, ${oldCharacter.secondaryColor}15)`
            }}
          >
            <Image
              src={getCharacterAvatar(oldCharacter.avatarSeed, 56)}
              alt={oldCharacter.name}
              width={56}
              height={56}
              className="object-contain"
              unoptimized
            />
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1.5">{oldCharacter.name}</p>
        </motion.div>

        {/* Animated arrow */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-gold" />
          </motion.div>
        </motion.div>

        {/* New character - epic entrance */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
          className="text-center relative"
        >
          {/* Epic glow */}
          <motion.div
            className="absolute inset-0 -m-3 rounded-2xl blur-xl"
            style={{ backgroundColor: newCharacter.glowColor }}
            animate={{
              opacity: [0.4, 0.7, 0.4],
              scale: [0.95, 1.1, 0.95]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          <div
            className={cn(
              "relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl flex items-center justify-center overflow-hidden",
              "ring-2 ring-gold/50"
            )}
            style={{
              background: `linear-gradient(135deg, ${newCharacter.primaryColor}50, ${newCharacter.secondaryColor}30)`,
              boxShadow: `0 0 30px ${newCharacter.glowColor}`
            }}
          >
            <Image
              src={getCharacterAvatar(newCharacter.avatarSeed, 64)}
              alt={newCharacter.name}
              width={64}
              height={64}
              className="object-contain"
              unoptimized
            />
          </div>
          <p className="text-xs sm:text-sm font-bold text-white mt-1.5">{newCharacter.name}</p>
        </motion.div>
      </div>

      {/* New character info card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="space-y-3"
      >
        {/* Unlock message */}
        <div className={cn(
          "p-3 sm:p-4 rounded-xl",
          "bg-black/60 backdrop-blur-sm",
          "border border-gold/30"
        )}>
          <p className="text-xs sm:text-sm text-gray-200 text-center leading-relaxed">
            {newCharacter.unlockMessage}
          </p>
        </div>

        {/* Stats badges */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <div className={cn(
            "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full",
            "bg-gold/20 border border-gold/30"
          )}>
            <span className="text-xs sm:text-sm font-bold text-gold">
              x{newCharacter.xpMultiplier.toFixed(2)} XP
            </span>
          </div>
          <div className={cn(
            "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full",
            "bg-gray-800/80 border border-gray-700"
          )}>
            <span className="text-xs sm:text-sm text-gray-300">
              Level {newLevel}/100
            </span>
          </div>
        </div>

        {/* Traits */}
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
          {newCharacter.traits.map((trait, i) => (
            <motion.span
              key={trait}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1 + i * 0.1 }}
              className={cn(
                "text-[10px] sm:text-xs px-2 py-0.5 rounded-full",
                "bg-gray-800/60 border border-gray-700/50",
                "text-gray-400"
              )}
            >
              {trait}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* Motivation quote */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        className="text-[10px] sm:text-xs text-gray-500 italic px-4"
      >
        "{newCharacter.motivation}"
      </motion.p>
    </div>
  )
}
