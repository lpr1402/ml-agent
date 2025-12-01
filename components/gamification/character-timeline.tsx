'use client'

/**
 * CHARACTER TIMELINE 2.0
 * Timeline horizontal mostrando os 10 personagens
 *
 * Design: Mobile-first, branding gold/black
 * Avatars: DiceBear Pixel Art
 */

import { motion } from 'framer-motion'
import { Lock, Check, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { CHARACTERS, type Character, getCharacterAvatar } from '@/lib/gamification/characters-data'
import { cn } from '@/lib/utils'

interface CharacterTimelineProps {
  currentLevel: number
  currentCharacterCode: string
  compact?: boolean
  showLabels?: boolean
  onCharacterClick?: (character: Character) => void
}

export function CharacterTimeline({
  currentLevel,
  currentCharacterCode,
  compact = false,
  showLabels = true,
  onCharacterClick
}: CharacterTimelineProps) {
  const currentCharacterIndex = CHARACTERS.findIndex(c => c.code === currentCharacterCode)
  const currentEra = Math.ceil(currentLevel / 10)

  return (
    <div className="w-full">
      {/* Timeline container - scrollable on mobile */}
      <div
        className={cn(
          "flex items-center gap-1 overflow-x-auto scrollbar-hide pb-2",
          compact ? "px-1" : "px-2 sm:px-4",
          // Snap scroll on mobile
          "snap-x snap-mandatory"
        )}
      >
        {CHARACTERS.map((character, index) => {
          const isUnlocked = currentLevel >= character.minLevel
          const isCurrent = character.code === currentCharacterCode
          const isPast = index < currentCharacterIndex
          const isNext = index === currentCharacterIndex + 1

          return (
            <div
              key={character.code}
              className={cn(
                "flex items-center flex-shrink-0",
                "snap-center"
              )}
            >
              {/* Character node */}
              <CharacterNode
                character={character}
                isUnlocked={isUnlocked}
                isCurrent={isCurrent}
                isPast={isPast}
                isNext={isNext}
                compact={compact}
                showLabel={showLabels}
                onClick={() => onCharacterClick?.(character)}
              />

              {/* Connector line */}
              {index < CHARACTERS.length - 1 && (
                <div
                  className={cn(
                    "h-[2px] flex-shrink-0 transition-all duration-300",
                    compact ? "w-1.5 sm:w-2" : "w-2 sm:w-4 md:w-6",
                    isPast
                      ? "bg-gradient-to-r from-gold to-gold-dark"
                      : isCurrent
                        ? "bg-gradient-to-r from-gold/50 to-gray-700"
                        : "bg-gray-800"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Progress indicator - mobile optimized */}
      {!compact && (
        <div className="mt-2 sm:mt-3 px-2 sm:px-4">
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="text-gold font-medium">Era {currentEra}</span>
              <span className="text-gray-600">/</span>
              <span>10</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-white font-medium">{currentLevel}</span>
              <span className="text-gray-600">/</span>
              <span>100</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Individual character node - optimized for touch
function CharacterNode({
  character,
  isUnlocked,
  isCurrent,
  isPast,
  isNext,
  compact,
  showLabel,
  onClick
}: {
  character: Character
  isUnlocked: boolean
  isCurrent: boolean
  isPast: boolean
  isNext: boolean
  compact: boolean
  showLabel: boolean
  onClick: () => void
}) {
  // Mobile-first sizing
  const containerSize = compact
    ? 'w-8 h-8 sm:w-9 sm:h-9'
    : 'w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14'
  const avatarSize = compact ? 28 : 36

  return (
    <motion.button
      onClick={onClick}
      {...(isUnlocked && {
        whileHover: { scale: 1.08 },
        whileTap: { scale: 0.95 }
      })}
      className={cn(
        "relative flex flex-col items-center gap-0.5 sm:gap-1 transition-all",
        "touch-manipulation", // Better touch response
        !isUnlocked && "cursor-default opacity-60"
      )}
    >
      {/* Glow effect for current - subtle and elegant */}
      {isCurrent && (
        <motion.div
          className={cn(
            "absolute rounded-full",
            compact
              ? "w-12 h-12 -inset-1.5"
              : "w-14 h-14 sm:w-16 sm:h-16 -inset-2"
          )}
          style={{
            background: `radial-gradient(circle, ${character.glowColor} 0%, transparent 70%)`
          }}
          animate={{
            opacity: [0.4, 0.7, 0.4],
            scale: [0.95, 1.05, 0.95]
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}

      {/* Character circle */}
      <div
        className={cn(
          containerSize,
          "relative rounded-full flex items-center justify-center transition-all duration-300 overflow-hidden",
          // Current character - gold accent
          isCurrent && [
            "ring-2 ring-gold/60",
            "shadow-lg shadow-gold/30"
          ],
          // Past character - completed
          isPast && !isCurrent && [
            "ring-1 ring-gold/30",
            "bg-gradient-to-br from-gray-800 to-gray-900"
          ],
          // Next character - upcoming
          isNext && [
            "ring-1 ring-white/20",
            "bg-gray-900"
          ],
          // Future locked characters
          !isUnlocked && !isNext && [
            "ring-1 ring-gray-800",
            "bg-gray-900/50"
          ]
        )}
        style={isCurrent ? {
          background: `linear-gradient(135deg, ${character.primaryColor}40, ${character.secondaryColor}20)`,
          boxShadow: `0 0 20px ${character.glowColor}`
        } : undefined}
      >
        {isUnlocked ? (
          <Image
            src={getCharacterAvatar(character.avatarSeed, avatarSize)}
            alt={character.name}
            width={avatarSize}
            height={avatarSize}
            className={cn(
              "object-contain transition-all",
              isPast && !isCurrent && "opacity-60 grayscale-[30%]"
            )}
            unoptimized
          />
        ) : (
          <Lock className={cn(
            "text-gray-700",
            compact ? "w-3 h-3" : "w-4 h-4"
          )} />
        )}

        {/* Completed badge */}
        {isPast && !isCurrent && (
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center",
            "bg-gold shadow-sm shadow-gold/50",
            compact ? "w-3.5 h-3.5" : "w-4 h-4"
          )}>
            <Check className={cn(
              "text-black",
              compact ? "w-2 h-2" : "w-2.5 h-2.5"
            )} strokeWidth={3} />
          </div>
        )}

        {/* Next indicator */}
        {isNext && (
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center",
            "bg-gray-700 border border-gray-600",
            compact ? "w-3.5 h-3.5" : "w-4 h-4"
          )}>
            <ChevronRight className={cn(
              "text-gray-400",
              compact ? "w-2 h-2" : "w-2.5 h-2.5"
            )} />
          </div>
        )}
      </div>

      {/* Label - hidden on compact, responsive */}
      {showLabel && !compact && (
        <div className="text-center min-w-0 max-w-[50px] sm:max-w-[60px]">
          <span className={cn(
            "block text-[9px] sm:text-[10px] font-medium truncate leading-tight",
            isCurrent ? "text-gold" :
            isPast ? "text-gray-400" :
            isNext ? "text-gray-500" :
            "text-gray-600"
          )}>
            {character.name}
          </span>
          <span className={cn(
            "block text-[8px] sm:text-[9px] leading-tight",
            isCurrent ? "text-gray-400" :
            isPast ? "text-gray-500" :
            "text-gray-700"
          )}>
            {character.minLevel}-{character.maxLevel}
          </span>
        </div>
      )}
    </motion.button>
  )
}

// Character detail card - used in modals/expanded views
export function CharacterCard({
  character,
  isUnlocked,
  isCurrent,
  currentLevel
}: {
  character: Character
  isUnlocked: boolean
  isCurrent: boolean
  currentLevel: number
}) {
  const progressInEra = isCurrent
    ? Math.round(((currentLevel - character.minLevel) / (character.maxLevel - character.minLevel + 1)) * 100)
    : isUnlocked ? 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all",
        isCurrent
          ? "bg-black/80 backdrop-blur-xl border-gold/40 shadow-lg shadow-gold/10"
          : isUnlocked
            ? "bg-gray-900/60 border-gray-800"
            : "bg-gray-900/40 border-gray-800/50 opacity-50"
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Character avatar */}
        <div
          className={cn(
            "w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0",
            isCurrent && "ring-2 ring-gold/50"
          )}
          style={isCurrent ? {
            background: `linear-gradient(135deg, ${character.primaryColor}50, ${character.secondaryColor}30)`,
            boxShadow: `0 0 20px ${character.glowColor}`
          } : isUnlocked ? {
            background: 'linear-gradient(135deg, #1f1f1f 0%, #111 100%)'
          } : {
            background: '#0a0a0a'
          }}
        >
          {isUnlocked ? (
            <Image
              src={getCharacterAvatar(character.avatarSeed, 48)}
              alt={character.name}
              width={48}
              height={48}
              className="object-contain"
              unoptimized
            />
          ) : (
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn(
              "font-bold text-sm sm:text-base",
              isCurrent ? "text-white" : isUnlocked ? "text-gray-200" : "text-gray-500"
            )}>
              {character.name}
            </h3>
            {isCurrent && (
              <span className="px-1.5 sm:px-2 py-0.5 bg-gold/20 rounded-full text-[10px] sm:text-xs text-gold font-medium border border-gold/30">
                Atual
              </span>
            )}
          </div>

          <p className={cn(
            "text-[10px] sm:text-xs mt-0.5",
            isCurrent ? "text-gold/70" : isUnlocked ? "text-gray-500" : "text-gray-600"
          )}>
            {character.title}
          </p>

          <p className={cn(
            "text-xs sm:text-sm mt-1.5 sm:mt-2 line-clamp-2",
            isCurrent ? "text-gray-300" : isUnlocked ? "text-gray-400" : "text-gray-600"
          )}>
            {character.description}
          </p>

          {/* Stats badges */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={cn(
              "text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium",
              isCurrent
                ? "bg-gold/20 text-gold border border-gold/30"
                : "bg-gray-800 text-gray-400"
            )}>
              x{character.xpMultiplier.toFixed(2)} XP
            </span>
            <span className={cn(
              "text-[10px] sm:text-xs px-2 py-0.5 rounded-full",
              isCurrent ? "bg-gray-800 text-gray-300" : "bg-gray-800/50 text-gray-500"
            )}>
              Lv.{character.minLevel}-{character.maxLevel}
            </span>
          </div>

          {/* Progress bar for current/unlocked */}
          {(isCurrent || isUnlocked) && (
            <div className="mt-2.5 sm:mt-3">
              <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1">
                <span className={isCurrent ? "text-gray-400" : "text-gray-500"}>
                  Progresso
                </span>
                <span className={isCurrent ? "text-gold font-medium" : "text-gray-400"}>
                  {progressInEra}%
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    isCurrent
                      ? "bg-gradient-to-r from-gold to-gold-light"
                      : "bg-gray-600"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressInEra}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Traits */}
      {isUnlocked && (
        <div className="flex flex-wrap gap-1 mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-gray-800/50">
          {character.traits.map((trait) => (
            <span
              key={trait}
              className={cn(
                "text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full",
                isCurrent
                  ? "bg-gold/10 text-gold/80 border border-gold/20"
                  : "bg-gray-800/50 text-gray-500"
              )}
            >
              {trait}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// Compact inline character badge
export function CharacterBadge({
  character,
  size = 'md',
  showName = true,
  showMultiplier = false
}: {
  character: Character
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
  showMultiplier?: boolean
}) {
  const sizeConfig = {
    sm: { container: 'w-6 h-6', avatar: 20, text: 'text-xs' },
    md: { container: 'w-8 h-8', avatar: 28, text: 'text-sm' },
    lg: { container: 'w-10 h-10', avatar: 36, text: 'text-base' }
  }

  const config = sizeConfig[size]

  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={cn(
          config.container,
          "rounded-full flex items-center justify-center overflow-hidden",
          "ring-1 ring-gold/30"
        )}
        style={{
          background: `linear-gradient(135deg, ${character.primaryColor}40, ${character.secondaryColor}20)`,
          boxShadow: `0 0 10px ${character.glowColor}`
        }}
      >
        <Image
          src={getCharacterAvatar(character.avatarSeed, config.avatar)}
          alt={character.name}
          width={config.avatar}
          height={config.avatar}
          className="object-contain"
          unoptimized
        />
      </div>
      {(showName || showMultiplier) && (
        <div className="flex flex-col">
          {showName && (
            <span className={cn(config.text, "font-medium text-gray-200")}>
              {character.name}
            </span>
          )}
          {showMultiplier && (
            <span className="text-[10px] text-gold">
              x{character.xpMultiplier.toFixed(2)} XP
            </span>
          )}
        </div>
      )}
    </div>
  )
}
