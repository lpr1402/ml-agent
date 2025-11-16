'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  ChevronRight,
  Gift,
  Sparkles,
  MessageSquare,
  ChevronDown,
  Info,
  User
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getValidAvatarUrl } from '@/lib/utils/avatar-utils'
import { Skeleton } from '@/components/ui/skeleton'
import { AchievementTipsModal } from './achievement-tips-modal'
import { LevelsInfoModal } from './levels-info-modal'
import { AchievementsInfoModal } from './achievements-info-modal'
import { XPSystemInfoModal } from './xp-system-info-modal'

// 🎯 TypeScript Interfaces para API Backend
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
  tips: string[]
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

// Mapa de ícones por tipo de ação
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

// Mapa de ícones por tipo de achievement
const ACHIEVEMENT_ICONS: Record<string, typeof Zap> = {
  speed: Zap,
  dedication: Flame,
  conversion: TrendingUp,
  early_bird: Clock,
  milestone: Target,
  quality: Star,
  streak: Flame
}

// Helper para formatar tempo relativo
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

export function GamificationDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RankingData | null>(null)
  const [showAllAchievements, setShowAllAchievements] = useState(false)
  const [showMyAchievements, setShowMyAchievements] = useState(false) // Minhas conquistas (100%)
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null)
  const [showLevelsInfo, setShowLevelsInfo] = useState(false)
  const [showAchievementsInfo, setShowAchievementsInfo] = useState(false)
  const [showXPSystemInfo, setShowXPSystemInfo] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

    // 🎮 Listen for refresh events (quando XP é ganho)
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
      <div className="space-y-4">
        <Skeleton className="h-48 bg-gray-800/50 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-96 bg-gray-800/50 rounded-2xl" />
          <Skeleton className="h-96 bg-gray-800/50 rounded-2xl" />
        </div>
        <Skeleton className="h-32 bg-gray-800/50 rounded-xl" />
      </div>
    )
  }

  const { organizationStats, accountsRanking, achievements, recentXP } = data

  // Separar conquistas completadas e em progresso
  const completedAchievements = achievements.filter(a => a.unlocked)
  const inProgressAchievements = achievements.filter(a => !a.unlocked)

  // Exibir: Se "Minhas Conquistas" ativado, mostrar completadas. Senão, mostrar em progresso
  const displayAchievements = showMyAchievements
    ? completedAchievements
    : showAllAchievements
    ? inProgressAchievements
    : inProgressAchievements.slice(0, 10)

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      {/* Header com Level da Organização - Ultra Premium */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl bg-gradient-to-br from-black via-gray-950 to-black backdrop-blur-xl border border-gold/20 shadow-2xl overflow-hidden"
      >
        {/* Animated Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-gold/10 opacity-60 animate-pulse pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,215,0,0.1),transparent_50%)] pointer-events-none" />

        {/* Botão Info - Canto Superior Direito */}
        <button
          onClick={() => setShowLevelsInfo(true)}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-black/40 hover:bg-gold/20 border border-white/10 hover:border-gold/30 transition-all duration-300 group"
          title="Como funciona o sistema de níveis"
        >
          <Info className="h-4 w-4 text-gray-400 group-hover:text-gold transition-colors" />
        </button>

        <div className="relative p-5 sm:p-6 lg:p-8">
          {/* Level Badge + Title - SEM MÉTRICAS */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-gold/60 to-yellow-500/60 rounded-3xl blur-2xl animate-pulse" />
              <div className="relative bg-gradient-to-br from-gold to-gold-light rounded-2xl p-4 sm:p-5 border-2 border-gold/40 shadow-2xl shadow-gold/40">
                <Crown className="h-8 w-8 sm:h-10 sm:w-10 text-black" strokeWidth={2.5} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent tracking-tight">
                  {organizationStats.totalLevel.level}
                </span>
                <span className="text-sm sm:text-base text-gray-400 font-bold uppercase tracking-wider">Nível</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
                  {organizationStats.totalLevel.name}
                </span>
                {organizationStats.totalLevel.nextLevel && (
                  <>
                    <ChevronRight className="h-4 w-4 text-gray-600" style={{ verticalAlign: 'middle', marginTop: '2px' }} />
                    <span className="text-xs sm:text-sm text-gray-500 font-medium">
                      Próximo: {organizationStats.totalLevel.nextLevel.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* XP Progress Bar - Premium */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-white">
                {organizationStats.totalXP.toLocaleString()} XP Total
              </span>
              {organizationStats.totalLevel.nextLevel && (
                <span className="font-mono text-gold">
                  {organizationStats.totalLevel.xpToNextLevel.toLocaleString()} XP para Level {organizationStats.totalLevel.level + 1}
                </span>
              )}
            </div>

            {/* Progress Bar - Dourada Premium */}
            <div className="relative h-4 bg-black/60 rounded-full overflow-hidden border border-white/10 shadow-inner">
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

      {/* Ranking de Contas - ACIMA de tudo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5 shadow-xl overflow-hidden"
      >
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

        {/* Header PADRONIZADO */}
        <div className="relative z-10 border-b border-white/5 p-4 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-gold">Ranking de Contas</h3>
              <p className="text-xs text-gray-500">Top performers do Mercado Livre</p>
            </div>
          </div>
        </div>

        {/* Ranking Cards */}
        <div className="relative z-10 p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {accountsRanking.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <Trophy className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Nenhuma conta no ranking</p>
              </div>
            ) : (
              accountsRanking.map((account, index) => {
                const podiumStyles = [
                  {
                    position: '1º',
                    positionBg: 'from-gold via-gold-light to-gold',
                    positionText: 'text-black',
                    positionShadow: 'shadow-gold/40',
                    nameBg: 'from-gold/8',
                    nameBorder: 'border-gold/30',
                    nameText: 'text-gold'
                  },
                  {
                    position: '2º',
                    positionBg: 'from-slate-300 via-gray-200 to-slate-400',
                    positionText: 'text-black',
                    positionShadow: 'shadow-slate-300/30',
                    nameBg: 'from-slate-200/5',
                    nameBorder: 'border-slate-300/20',
                    nameText: 'text-slate-200'
                  },
                  {
                    position: '3º',
                    positionBg: 'from-amber-600 via-orange-500 to-amber-700',
                    positionText: 'text-white',
                    positionShadow: 'shadow-amber-500/30',
                    nameBg: 'from-amber-500/5',
                    nameBorder: 'border-amber-500/20',
                    nameText: 'text-amber-300'
                  }
                ][index] || {
                  position: `${index + 1}º`,
                  positionBg: 'from-gray-600 to-gray-700',
                  positionText: 'text-white',
                  positionShadow: 'shadow-gray-500/10',
                  nameBg: 'from-gray-600/2',
                  nameBorder: 'border-gray-500/10',
                  nameText: 'text-gray-300'
                }

                const accountAvatar = getValidAvatarUrl(account.thumbnail)

                return (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + index * 0.1 }}
                    className={`relative rounded-xl p-4 border transition-all duration-300 hover:scale-[1.01] bg-gradient-to-br ${podiumStyles.nameBg} via-transparent to-transparent ${podiumStyles.nameBorder}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${podiumStyles.positionBg} ${podiumStyles.positionShadow} shadow-xl border-2 border-white/20 flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-lg sm:text-xl font-black ${podiumStyles.positionText}`}>
                          {podiumStyles.position}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <Avatar className="h-10 w-10 sm:h-11 sm:w-11 ring-2 ring-white/10 flex-shrink-0">
                          {accountAvatar ? (
                            <AvatarImage
                              src={accountAvatar}
                              alt={account.nickname}
                              className="object-cover"
                            />
                          ) : (
                            <AvatarFallback className="bg-gradient-to-br from-gray-700 to-gray-800">
                              <User className="h-5 w-5 text-gray-400" />
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <h4 className={`text-sm sm:text-base font-black truncate ${podiumStyles.nameText}`}>
                          {account.nickname}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3 text-gray-500" />
                        <span className="text-gray-400 font-medium">{account.questionsAnswered}</span>
                        <span className="text-gray-600">resp.</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-gray-500" />
                        <span className="text-gray-300 font-medium">{account.avgResponseTimeMinutes}</span>
                        <span className="text-gray-600">min</span>
                      </div>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </div>
      </motion.div>

      {/* Grid - Conquistas e XP Recente lado a lado (50/50) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
        {/* Conquistas - 50% Desktop - HEADER PADRONIZADO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5 shadow-xl overflow-hidden"
        >
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

          {/* Header PADRONIZADO com Info Button */}
          <div className="relative z-10 border-b border-white/5 p-4 sm:p-5">
            <button
              onClick={() => setShowAchievementsInfo(true)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-black/40 hover:bg-gold/20 border border-white/10 hover:border-gold/30 transition-all duration-300 group"
              title="Como funcionam as conquistas"
            >
              <Info className="h-4 w-4 text-gray-400 group-hover:text-gold transition-colors" />
            </button>

            <div className="flex items-center justify-between gap-2 sm:gap-3 pr-12">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
                <Award className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-gold">
                  {showMyAchievements ? 'Minhas Conquistas' : 'Conquistas'}
                </h3>
                <p className="text-xs text-gray-500">
                  {showMyAchievements
                    ? `${completedAchievements.length} Conquistadas`
                    : `${inProgressAchievements.length} Em Progresso`
                  }
                </p>
              </div>

              {/* Botão Minhas Conquistas */}
              <button
                onClick={() => setShowMyAchievements(!showMyAchievements)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                  showMyAchievements
                    ? 'bg-gradient-to-r from-gold to-gold-light text-black'
                    : 'bg-black/40 text-gray-400 hover:bg-black/60 hover:text-gold border border-white/10'
                }`}
              >
                {showMyAchievements ? 'Ver Disponíveis' : 'Minhas Conquistas'}
              </button>
            </div>
          </div>

          {/* Conquistas List */}
          <div className="relative z-10 p-4 sm:p-5">
            {achievements.length === 0 ? (
              <div className="text-center py-8">
                <Award className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Nenhuma conquista disponível</p>
              </div>
            ) : (
              <>
                <div className="space-y-2.5 max-h-[60vh] sm:max-h-[500px] overflow-y-auto custom-scrollbar">
                  {displayAchievements.map((achievement, index) => {
                    const AchievementIcon = ACHIEVEMENT_ICONS[achievement.iconType] || Award
                    const progressPercent = (achievement.progress / achievement.total) * 100

                    // Cores HIGH-END baseadas no progresso
                    const getProgressColor = () => {
                      if (achievement.unlocked) return achievement.color
                      if (progressPercent >= 75) return 'from-yellow-600 to-orange-600'
                      if (progressPercent >= 50) return 'from-blue-600 to-cyan-600'
                      if (progressPercent >= 25) return 'from-purple-600 to-pink-600'
                      return 'from-gray-700 to-gray-800'
                    }

                    const progressColor = getProgressColor()
                    const progressBarColor = achievement.unlocked
                      ? achievement.color
                      : progressPercent >= 50
                      ? 'from-gold to-yellow-500'
                      : 'from-gray-600 to-gray-500'

                    return (
                      <motion.div
                        key={achievement.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                        onClick={() => setSelectedAchievement(achievement)}
                        className={`relative rounded-xl p-3.5 border transition-all duration-300 cursor-pointer group ${
                          achievement.unlocked
                            ? 'bg-gradient-to-br from-white/[0.1] to-white/[0.04] border-gold/40 hover:border-gold/60 hover:scale-[1.02] shadow-lg shadow-gold/10'
                            : progressPercent >= 50
                            ? 'bg-gradient-to-br from-white/[0.06] to-white/[0.02] border-gold/20 hover:border-gold/40 hover:scale-[1.01]'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10 hover:scale-[1.01]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon Colorido */}
                          <div className={`relative p-2.5 rounded-xl flex-shrink-0 shadow-lg bg-gradient-to-br ${progressColor}`}>
                            <AchievementIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
                            {achievement.unlocked && (
                              <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 rounded-full p-1 shadow-lg shadow-emerald-500/50">
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-white">
                                  {achievement.title}
                                </h4>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                                  achievement.unlocked ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                  progressPercent >= 75 ? 'bg-gold/20 text-gold border border-gold/30' :
                                  'bg-gray-700/30 text-gray-500 border border-gray-600/30'
                                }`}>
                                  {achievement.tierName}
                                </span>
                              </div>
                              <span className="text-xs font-black text-gold whitespace-nowrap">
                                +{achievement.xpReward}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mb-2.5">{achievement.description}</p>

                            {/* Progress Bar */}
                            {!achievement.unlocked && (
                              <div className="space-y-1.5">
                                <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercent}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className={`h-full bg-gradient-to-r ${progressBarColor} rounded-full shadow-lg`}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] text-gray-500 font-mono">
                                    {achievement.progress}/{achievement.total}
                                  </p>
                                  <p className="text-[10px] font-bold text-gold">
                                    {Math.round(progressPercent)}%
                                  </p>
                                </div>
                              </div>
                            )}

                            {achievement.unlocked && (
                              <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                                <Gift className="h-3.5 w-3.5" />
                                <span>Desbloqueado</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Botão Ver Todas (se houver mais de 10 EM PROGRESSO) */}
                {!showMyAchievements && inProgressAchievements.length > 10 && (
                  <button
                    onClick={() => setShowAllAchievements(!showAllAchievements)}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-gold/20 transition-all duration-300"
                  >
                    <span className="text-xs font-semibold text-gray-400">{showAllAchievements ? 'Ver Menos' : `Ver Todas (${inProgressAchievements.length})`}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-300 ${showAllAchievements ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* XP Recentes - 50% Desktop - HEADER PADRONIZADO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5 shadow-xl overflow-hidden"
        >
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

          {/* Header PADRONIZADO com Info Button */}
          <div className="relative z-10 border-b border-white/5 p-4 sm:p-5">
            <button
              onClick={() => setShowXPSystemInfo(true)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-black/40 hover:bg-gold/20 border border-white/10 hover:border-gold/30 transition-all duration-300 group"
              title="Como funciona o sistema de XP"
            >
              <Info className="h-4 w-4 text-gray-400 group-hover:text-gold transition-colors" />
            </button>

            <div className="flex items-center gap-2 sm:gap-3 pr-12">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-gold">XP Recente</h3>
                <p className="text-xs text-gray-500">Últimas atividades</p>
              </div>
            </div>
          </div>

          {/* XP List - Scroll otimizado */}
          <div className="relative z-10 p-4 sm:p-5">
            <div className="space-y-2 max-h-[50vh] sm:max-h-[500px] overflow-y-auto custom-scrollbar">
            {recentXP.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Nenhuma atividade recente</p>
              </div>
            ) : (
              recentXP.map((activity, index) => {
                const ActivityIcon = ACTION_ICONS[activity.actionType] || Award

                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.05 }}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-gold/20 transition-all duration-300"
                  >
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-gold/20 to-yellow-500/20 border border-gold/30 flex-shrink-0">
                      <ActivityIcon className="h-3.5 w-3.5 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{activity.actionDescription}</p>
                      <p className="text-[10px] text-gray-500">{activity.accountNickname}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-gold">+{activity.xpEarned}</p>
                      <p className="text-[10px] text-gray-600">{formatTimeAgo(activity.createdAt)}</p>
                    </div>
                  </motion.div>
                )
              })
            )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modals - Renderizar via Portal para FULL-SCREEN REAL */}
      {mounted && selectedAchievement && createPortal(
        <AchievementTipsModal
          isOpen={!!selectedAchievement}
          onClose={() => setSelectedAchievement(null)}
          achievement={selectedAchievement}
        />,
        document.body
      )}

      {mounted && createPortal(
        <LevelsInfoModal
          isOpen={showLevelsInfo}
          onClose={() => setShowLevelsInfo(false)}
          currentLevel={organizationStats.totalLevel.level}
        />,
        document.body
      )}

      {mounted && createPortal(
        <AchievementsInfoModal
          isOpen={showAchievementsInfo}
          onClose={() => setShowAchievementsInfo(false)}
        />,
        document.body
      )}

      {mounted && createPortal(
        <XPSystemInfoModal
          isOpen={showXPSystemInfo}
          onClose={() => setShowXPSystemInfo(false)}
        />,
        document.body
      )}
    </div>
  )
}
