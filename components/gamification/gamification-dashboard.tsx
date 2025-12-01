'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import {
  Trophy,
  Zap,
  Target,
  Award,
  TrendingUp,
  Clock,
  CheckCircle2,
  Star,
  Flame,
  Crown,
  MessageSquare,
  User
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getValidAvatarUrl } from '@/lib/utils/avatar-utils'

// 🎯 TypeScript Interfaces
interface Level {
  level: number
  xpRequired: number
  name: string
  color: string
}

interface LevelProgress extends Level {
  xpInCurrentLevel: number
  xpToNextLevel: number
  nextLevel: Level | null
}

interface AccountRanking {
  id: string
  name: string
  nickname: string
  totalXP: number
  questionsAnswered: number
  avgResponseTimeMinutes: number
  thumbnail: string | null
}

interface Achievement {
  id: string
  type: string
  tier: number
  tierName: string
  title: string
  description: string
  iconType: string
  progress: number
  total: number
  xpReward: number
  unlocked: boolean
  unlockedAt: string | null
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
  color: string
  currentTier: number
  nextTier: {
    tierName: string
    target: number
    xpReward: number
  } | null
}

interface RecentXPActivity {
  id: string
  accountNickname: string
  actionType: string
  actionDescription: string
  xpEarned: number
  createdAt: string
}

interface OrganizationStats {
  totalXP: number
  totalLevel: LevelProgress
  totalQuestions: number
  accountsCount: number
}

interface RankingData {
  organizationStats: OrganizationStats
  accountsRanking: AccountRanking[]
  achievements: Achievement[]
  recentXP: RecentXPActivity[]
}

// Mapa de ícones
const ACTION_ICONS: Record<string, typeof Zap> = {
  fast_response: Zap,
  ultra_fast: Zap,
  quick_response: Zap,
  first_approval: CheckCircle2,
  streak: Flame,
  quality: Star,
  complete: Award,
  conversion: TrendingUp,
  early_bird: Clock,
  target: Target,
  achievement_unlocked: Trophy
}

const ACHIEVEMENT_ICONS: Record<string, typeof Zap> = {
  // 🎯 Achievement types do sistema de gamificação
  lightning: Zap,      // < 2 min (5x XP!) - Lightning
  speed: Zap,          // < 5 min (3x XP!) - Ultra Rápido
  streak: Flame,       // Dias consecutivos
  volume: Target,      // Total de perguntas
  quality: Star,       // Primeira aprovação
  dedication: Flame,   // Horários especiais (madrugada/manhã)
  // Legacy/fallbacks
  conversion: TrendingUp,
  early_bird: Clock,
  milestone: Target
}

// Helper para formatar tempo
const formatTimeAgo = (date: string): string => {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'agora'
  if (diffMins < 60) return `${diffMins} min`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

const formatTime = (seconds: number) => {
  if (!seconds || seconds === 0) return "0s"
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`
  return `${(seconds / 3600).toFixed(1)}h`
}

export function GamificationDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RankingData | null>(null)

  useEffect(() => {
    const fetchRankingData = async () => {
      try {
        setLoading(true)
        const response = await apiClient.get('/api/ranking/data')

        if (response) {
          setData(response)
        }
      } catch (error) {
        logger.error('[Ranking] Failed to fetch ranking data', { error })
      } finally {
        setLoading(false)
      }
    }

    fetchRankingData()

    // Listen for refresh events
    const handleRefresh = () => {
      logger.info('[Ranking] Refresh triggered by XP event')
      fetchRankingData()
    }

    window.addEventListener('gamification:refresh', handleRefresh)

    // Refresh a cada 5 minutos
    const interval = setInterval(fetchRankingData, 300000)

    return () => {
      clearInterval(interval)
      window.removeEventListener('gamification:refresh', handleRefresh)
    }
  }, [])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Trophy className="h-8 w-8 text-gold animate-pulse" />
      </div>
    )
  }

  const { organizationStats, accountsRanking, achievements, recentXP } = data

  // Separar conquistas
  const completedAchievements = achievements.filter(a => a.unlocked)
  const inProgressAchievements = achievements.filter(a => !a.unlocked).slice(0, 6)

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      {/* Card Premium de Nível - Ultra Premium Mobile-First */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-black via-gray-950 to-black backdrop-blur-xl border border-gold/20 shadow-2xl overflow-hidden"
      >
        {/* Animated Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-gold/10 opacity-60 animate-pulse pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,215,0,0.1),transparent_50%)] pointer-events-none" />

        <div className="relative p-4 sm:p-5 lg:p-8">
          {/* Level Badge + Title - Mobile Optimized */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-gold/60 to-yellow-500/60 rounded-2xl sm:rounded-3xl blur-xl sm:blur-2xl animate-pulse" />
              <div className="relative bg-gradient-to-br from-gold to-gold-light rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5 border-2 border-gold/40 shadow-2xl shadow-gold/40">
                <Crown className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-black" strokeWidth={2.5} />
              </div>
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-baseline gap-1.5 sm:gap-2 mb-1 justify-center sm:justify-start">
                <span className="text-3xl sm:text-4xl lg:text-6xl font-black bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent tracking-tight">
                  {organizationStats.totalLevel.level}
                </span>
                <span className="text-xs sm:text-sm lg:text-base text-gray-400 font-bold uppercase tracking-wider">Nível</span>
              </div>
              <span className="text-sm sm:text-base lg:text-lg font-bold bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
                {organizationStats.totalLevel.name}
              </span>
            </div>
          </div>

          {/* XP Progress Bar - Premium Mobile-First */}
          <div className="space-y-2 sm:space-y-2.5">
            <div className="flex items-center justify-between text-xs sm:text-sm flex-wrap gap-1">
              <span className="font-bold text-white">
                {organizationStats.totalXP.toLocaleString()} XP Total
              </span>
              {organizationStats.totalLevel.nextLevel && (
                <span className="font-mono text-gold text-xs sm:text-sm">
                  {organizationStats.totalLevel.xpToNextLevel.toLocaleString()} XP para Level {organizationStats.totalLevel.level + 1}
                </span>
              )}
            </div>

            {/* Progress Bar - Dourada Premium */}
            <div className="relative h-3 sm:h-4 bg-black/60 rounded-full overflow-hidden border border-white/10 shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: organizationStats.totalLevel.nextLevel
                    ? `${(organizationStats.totalLevel.xpInCurrentLevel / (organizationStats.totalLevel.xpInCurrentLevel + organizationStats.totalLevel.xpToNextLevel)) * 100}%`
                    : '100%'
                }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold via-gold-light to-gold rounded-full shadow-lg"
                style={{
                  boxShadow: '0 0 20px rgba(212, 175, 55, 0.5)'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 🏆 RANKING DE CONTAS - Grid 3 Colunas Mobile */}
      {accountsRanking.length > 0 && (
        <div className="space-y-5 sm:space-y-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-lg shadow-gold/20">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="text-sm sm:text-base lg:text-lg font-bold text-gold tracking-tight">
                Ranking de Contas
              </h4>
              <p className="text-xs text-gray-400 lg:text-sm mt-0.5">
                {accountsRanking.length} {accountsRanking.length === 1 ? 'conta ativa' : 'contas ativas'}
              </p>
            </div>
          </div>

          {/* Layout Dinâmico: 1-2 contas = maior | 3+ contas = top 3 + lista */}
          {accountsRanking.length <= 2 ? (
            /* 1-2 Contas: Grid maior e mais espaçado */
            <div className={`grid ${accountsRanking.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 sm:grid-cols-2'} gap-3 sm:gap-4 lg:gap-5`}>
              {accountsRanking.map((account, index) => {
                const accountImage = getValidAvatarUrl(account.thumbnail)
                const position = index + 1
                const medalColor = position === 1 ? 'from-gold to-gold-light' :
                                  position === 2 ? 'from-slate-200 to-slate-300' : ''
                const medalShadow = position === 1 ? 'shadow-lg shadow-gold/40' :
                                   position === 2 ? 'shadow-lg shadow-slate-300/40' : ''

                return (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/5 p-4 sm:p-5 lg:p-6 overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="relative z-10">
                      {/* Posição - Maior */}
                      {medalColor && (
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${medalColor} ${medalShadow} flex items-center justify-center text-xs sm:text-sm font-black text-black border border-white/20`}>
                            {position}º
                          </div>
                        </div>
                      )}

                      {/* Avatar + Info - Maior */}
                      <div className="flex items-center gap-3 sm:gap-4 mb-4">
                        <Avatar className="h-12 w-12 sm:h-14 sm:w-14 ring-2 ring-gold/20">
                          {accountImage ? (
                            <AvatarImage
                              src={accountImage}
                              alt={account.nickname}
                              className="object-cover"
                            />
                          ) : (
                            <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-900">
                              <User className="h-6 w-6 sm:h-7 sm:w-7 text-gold" />
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-base sm:text-lg lg:text-xl font-bold text-white truncate">
                            {account.nickname}
                          </p>
                          <p className="text-sm text-gray-500">
                            {account.totalXP.toLocaleString()} XP
                          </p>
                        </div>
                      </div>

                      {/* Métricas - Maiores */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div className="bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20 rounded-lg sm:rounded-xl p-3 sm:p-4">
                          <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-gold flex-shrink-0" />
                            <span className="text-xs sm:text-sm text-gold/70 font-medium">Perguntas</span>
                          </div>
                          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gold leading-none">
                            {account.questionsAnswered}
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4">
                          <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300 flex-shrink-0" />
                            <span className="text-xs sm:text-sm text-gray-400 font-medium">Tempo</span>
                          </div>
                          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-none">
                            {formatTime(account.avgResponseTimeMinutes * 60)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            /* 3+ Contas: Top 3 em grid + resto em lista compacta */
            <div className="space-y-4">
              {/* Top 3 - Grid 3 Colunas */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                {accountsRanking.slice(0, 3).map((account, index) => {
                  const accountImage = getValidAvatarUrl(account.thumbnail)
                  const position = index + 1
                  const medalColor = position === 1 ? 'from-gold to-gold-light' :
                                    position === 2 ? 'from-slate-200 to-slate-300' :
                                    position === 3 ? 'from-amber-500 to-amber-600' : ''
                  const medalShadow = position === 1 ? 'shadow-lg shadow-gold/40' :
                                     position === 2 ? 'shadow-lg shadow-slate-300/40' :
                                     position === 3 ? 'shadow-lg shadow-amber-500/40' : ''

                  return (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.02 }}
                      className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/5 p-2 sm:p-3 lg:p-4 overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      <div className="relative z-10">
                        {/* Posição */}
                        <div className="absolute top-0 right-0 sm:top-1 sm:right-1">
                          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br ${medalColor} ${medalShadow} flex items-center justify-center text-[9px] sm:text-[10px] font-black text-black border border-white/20`}>
                            {position}º
                          </div>
                        </div>

                        {/* Avatar + Info */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 mb-2 sm:mb-3">
                          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 ring-2 ring-gold/20 mx-auto sm:mx-0">
                            {accountImage ? (
                              <AvatarImage
                                src={accountImage}
                                alt={account.nickname}
                                className="object-cover"
                              />
                            ) : (
                              <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-900">
                                <User className="h-3 w-3 sm:h-5 sm:w-5 text-gold" />
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex-1 min-w-0 text-center sm:text-left">
                            <p className="text-[10px] sm:text-sm lg:text-base font-bold text-white truncate">
                              {account.nickname}
                            </p>
                            <p className="text-[8px] sm:text-[10px] lg:text-xs text-gray-500">
                              #{position} • {account.totalXP} XP
                            </p>
                          </div>
                        </div>

                        {/* Métricas */}
                        <div className="grid grid-cols-2 gap-1 sm:gap-2">
                          <div className="bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20 rounded-md sm:rounded-lg p-1.5 sm:p-2">
                            <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                              <MessageSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gold flex-shrink-0" />
                              <span className="text-[7px] sm:text-[9px] lg:text-[10px] text-gold/70 font-medium truncate">Perg</span>
                            </div>
                            <p className="text-xs sm:text-base lg:text-lg font-bold text-gold leading-none">
                              {account.questionsAnswered}
                            </p>
                          </div>

                          <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-md sm:rounded-lg p-1.5 sm:p-2">
                            <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-300 flex-shrink-0" />
                              <span className="text-[7px] sm:text-[9px] lg:text-[10px] text-gray-400 font-medium truncate">Tempo</span>
                            </div>
                            <p className="text-xs sm:text-base lg:text-lg font-bold text-white leading-none">
                              {formatTime(account.avgResponseTimeMinutes * 60)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* 4º+ em Lista Compacta */}
              {accountsRanking.length > 3 && (
                <div className="space-y-2">
                  {accountsRanking.slice(3).map((account, index) => {
                    const accountImage = getValidAvatarUrl(account.thumbnail)
                    const position = index + 4

                    return (
                      <motion.div
                        key={account.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ scale: 1.01 }}
                        className="relative rounded-lg bg-gradient-to-br from-white/[0.02] to-white/[0.01] border border-white/5 p-2.5 sm:p-3 overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-gold/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        <div className="relative z-10 flex items-center gap-2 sm:gap-3">
                          {/* Posição - Compacta */}
                          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 flex items-center justify-center">
                            <span className="text-xs sm:text-sm font-bold text-gray-400">
                              {position}º
                            </span>
                          </div>

                          {/* Avatar - Compacto */}
                          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 ring-1 ring-white/10">
                            {accountImage ? (
                              <AvatarImage
                                src={accountImage}
                                alt={account.nickname}
                                className="object-cover"
                              />
                            ) : (
                              <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-900">
                                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gold" />
                              </AvatarFallback>
                            )}
                          </Avatar>

                          {/* Info - Compacta */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-white truncate">
                              {account.nickname}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {account.totalXP.toLocaleString()} XP
                            </p>
                          </div>

                          {/* Métricas Inline - Compactas */}
                          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-gold flex-shrink-0" />
                              <span className="text-xs sm:text-sm font-bold text-gold">
                                {account.questionsAnswered}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="text-xs sm:text-sm font-bold text-white">
                                {formatTime(account.avgResponseTimeMinutes * 60)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 🎯 CONQUISTAS - Grid Simples */}
      {inProgressAchievements.length > 0 && (
        <div className="space-y-5 sm:space-y-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-lg shadow-gold/20">
              <Award className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="text-sm sm:text-base lg:text-lg font-bold text-gold tracking-tight">
                Conquistas em Progresso
              </h4>
              <p className="text-xs text-gray-400 lg:text-sm mt-0.5">
                {completedAchievements.length} completadas • {inProgressAchievements.length} em andamento
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            {inProgressAchievements.map((achievement) => {
              const Icon = ACHIEVEMENT_ICONS[achievement.iconType] || Award
              const progress = (achievement.progress / achievement.total) * 100

              return (
                <div
                  key={achievement.id}
                  className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/5 p-2.5 sm:p-3 lg:p-4 overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-2">
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
                      <span className="text-[10px] text-gray-500 font-mono">
                        {achievement.progress}/{achievement.total}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white mb-1 truncate">
                      {achievement.title}
                    </p>
                    <p className="text-[10px] text-gray-500 mb-2 line-clamp-2">
                      {achievement.description}
                    </p>

                    {/* Progress Bar */}
                    <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gold to-gold-light"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 📝 ATIVIDADES RECENTES */}
      {recentXP.length > 0 && (
        <div className="rounded-lg sm:rounded-xl bg-black/40 border border-white/5 p-3 sm:p-4 lg:p-5">
          <h4 className="text-xs sm:text-sm font-bold text-gold mb-3 sm:mb-4">
            Atividades Recentes
          </h4>

          <div className="space-y-2">
            {recentXP.slice(0, 5).map((activity) => {
              const Icon = ACTION_ICONS[activity.actionType] || Zap

              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs text-white font-medium truncate">
                      {activity.actionDescription}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500">
                      {activity.accountNickname}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-gold">
                      +{activity.xpEarned}
                    </span>
                    <span className="text-[9px] text-gray-600">
                      {formatTimeAgo(activity.createdAt)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
