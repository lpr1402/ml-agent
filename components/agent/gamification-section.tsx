"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Trophy,
  Zap,
  Target,
  Flame,
  Award,
  Star,
  TrendingUp,
  Crown,
  Sparkles,
  Shield,
  Diamond,
  Info,
  Clock,
  Heart,
  CheckCircle,
  Timer,
  ArrowUp,
  X
} from "lucide-react"

interface Achievement {
  id: string
  name: string
  description: string
  icon: any
  progress: number
  total: number
  unlocked: boolean
  tier: "bronze" | "silver" | "gold"
  category: string
  xpReward: number
  nextTier?: {
    name: string
    requirement: number
    reward: number
  }
}

interface LevelInfo {
  level: number
  title: string
  minXP: number
  maxXP: number
  color: string
  badge: string
}

interface GamificationProps {
  metrics: {
    totalQuestions: number
    autoApprovedCount: number
    answeredQuestions: number
    avgResponseTime: number
    revisedCount: number
    pendingQuestions: number
    manualApprovedCount: number
    conversionRate: number
  }
  weeklyStats?: {
    questionsThisWeek: number
    fastResponsesThisWeek: number
    perfectApprovalsThisWeek: number
    nightResponsesCount: number
    consecutiveDays: number
  }
  allQuestions?: any[]
}

// XP System Constants
const LEVELS: LevelInfo[] = [
  { level: 1, title: "Iniciante", minXP: 0, maxXP: 1000, color: "#9CA3AF", badge: "🥉" },
  { level: 2, title: "Snowbunny", minXP: 1000, maxXP: 5000, color: "#10B981", badge: "🏂" },
  { level: 3, title: "Desenrolado", minXP: 5000, maxXP: 15000, color: "#3B82F6", badge: "⚡" },
  { level: 4, title: "El Puton", minXP: 15000, maxXP: 50000, color: "#EC4899", badge: "🔥" },
  { level: 5, title: "Gigachad", minXP: 50000, maxXP: 999999, color: "#FFD700", badge: "👑" }
]

// XP Actions with proper values
const XP_ACTIONS = {
  ANSWER_QUESTION: 10,
  FAST_RESPONSE: 20, // < 30 min
  ULTRA_FAST: 30, // < 5 min
  AUTO_APPROVED: 15,
  HIGH_QUALITY: 25,
  PERFECT_DAY: 100,
  WEEKLY_STREAK: 200,
  ACHIEVEMENT_UNLOCK: 50
}

export function GamificationSection({ metrics, weeklyStats, allQuestions = [] }: GamificationProps) {
  const [currentXP, setCurrentXP] = useState(0)
  const [savedXP, setSavedXP] = useState(0)
  const [currentStreak, setCurrentStreak] = useState(weeklyStats?.consecutiveDays || 0)
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([])

  // Calculate XP from user actions
  const calculateTotalXP = useCallback(() => {
    let xp = 0
    
    // Base XP for answered questions
    xp += metrics.answeredQuestions * XP_ACTIONS.ANSWER_QUESTION
    
    // Fast responses bonus
    const fastResponses = allQuestions.filter(q => {
      if (!q.sentToMLAt || !q.receivedAt) return false
      const responseTime = (new Date(q.sentToMLAt).getTime() - new Date(q.receivedAt).getTime()) / 1000 / 60
      return responseTime < 30
    }).length
    xp += fastResponses * XP_ACTIONS.FAST_RESPONSE
    
    // Ultra fast responses
    const ultraFastResponses = allQuestions.filter(q => {
      if (!q.sentToMLAt || !q.receivedAt) return false
      const responseTime = (new Date(q.sentToMLAt).getTime() - new Date(q.receivedAt).getTime()) / 1000 / 60
      return responseTime < 5
    }).length
    xp += ultraFastResponses * XP_ACTIONS.ULTRA_FAST
    
    // Auto approved bonus
    xp += metrics.autoApprovedCount * XP_ACTIONS.AUTO_APPROVED
    
    // High quality bonus (>90% auto approval)
    if (metrics.totalQuestions > 50 && (metrics.autoApprovedCount / metrics.totalQuestions) > 0.9) {
      xp += Math.floor(metrics.totalQuestions / 10) * XP_ACTIONS.HIGH_QUALITY
    }
    
    // Streak bonuses
    if (currentStreak >= 7) xp += XP_ACTIONS.WEEKLY_STREAK
    if (currentStreak >= 30) xp += XP_ACTIONS.WEEKLY_STREAK * 2
    
    return xp
  }, [metrics, allQuestions, currentStreak])

  // Get current level from XP
  const getCurrentLevel = useCallback((xp: number): LevelInfo => {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (xp >= LEVELS[i].minXP) {
        return LEVELS[i]
      }
    }
    return LEVELS[0]
  }, [])

  const totalXP = useMemo(() => calculateTotalXP(), [calculateTotalXP])
  const currentLevel = useMemo(() => getCurrentLevel(totalXP), [getCurrentLevel, totalXP])
  const nextLevel = LEVELS[Math.min(currentLevel.level, LEVELS.length - 1)]
  
  const levelProgress = useMemo(() => {
    const currentLevelXP = totalXP - currentLevel.minXP
    const levelRange = nextLevel.minXP - currentLevel.minXP
    return Math.min(100, (currentLevelXP / levelRange) * 100)
  }, [totalXP, currentLevel, nextLevel])

  // Load saved XP on mount
  useEffect(() => {
    fetch('/api/agent/update-xp')
      .then(res => res.json())
      .then(data => {
        if (data.xp) {
          setSavedXP(data.xp)
          setUnlockedAchievements(data.achievements || [])
        }
      })
      .catch(console.error)
  }, [])

  // Save XP when it changes
  useEffect(() => {
    if (totalXP === savedXP) return
    
    const timer = setTimeout(() => {
      fetch('/api/agent/update-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xp: totalXP,
          level: currentLevel.level,
          streak: currentStreak,
          achievements: unlockedAchievements
        })
      })
      .then(() => setSavedXP(totalXP))
      .catch(console.error)
    }, 2000)
    
    return () => clearTimeout(timer)
  }, [totalXP, currentLevel, currentStreak, unlockedAchievements, savedXP])

  // Calculate achievement progress
  const getAchievementTier = useCallback((category: string, value: number): Achievement => {
    const configs: Record<string, any> = {
      velocidade: {
        icon: Zap,
        bronze: { name: "Tá Voando", req: 50, desc: "50 respostas < 30min", xp: 500 },
        silver: { name: "Usain Bolt do ML", req: 200, desc: "200 respostas < 30min", xp: 1500 },
        gold: { name: "The Flash Brasileiro", req: 500, desc: "500 respostas < 30min", xp: 3000 }
      },
      volume: {
        icon: Target,
        bronze: { name: "No Pântano", req: 100, desc: "100 respostas totais", xp: 400 },
        silver: { name: "No Corre", req: 500, desc: "500 respostas totais", xp: 1200 },
        gold: { name: "Sem Freio", req: 2000, desc: "2000 respostas totais", xp: 2500 }
      },
      qualidade: {
        icon: Diamond,
        bronze: { name: "Tá Pegando o Jeito", req: 80, desc: "80% aprovação automática", xp: 600 },
        silver: { name: "Mestre das Vendas", req: 90, desc: "90% aprovação automática", xp: 1800 },
        gold: { name: "Lágrimas do Chefe", req: 95, desc: "95% aprovação automática", xp: 3500 }
      },
      consistencia: {
        icon: Flame,
        bronze: { name: "Esquentando", req: 7, desc: "7 dias consecutivos", xp: 700 },
        silver: { name: "Foguete Não Dá Ré", req: 15, desc: "15 dias consecutivos", xp: 2000 },
        gold: { name: "Casca-Grossa", req: 30, desc: "30 dias consecutivos", xp: 4000 }
      }
    }
    
    const config = configs[category]
    if (!config) return null as any
    
    let tier: "bronze" | "silver" | "gold" = "bronze"
    let tierData = config.bronze
    let nextTier = null
    
    if (value >= config.gold.req) {
      tier = "gold"
      tierData = config.gold
    } else if (value >= config.silver.req) {
      tier = "silver"
      tierData = config.silver
      nextTier = { name: config.gold.name, requirement: config.gold.req, reward: config.gold.xp }
    } else if (value >= config.bronze.req) {
      tierData = config.bronze
      nextTier = { name: config.silver.name, requirement: config.silver.req, reward: config.silver.xp }
    } else {
      nextTier = { name: config.bronze.name, requirement: config.bronze.req, reward: config.bronze.xp }
    }
    
    return {
      id: `${category}-${tier}`,
      name: tierData.name,
      description: tierData.desc,
      icon: config.icon,
      progress: Math.min(value, tier === "gold" ? config.gold.req : (nextTier?.requirement || config.bronze.req)),
      total: tier === "gold" ? config.gold.req : (nextTier?.requirement || config.bronze.req),
      unlocked: value >= tierData.req,
      tier,
      category,
      xpReward: tierData.xp,
      nextTier
    }
  }, [])

  // Calculate metrics for achievements
  const fastResponses = useMemo(() => 
    allQuestions.filter(q => {
      if (!q.sentToMLAt || !q.receivedAt) return false
      const responseTime = (new Date(q.sentToMLAt).getTime() - new Date(q.receivedAt).getTime()) / 1000 / 60
      return responseTime < 30
    }).length, [allQuestions])

  const qualityScore = useMemo(() => 
    metrics.totalQuestions > 50 ? Math.round((metrics.autoApprovedCount / metrics.totalQuestions) * 100) : 0,
    [metrics])

  const achievements = useMemo(() => [
    getAchievementTier("velocidade", fastResponses),
    getAchievementTier("volume", metrics.answeredQuestions),
    getAchievementTier("qualidade", qualityScore),
    getAchievementTier("consistencia", currentStreak)
  ].filter(Boolean), [getAchievementTier, fastResponses, metrics.answeredQuestions, qualityScore, currentStreak])

  const getTierColor = (tier: string) => {
    switch(tier) {
      case "bronze": return "#B87333"
      case "silver": return "#E5E5E5"
      case "gold": return "#FFE600"
      default: return "#666666"
    }
  }

  return (
    <div className="gamification-container">
      {/* Main Container - Matching Metrics Style Exactly */}
      <div style={{
        background: "linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 230, 0, 0.15)",
        padding: "24px",
        marginBottom: "24px",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Animated background */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "radial-gradient(circle at 80% 20%, rgba(255, 230, 0, 0.1) 0%, transparent 50%)",
          pointerEvents: "none"
        }} />
        
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Header - Exact Match to Metrics */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                fontSize: "40px",
                filter: "drop-shadow(0 0 10px rgba(255, 230, 0, 0.3))"
              }}>
                {currentLevel.badge}
              </div>
              <div>
                <h3 style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#FFE600",
                  marginBottom: "2px"
                }}>
                  Conquistas
                </h3>
                <p style={{ fontSize: "12px", color: "#666" }}>
                  Nível {currentLevel.level}: {currentLevel.title} • {totalXP.toLocaleString()} XP Total
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div style={{ display: "flex", gap: "8px" }}>
              {/* Streak Indicator */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                background: "rgba(0, 0, 0, 0.5)",
                padding: "6px 12px",
                borderRadius: "6px"
              }}>
                <Flame size={12} style={{ color: "#FFE600" }} />
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#FFE600" }}>
                  {currentStreak} dias
                </span>
              </div>
              
              {/* Guide Button */}
              <button
                onClick={() => setShowInfoModal(true)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#FFE600",
                  color: "#000",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Guia
              </button>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div style={{
            background: "rgba(0, 0, 0, 0.5)",
            borderRadius: "8px",
            padding: "3px",
            marginBottom: "24px"
          }}>
            <div style={{
              height: "20px",
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "6px",
              position: "relative",
              overflow: "hidden"
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${levelProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #FFE600 0%, #FFC700 100%)",
                  borderRadius: "6px"
                }}
              />
              <span style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "#FFF",
                fontSize: "11px",
                fontWeight: "600",
                textShadow: "0 1px 2px rgba(0,0,0,0.5)"
              }}>
                {Math.round(levelProgress)}% para próximo nível
              </span>
            </div>
          </div>

          {/* Main Content Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr",
            gap: "16px"
          }}>
            {/* Achievements Grid */}
            <div>
              <h4 style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#FFE600",
                marginBottom: "12px"
              }}>
                Conquistas Ativas
              </h4>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "12px"
              }}>
                {achievements.map((achievement, index) => {
                  const Icon = achievement.icon
                  return (
                    <motion.div
                      key={achievement.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setSelectedAchievement(achievement)}
                      style={{
                        background: achievement.unlocked 
                          ? "rgba(255, 230, 0, 0.05)" 
                          : "rgba(255, 255, 255, 0.02)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: achievement.unlocked
                          ? "1px solid rgba(255, 230, 0, 0.2)"
                          : "1px solid rgba(255, 255, 255, 0.05)",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                          width: "40px",
                          height: "40px",
                          background: achievement.unlocked
                            ? `linear-gradient(135deg, ${getTierColor(achievement.tier)}20 0%, ${getTierColor(achievement.tier)}10 100%)`
                            : "rgba(255, 255, 255, 0.05)",
                          borderRadius: "10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          <Icon size={20} style={{ 
                            color: achievement.unlocked ? getTierColor(achievement.tier) : "#666" 
                          }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: achievement.unlocked ? "#FFE600" : "#999",
                            marginBottom: "4px"
                          }}>
                            {achievement.name}
                          </p>
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                          }}>
                            <div style={{
                              flex: 1,
                              height: "4px",
                              background: "rgba(255, 255, 255, 0.1)",
                              borderRadius: "2px",
                              overflow: "hidden"
                            }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(achievement.progress / achievement.total) * 100}%` }}
                                style={{
                                  height: "100%",
                                  background: getTierColor(achievement.tier),
                                  borderRadius: "2px"
                                }}
                              />
                            </div>
                            <span style={{
                              fontSize: "10px",
                              color: "#666"
                            }}>
                              {achievement.progress}/{achievement.total}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* XP Actions */}
            <div>
              <h4 style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#FFE600",
                marginBottom: "12px"
              }}>
                Ações Recentes de XP
              </h4>
              <div style={{
                background: "rgba(0, 0, 0, 0.5)",
                borderRadius: "12px",
                padding: "12px",
                border: "1px solid rgba(255, 255, 255, 0.05)"
              }}>
                {[
                  { icon: Zap, label: "Resposta Rápida", xp: "+20 XP", color: "#FFE600" },
                  { icon: CheckCircle, label: "Auto Aprovada", xp: "+15 XP", color: "#10B981" },
                  { icon: Star, label: "Alta Qualidade", xp: "+25 XP", color: "#FFE600" }
                ].map((action, i) => {
                  const Icon = action.icon
                  return (
                    <div key={i} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: i < 2 ? "1px solid rgba(255, 255, 255, 0.05)" : "none"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Icon size={14} style={{ color: action.color }} />
                        <span style={{ fontSize: "12px", color: "#999" }}>{action.label}</span>
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: action.color }}>
                        {action.xp}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Guide Modal - Clean and Objective */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInfoModal(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              backdropFilter: "blur(8px)"
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)",
                borderRadius: "16px",
                padding: "24px",
                maxWidth: "480px",
                width: "90%",
                border: "1px solid rgba(255, 230, 0, 0.15)"
              }}
            >
              {/* Modal Header */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "32px",
                    height: "32px",
                    background: "linear-gradient(135deg, #FFE600 0%, #FFC700 100%)",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Info size={16} style={{ color: "#000" }} />
                  </div>
                  <h3 style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#FFE600"
                  }}>
                    Guia do Sistema de XP
                  </h3>
                </div>
                <button
                  onClick={() => setShowInfoModal(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#666",
                    cursor: "pointer"
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content Grid */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* XP Actions */}
                <div>
                  <h4 style={{ fontSize: "13px", fontWeight: "600", color: "#FFE600", marginBottom: "12px" }}>
                    Como Ganhar XP
                  </h4>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "8px"
                  }}>
                    {[
                      { label: "Responder Pergunta", xp: "+10 XP" },
                      { label: "Resposta < 30min", xp: "+20 XP" },
                      { label: "Resposta < 5min", xp: "+30 XP" },
                      { label: "Auto Aprovada", xp: "+15 XP" },
                      { label: "Dia Perfeito", xp: "+100 XP" },
                      { label: "Desbloquear Conquista", xp: "+50 XP" }
                    ].map((item, i) => (
                      <div key={i} style={{
                        background: "rgba(255, 255, 255, 0.02)",
                        borderRadius: "8px",
                        padding: "10px",
                        border: "1px solid rgba(255, 255, 255, 0.05)"
                      }}>
                        <p style={{ fontSize: "11px", color: "#999", marginBottom: "4px" }}>
                          {item.label}
                        </p>
                        <p style={{ fontSize: "14px", fontWeight: "600", color: "#FFE600" }}>
                          {item.xp}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Levels */}
                <div>
                  <h4 style={{ fontSize: "13px", fontWeight: "600", color: "#FFE600", marginBottom: "12px" }}>
                    Níveis do Sistema
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {LEVELS.map((level) => (
                      <div key={level.level} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: currentLevel.level === level.level 
                          ? "rgba(255, 230, 0, 0.1)" 
                          : "rgba(255, 255, 255, 0.02)",
                        borderRadius: "6px",
                        border: currentLevel.level === level.level
                          ? "1px solid rgba(255, 230, 0, 0.2)"
                          : "1px solid rgba(255, 255, 255, 0.05)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "16px" }}>{level.badge}</span>
                          <span style={{ 
                            fontSize: "12px", 
                            fontWeight: "600",
                            color: currentLevel.level === level.level ? "#FFE600" : "#999"
                          }}>
                            {level.title}
                          </span>
                        </div>
                        <span style={{ fontSize: "11px", color: "#666" }}>
                          {level.minXP.toLocaleString()} XP
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievement Detail Modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAchievement(null)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              backdropFilter: "blur(8px)"
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)",
                borderRadius: "16px",
                padding: "32px",
                maxWidth: "400px",
                border: "1px solid rgba(255, 230, 0, 0.15)",
                textAlign: "center"
              }}
            >
              {(() => {
                const Icon = selectedAchievement.icon
                return (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1 }}
                      style={{
                        width: "80px",
                        height: "80px",
                        margin: "0 auto 20px",
                        background: `linear-gradient(135deg, ${getTierColor(selectedAchievement.tier)}30 0%, ${getTierColor(selectedAchievement.tier)}10 100%)`,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Icon size={40} style={{ color: getTierColor(selectedAchievement.tier) }} />
                    </motion.div>
                    
                    <h3 style={{
                      fontSize: "20px",
                      fontWeight: "700",
                      color: "#FFE600",
                      marginBottom: "8px"
                    }}>
                      {selectedAchievement.name}
                    </h3>
                    
                    <p style={{
                      fontSize: "13px",
                      color: "#999",
                      marginBottom: "20px"
                    }}>
                      {selectedAchievement.description}
                    </p>
                    
                    <div style={{
                      background: "rgba(255, 230, 0, 0.05)",
                      borderRadius: "12px",
                      padding: "16px",
                      marginBottom: "16px"
                    }}>
                      <p style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "8px"
                      }}>
                        Progresso
                      </p>
                      <p style={{
                        fontSize: "24px",
                        fontWeight: "700",
                        color: selectedAchievement.unlocked ? "#FFE600" : "#666"
                      }}>
                        {selectedAchievement.progress} / {selectedAchievement.total}
                      </p>
                      <div style={{
                        width: "100%",
                        height: "6px",
                        background: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "3px",
                        marginTop: "12px",
                        overflow: "hidden"
                      }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(selectedAchievement.progress / selectedAchievement.total) * 100}%` }}
                          style={{
                            height: "100%",
                            background: getTierColor(selectedAchievement.tier),
                            borderRadius: "3px"
                          }}
                        />
                      </div>
                    </div>
                    
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}>
                      <Sparkles size={16} style={{ color: getTierColor(selectedAchievement.tier) }} />
                      <span style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: getTierColor(selectedAchievement.tier)
                      }}>
                        {selectedAchievement.xpReward} XP
                      </span>
                      <span style={{
                        fontSize: "12px",
                        padding: "2px 8px",
                        background: `${getTierColor(selectedAchievement.tier)}20`,
                        borderRadius: "4px",
                        color: getTierColor(selectedAchievement.tier),
                        fontWeight: "600",
                        textTransform: "uppercase"
                      }}>
                        {selectedAchievement.tier === "bronze" ? "Bronze" : 
                         selectedAchievement.tier === "silver" ? "Prata" : "Ouro"}
                      </span>
                    </div>
                  </>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}