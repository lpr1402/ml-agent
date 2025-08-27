"use client"

import { useState, useEffect } from "react"
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
  Sword,
  Diamond,
  Brain,
  Rocket,
  Lock,
  CheckCircle,
  Info,
  Clock,
  Heart,
  Gauge,
  MessageSquare,
  Timer
} from "lucide-react"
// Progress bar component is custom implemented below

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

interface XPAction {
  id: string
  name: string
  xp: number
  icon: any
  color: string
}

interface LevelInfo {
  level: number
  title: string
  minQuestions: number
  maxQuestions: number
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
  allQuestions?: any[] // Add allQuestions to access full data
}

const LEVELS: LevelInfo[] = [
  { level: 1, title: "Iniciante", minQuestions: 0, maxQuestions: 1000, color: "#9CA3AF", badge: "🥉" },
  { level: 2, title: "Snowbunny", minQuestions: 1000, maxQuestions: 5000, color: "#10B981", badge: "🏂" },
  { level: 3, title: "Desenrolado", minQuestions: 5000, maxQuestions: 15000, color: "#3B82F6", badge: "⚡" },
  { level: 4, title: "El Puton", minQuestions: 15000, maxQuestions: 50000, color: "#EC4899", badge: "🔥" },
  { level: 5, title: "Gigachad", minQuestions: 50000, maxQuestions: 999999, color: "#FFD700", badge: "👑" }
]

// XP values are now tied to level thresholds
const XP_PER_LEVEL = {
  1: 0,
  2: 1000,
  3: 5000,
  4: 15000,
  5: 50000
}

// XP Actions that give points
const XP_ACTIONS = {
  LIGHTNING_RESPONSE: { name: "Resposta Relâmpago", xp: 50, time: 5 },
  QUICK_RESPONSE: { name: "Resposta Rápida", xp: 30, time: 15 },
  FAST_RESPONSE: { name: "Resposta Ágil", xp: 20, time: 30 },
  GOOD_RESPONSE: { name: "Boa Resposta", xp: 10, time: 60 },
  DAILY_GOAL: { name: "Meta Diária", xp: 100, count: 15 },
  SUPER_PRODUCTIVE: { name: "Super Produtivo", xp: 200, count: 30 },
  MACHINE_MODE: { name: "Modo Máquina", xp: 500, count: 50 },
  PERFECT_ANSWER: { name: "Resposta Perfeita", xp: 25 },
  QUALITY_RESPONSE: { name: "Resposta de Qualidade", xp: 15 },
  SALE_CONVERTED: { name: "Venda Convertida", xp: 40 },
  DAILY_LOGIN: { name: "Login Diário", xp: 10 },
  WEEK_STREAK: { name: "Sequência Semanal", xp: 200 },
  MONTH_STREAK: { name: "Sequência Mensal", xp: 1000 }
}

export function GamificationSection({ metrics, weeklyStats, allQuestions = [] }: GamificationProps) {
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null)
  const [levelUpAnimation, setLevelUpAnimation] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [totalXP, setTotalXP] = useState(0)
  const [savedXP, setSavedXP] = useState(0)
  
  // Calculate current level based on XP
  const getCurrentLevel = () => {
    const xp = totalXP
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (xp >= (XP_PER_LEVEL as any)[LEVELS[i].level]) {
        return LEVELS[i]
      }
    }
    return LEVELS[0]
  }
  
  const currentLevel = getCurrentLevel()
  const nextLevel = LEVELS[LEVELS.indexOf(currentLevel) + 1] || currentLevel
  
  // Calculate progress to next level
  const currentLevelXP = (XP_PER_LEVEL as any)[currentLevel.level]
  const nextLevelXP = (XP_PER_LEVEL as any)[nextLevel.level] || totalXP
  const levelProgress = currentLevel === nextLevel ? 100 : 
    ((totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100

  // Calculate achievements with REAL data
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const monthlyQuestions = allQuestions?.filter((q: any) => {
    const qDate = new Date(q.receivedAt)
    return qDate.getMonth() === currentMonth && qDate.getFullYear() === currentYear
  }).length || 0
  
  const currentQuarter = Math.floor(currentMonth / 3)
  const quarterlyQuestions = allQuestions?.filter((q: any) => {
    const qDate = new Date(q.receivedAt)
    return Math.floor(qDate.getMonth() / 3) === currentQuarter && qDate.getFullYear() === currentYear
  }).length || 0
  
  const dailyGoalDays = (() => {
    // Calculate how many days hit the daily goal of 15+ questions
    const dailyGoal = 15
    const daysWithGoal = new Set()
    allQuestions?.forEach((q: any) => {
      const dateStr = new Date(q.receivedAt).toDateString()
      if (!daysWithGoal.has(dateStr)) {
        const dayQuestions = allQuestions.filter((dq: any) => 
          new Date(dq.receivedAt).toDateString() === dateStr
        ).length
        if (dayQuestions >= dailyGoal) {
          daysWithGoal.add(dateStr)
        }
      }
    })
    // Check consecutive days
    const sortedDates = Array.from(daysWithGoal).sort()
    let maxConsecutive = 0
    let currentStreak = 0
    let lastDate: Date | null = null
    
    sortedDates.forEach((dateStr: any) => {
      const currentDate = new Date(dateStr)
      if (lastDate) {
        const diffDays = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === 1) {
          currentStreak++
        } else {
          currentStreak = 1
        }
      } else {
        currentStreak = 1
      }
      maxConsecutive = Math.max(maxConsecutive, currentStreak)
      lastDate = currentDate
    })
    
    return maxConsecutive
  })()
  
  const maxDailyQuestions = (() => {
    let max = 0
    const dailyCounts = new Map()
    allQuestions?.forEach((q: any) => {
      // Only count business days (Monday-Friday)
      const qDate = new Date(q.receivedAt)
      const dayOfWeek = qDate.getDay()
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday = 1, Friday = 5
        const dateStr = qDate.toDateString()
        dailyCounts.set(dateStr, (dailyCounts.get(dateStr) || 0) + 1)
      }
    })
    dailyCounts.forEach(count => {
      max = Math.max(max, count)
    })
    return max
  })()
  
  // Load saved XP from database
  useEffect(() => {
    const loadXP = async () => {
      try {
        const response = await fetch("/api/agent/update-xp")
        if (response.ok) {
          const data = await response.json()
          setSavedXP(data.xp || 0)
        }
      } catch (error) {
        console.error("Error loading XP:", error)
      }
    }
    loadXP()
  }, [])
  
  // Calculate and save XP from questions
  useEffect(() => {
    let xp = savedXP // Start with saved XP
    
    // XP from responses speed
    allQuestions?.forEach((q: any) => {
      if (!q.sentToMLAt || !q.receivedAt) return
      const responseTime = (new Date(q.sentToMLAt).getTime() - new Date(q.receivedAt).getTime()) / 1000 / 60
      
      if (responseTime <= 5) xp += XP_ACTIONS.LIGHTNING_RESPONSE.xp
      else if (responseTime <= 15) xp += XP_ACTIONS.QUICK_RESPONSE.xp
      else if (responseTime <= 30) xp += XP_ACTIONS.FAST_RESPONSE.xp
      else if (responseTime <= 60) xp += XP_ACTIONS.GOOD_RESPONSE.xp
      
      // Quality XP
      if (q.approvalType === "AUTO") xp += XP_ACTIONS.PERFECT_ANSWER.xp
      if (!q.revisedCount) xp += XP_ACTIONS.QUALITY_RESPONSE.xp
    })
    
    // Daily volume XP
    const today = new Date().toDateString()
    const todayQuestions = allQuestions?.filter((q: any) => 
      new Date(q.receivedAt).toDateString() === today
    ).length || 0
    
    if (todayQuestions >= 50) xp += XP_ACTIONS.MACHINE_MODE.xp
    else if (todayQuestions >= 30) xp += XP_ACTIONS.SUPER_PRODUCTIVE.xp
    else if (todayQuestions >= 15) xp += XP_ACTIONS.DAILY_GOAL.xp
    
    // Streak XP
    if ((weeklyStats?.consecutiveDays || 0) >= 30) xp += XP_ACTIONS.MONTH_STREAK.xp
    else if ((weeklyStats?.consecutiveDays || 0) >= 7) xp += XP_ACTIONS.WEEK_STREAK.xp
    
    setTotalXP(xp)
    
    // Save XP to database if changed
    if (xp !== savedXP && xp > 0) {
      const saveXP = async () => {
        try {
          const currentLevel = getCurrentLevelFromXP(xp)
          const unlockedAchievements = achievements
            .filter(a => a && a.unlocked)
            .map(a => ({ id: a.id, tier: a.tier, unlockedAt: new Date() }))
          
          await fetch("/api/agent/update-xp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              xp,
              level: currentLevel.level,
              streak: (weeklyStats?.consecutiveDays as any) || 0,
              achievements: unlockedAchievements
            })
          })
          setSavedXP(xp)
        } catch (error) {
          console.error("Error saving XP:", error)
        }
      }
      
      // Debounce save to avoid too many requests
      const timer = setTimeout(saveXP, 2000)
      return () => clearTimeout(timer)
    }
  }, [allQuestions, weeklyStats, savedXP])
  
  // Helper function to get level from XP
  const getCurrentLevelFromXP = (xp: number) => {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (xp >= (XP_PER_LEVEL as any)[LEVELS[i].level]) {
        return LEVELS[i]
      }
    }
    return LEVELS[0]
  }
  
  // Calculate metrics for achievements
  const fastResponses = allQuestions?.filter((q: any) => {
    if (!q.sentToMLAt || !q.receivedAt) return false
    const responseTime = (new Date(q.sentToMLAt).getTime() - new Date(q.receivedAt).getTime()) / 1000 / 60
    return responseTime < 30
  }).length || 0
  
  const nightResponses = allQuestions?.filter((q: any) => {
    const hour = new Date(q.receivedAt).getHours()
    return hour >= 22 || hour < 6
  }).length || 0
  
  const perfectDays = (() => {
    const daysWithMetrics = new Map()
    allQuestions?.forEach((q: any) => {
      const dateStr = new Date(q.receivedAt).toDateString()
      if (!daysWithMetrics.has(dateStr)) {
        daysWithMetrics.set(dateStr, { total: 0, approved: 0 })
      }
      const day = daysWithMetrics.get(dateStr)
      day.total++
      if (q.approvalType === "AUTO") day.approved++
    })
    
    let perfectCount = 0
    daysWithMetrics.forEach(day => {
      if (day.total >= 15 && day.approved === day.total) {
        perfectCount++
      }
    })
    return perfectCount
  })()
  
  // Define achievement tiers based on current progress
  const getAchievementTier = (category: string, value: number): Achievement => {
    const achievementConfigs: Record<string, any> = {
      "velocidade": {
        icon: Zap,
        bronze: { name: "Tá Voando", req: 50, desc: "50 respostas < 30min", xp: 500 },
        silver: { name: "Usain Bolt do ML", req: 200, desc: "200 respostas < 30min", xp: 1500 },
        gold: { name: "The Flash Brasileiro", req: 500, desc: "500 respostas < 30min", xp: 3000 }
      },
      "volume": {
        icon: Target,
        bronze: { name: "No Pântano", req: 100, desc: "100 respostas totais", xp: 400 },
        silver: { name: "No Corre", req: 500, desc: "500 respostas totais", xp: 1200 },
        gold: { name: "Sem Freio", req: 2000, desc: "2000 respostas totais", xp: 2500 }
      },
      "qualidade": {
        icon: Diamond,
        bronze: { name: "Tá Pegando o Jeito", req: 80, desc: "80% aprovação automática", xp: 600 },
        silver: { name: "Mestre das Vendas", req: 90, desc: "90% aprovação automática", xp: 1800 },
        gold: { name: "Lágrimas do Chefe", req: 95, desc: "95% aprovação automática", xp: 3500 }
      },
      "consistencia": {
        icon: Flame,
        bronze: { name: "Esquentando", req: 7, desc: "7 dias consecutivos", xp: 700 },
        silver: { name: "Foguete Não Dá Ré", req: 15, desc: "15 dias consecutivos", xp: 2000 },
        gold: { name: "Casca-Grossa", req: 30, desc: "30 dias consecutivos", xp: 4000 }
      },
      "conversao": {
        icon: TrendingUp,
        bronze: { name: "Vendedor Raiz", req: 10, desc: "10% taxa de conversão", xp: 500 },
        silver: { name: "Lobo de Wall Street", req: 15, desc: "15% taxa de conversão", xp: 1500 },
        gold: { name: "Jordan Belfort", req: 20, desc: "20% taxa de conversão", xp: 3000 }
      },
      "satisfacao": {
        icon: Heart,
        bronze: { name: "Simpático", req: 100, desc: "100 interações positivas", xp: 400 },
        silver: { name: "Queridinho", req: 500, desc: "500 interações positivas", xp: 1200 },
        gold: { name: "James Traz a Salada de Fruta", req: 1000, desc: "1000 interações positivas", xp: 2500 }
      },
      "dedicacao": {
        icon: Shield,
        bronze: { name: "Coruja", req: 50, desc: "50 respostas fora de horário", xp: 600 },
        silver: { name: "Vampiro do ML", req: 200, desc: "200 respostas fora de horário", xp: 1800 },
        gold: { name: "Batman do Atendimento", req: 500, desc: "500 respostas fora de horário", xp: 3500 }
      },
      "perfeicao": {
        icon: CheckCircle,
        bronze: { name: "Dia Perfeito", req: 1, desc: "1 dia perfeito (15+ respostas)", xp: 800 },
        silver: { name: "Semana dos Sonhos", req: 7, desc: "7 dias perfeitos", xp: 2500 },
        gold: { name: "Máquina Infalível", req: 30, desc: "30 dias perfeitos", xp: 5000 }
      },
      "expertise": {
        icon: Crown,
        bronze: { name: "Aprendiz", req: 3, desc: "Seguindo 3 práticas do ML", xp: 500 },
        silver: { name: "Conhecedor", req: 5, desc: "Seguindo 5 práticas do ML", xp: 1500 },
        gold: { name: "Sensei do Mercado Livre", req: 7, desc: "Seguindo todas as práticas", xp: 3000 }
      }
    }
    
    const config = (achievementConfigs as any)[category]
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
      nextTier = {
        name: config.gold.name,
        requirement: config.gold.req,
        reward: config.gold.xp
      }
    } else if (value >= config.bronze.req) {
      tier = "bronze"
      tierData = config.bronze
      nextTier = {
        name: config.silver.name,
        requirement: config.silver.req,
        reward: config.silver.xp
      }
    } else {
      // Not unlocked yet, show progress to bronze
      nextTier = {
        name: config.bronze.name,
        requirement: config.bronze.req,
        reward: config.bronze.xp
      } as any
    }
    
    const progress = tier === "gold" ? config.gold.req : 
                    Math.min(value, nextTier?.requirement || config.bronze.req)
    
    return {
      id: `${category}-${tier}`,
      name: tierData.name,
      description: tierData.desc,
      icon: config.icon,
      progress: progress,
      total: tier === "gold" ? config.gold.req : (nextTier?.requirement || config.bronze.req),
      unlocked: value >= tierData.req,
      tier: tier,
      category: category,
      xpReward: tierData.xp,
      nextTier: nextTier
    }
  }
  
  const achievements: Achievement[] = [
    // Speed Achievement
    getAchievementTier("velocidade", fastResponses),
    
    // Volume Achievement
    getAchievementTier("volume", metrics.answeredQuestions),
    
    // Quality Achievement
    getAchievementTier("qualidade", 
      metrics.totalQuestions > 50 ? Math.round((metrics.autoApprovedCount / metrics.totalQuestions) * 100) : 0
    ),
    
    // Consistency Achievement
    getAchievementTier("consistencia", weeklyStats?.consecutiveDays || 0),
    
    // Conversion Achievement
    getAchievementTier("conversao", Math.round(metrics.conversionRate * 100)),
    
    // Satisfaction Achievement (using answered questions as proxy)
    getAchievementTier("satisfacao", metrics.answeredQuestions),
    
    // Dedication Achievement (night/weekend responses)
    getAchievementTier("dedicacao", nightResponses),
    
    // Perfection Achievement
    getAchievementTier("perfeicao", perfectDays),
    
    // Expertise Achievement (based on following ML best practices)
    getAchievementTier("expertise", 
      Math.floor(
        (metrics.avgResponseTime <= 60 ? 1 : 0) + // Fast responses
        (metrics.conversionRate >= 0.15 ? 1 : 0) + // Good conversion
        ((metrics.autoApprovedCount / Math.max(metrics.totalQuestions, 1)) >= 0.8 ? 1 : 0) + // High quality
        ((weeklyStats?.consecutiveDays || 0) >= 7 ? 1 : 0) + // Consistency
        (metrics.answeredQuestions >= 100 ? 1 : 0) + // Volume
        (nightResponses >= 50 ? 1 : 0) + // Dedication
        (perfectDays >= 1 ? 1 : 0) // Perfection
      )
    )
  ].filter(Boolean) // Remove any null achievements
  
  const oldAchievements: Achievement[] = [
  ]

  // Calculate total XP earned from achievements
  const totalAchievementXP = achievements
    .filter(a => a.unlocked)
    .reduce((sum, a) => sum + a.xpReward, 0)

  const getTierColor = (tier: string) => {
    switch(tier) {
      case "bronze": return "#B87333" // Bronze premium
      case "silver": return "#E5E5E5" // Silver premium  
      case "gold": return "#FFE600" // Gold ML brand
      default: return "#666666"
    }
  }
  
  const getTierBackground = (tier: string, unlocked: boolean) => {
    if (!unlocked) return "linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)"
    
    switch(tier) {
      case "bronze":
        return "linear-gradient(135deg, rgba(184, 115, 51, 0.15) 0%, rgba(184, 115, 51, 0.05) 100%)"
      case "silver":
        return "linear-gradient(135deg, rgba(229, 229, 229, 0.15) 0%, rgba(229, 229, 229, 0.05) 100%)"
      case "gold":
        return "linear-gradient(135deg, rgba(255, 230, 0, 0.15) 0%, rgba(255, 230, 0, 0.05) 100%)"
      default:
        return "linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)"
    }
  }
  
  const getTierBorder = (tier: string, unlocked: boolean) => {
    if (!unlocked) return "1px solid rgba(255, 255, 255, 0.05)"
    
    switch(tier) {
      case "bronze":
        return "1px solid rgba(184, 115, 51, 0.3)"
      case "silver":
        return "1px solid rgba(229, 229, 229, 0.3)"
      case "gold":
        return "1px solid rgba(255, 230, 0, 0.3)"
      default:
        return "1px solid rgba(255, 255, 255, 0.05)"
    }
  }

  return (
    <div className="gamification-container">
      {/* Level Section */}
      <div className="level-section" style={{
        background: "linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 230, 0, 0.1)",
        padding: "24px",
        marginBottom: "24px",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Background pattern */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `radial-gradient(circle at 20% 50%, ${currentLevel.color}15 0%, transparent 50%)`,
          pointerEvents: "none"
        }} />
        
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Level Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                style={{
                  fontSize: "48px",
                  filter: "drop-shadow(0 0 20px rgba(255, 230, 0, 0.3))"
                }}
              >
                {currentLevel.badge}
              </motion.div>
              
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <h3 style={{
                    fontSize: "28px",
                    fontWeight: "700",
                    background: `linear-gradient(135deg, ${currentLevel.color} 0%, #FFE600 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                  }}>
                    Level {currentLevel.level}
                  </h3>
                  <span style={{ color: "#666", fontSize: "14px", fontWeight: "500" }}>
                    {currentLevel.title}
                  </span>
                </div>
                <p style={{ color: "#999", fontSize: "13px", marginTop: "4px" }}>
                  {totalXP.toLocaleString()} XP • {metrics.totalQuestions} perguntas respondidas
                </p>
              </div>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ color: "#FFE600", fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>
                  Próximo: {nextLevel.title}
                </p>
                <p style={{ color: "#666", fontSize: "12px" }}>
                  {((XP_PER_LEVEL as any)[nextLevel.level] - totalXP).toLocaleString()} XP restantes
                </p>
              </div>
              <button
                onClick={() => setShowInfoModal(true)}
                style={{
                  padding: "6px 12px",
                  background: "rgba(255, 230, 0, 0.1)",
                  border: "1px solid rgba(255, 230, 0, 0.2)",
                  borderRadius: "8px",
                  color: "#FFE600",
                  fontSize: "12px",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 230, 0, 0.2)"
                  e.currentTarget.style.borderColor = "rgba(255, 230, 0, 0.3)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 230, 0, 0.1)"
                  e.currentTarget.style.borderColor = "rgba(255, 230, 0, 0.2)"
                }}
              >
                <Info size={14} />
                Guia
              </button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div style={{
            background: "rgba(0, 0, 0, 0.5)",
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "24px"
          }}>
            <div style={{
              height: "24px",
              background: "rgba(255, 230, 0, 0.1)",
              borderRadius: "8px",
              position: "relative",
              overflow: "hidden"
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${levelProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{
                  height: "100%",
                  background: `linear-gradient(90deg, ${currentLevel.color} 0%, #FFE600 100%)`,
                  borderRadius: "8px",
                  position: "relative"
                }}
              >
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 50%)"
                }} />
              </motion.div>
              <span style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "#FFF",
                fontSize: "12px",
                fontWeight: "600",
                textShadow: "0 1px 2px rgba(0,0,0,0.5)"
              }}>
                {Math.round(levelProgress)}%
              </span>
            </div>
          </div>
          
          {/* Achievements Grid */}
          <div>
            <h4 style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#FFE600",
              marginBottom: "16px",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              Conquistas
            </h4>
            
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: "12px"
            }}>
              {achievements.map((achievement) => {
                const Icon = achievement.icon
                const isUnlocked = achievement.unlocked
                const progress = (achievement.progress / achievement.total) * 100
                
                return (
                  <motion.div
                    key={achievement.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedAchievement(achievement)}
                    style={{
                      background: getTierBackground(achievement.tier, isUnlocked),
                      borderRadius: "12px",
                      padding: "12px",
                      cursor: "pointer",
                      position: "relative",
                      border: getTierBorder(achievement.tier, isUnlocked),
                      overflow: "hidden",
                      transition: "all 0.3s ease"
                    }}
                  >
                    {/* Glow effect for unlocked */}
                    {isUnlocked && (
                      <motion.div
                        animate={{
                          opacity: [0.3, 0.6, 0.3]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity
                        }}
                        style={{
                          position: "absolute",
                          top: "-50%",
                          left: "-50%",
                          width: "200%",
                          height: "200%",
                          background: "radial-gradient(circle, rgba(255, 230, 0, 0.2) 0%, transparent 70%)",
                          pointerEvents: "none"
                        }}
                      />
                    )}
                    
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "8px",
                        position: "relative"
                      }}>
                        <Icon 
                          size={24} 
                          style={{
                            color: isUnlocked ? getTierColor(achievement.tier) : "#666",
                            filter: isUnlocked ? `drop-shadow(0 0 10px ${getTierColor(achievement.tier)}80)` : "none"
                          }}
                        />
                        {isUnlocked && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            style={{
                              position: "absolute",
                              top: -4,
                              right: -4,
                              background: getTierColor(achievement.tier),
                              borderRadius: "50%",
                              width: "16px",
                              height: "16px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                          >
                            <CheckCircle size={10} style={{ color: "#000" }} />
                          </motion.div>
                        )}
                        {/* Premium Tier Indicator */}
                        {isUnlocked && (
                          <div style={{
                            position: "absolute",
                            top: -8,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: "40px",
                            height: "2px",
                            background: getTierColor(achievement.tier),
                            borderRadius: "2px",
                            boxShadow: `0 0 10px ${getTierColor(achievement.tier)}60`
                          }} />
                        )}
                      </div>
                      
                      <p style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: isUnlocked ? getTierColor(achievement.tier) : "#666",
                        textAlign: "center",
                        marginBottom: "4px",
                        letterSpacing: "0.02em"
                      }}>
                        {achievement.name}
                      </p>
                      
                      <div style={{
                        height: "3px",
                        background: "rgba(0, 0, 0, 0.3)",
                        borderRadius: "2px",
                        overflow: "hidden"
                      }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.5 }}
                          style={{
                            height: "100%",
                            background: "#FFE600"
                          }}
                        />
                      </div>
                      
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                        marginTop: "4px"
                      }}>
                        <p style={{
                          fontSize: "9px",
                          color: isUnlocked ? getTierColor(achievement.tier) : "#555",
                          fontWeight: "500"
                        }}>
                          {achievement.progress}/{achievement.total}
                        </p>
                        {isUnlocked && (
                          <div style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: getTierColor(achievement.tier),
                            opacity: 0.8
                          }} />
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Achievement Modal */}
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
              background: "rgba(0, 0, 0, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              backdropFilter: "blur(8px)"
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)",
                borderRadius: "20px",
                padding: "32px",
                maxWidth: "400px",
                border: "1px solid rgba(255, 230, 0, 0.2)",
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
                        background: `linear-gradient(135deg, ${getTierColor(selectedAchievement.tier)} 0%, ${getTierColor(selectedAchievement.tier)}80 100%)`,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Icon size={40} style={{ color: "#FFE600" }} />
                    </motion.div>
                    
                    <h3 style={{
                      fontSize: "24px",
                      fontWeight: "700",
                      color: "#FFE600",
                      marginBottom: "8px"
                    }}>
                      {selectedAchievement.name}
                    </h3>
                    
                    <p style={{
                      fontSize: "14px",
                      color: "#999",
                      marginBottom: "20px"
                    }}>
                      {selectedAchievement.description}
                    </p>
                    
                    <div style={{
                      background: "rgba(255, 230, 0, 0.1)",
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
                        fontSize: "28px",
                        fontWeight: "700",
                        color: selectedAchievement.unlocked ? "#FFE600" : "#666"
                      }}>
                        {selectedAchievement.progress} / {selectedAchievement.total}
                      </p>
                    </div>
                    
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px"
                    }}>
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
                      
                      {selectedAchievement.nextTier && (
                        <div style={{
                          background: "rgba(255, 230, 0, 0.05)",
                          borderRadius: "8px",
                          padding: "12px",
                          border: "1px solid rgba(255, 230, 0, 0.1)"
                        }}>
                          <p style={{
                            fontSize: "11px",
                            color: "#999",
                            marginBottom: "4px"
                          }}>
                            Próximo nível
                          </p>
                          <p style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "#FFE600",
                            marginBottom: "2px"
                          }}>
                            {selectedAchievement.nextTier.name}
                          </p>
                          <p style={{
                            fontSize: "11px",
                            color: "#666"
                          }}>
                            Requer: {selectedAchievement.nextTier.requirement} • Recompensa: {selectedAchievement.nextTier.reward} XP
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Info Modal - How to Reach Gigachad */}
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
              background: "rgba(0, 0, 0, 0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
              backdropFilter: "blur(10px)",
              padding: "20px"
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)",
                borderRadius: "24px",
                padding: "32px",
                maxWidth: "800px",
                width: "100%",
                maxHeight: "90vh",
                overflow: "auto",
                border: "1px solid rgba(255, 230, 0, 0.2)",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)"
              }}
            >
              {/* Header */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "32px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{
                    width: "48px",
                    height: "48px",
                    background: "linear-gradient(135deg, #FFE600 0%, #FFD700 100%)",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Crown size={24} style={{ color: "#000" }} />
                  </div>
                  <div>
                    <h2 style={{
                      fontSize: "24px",
                      fontWeight: "700",
                      color: "#FFE600",
                      marginBottom: "4px"
                    }}>
                      Guia do Gigachad
                    </h2>
                    <p style={{ fontSize: "14px", color: "#999" }}>
                      Como dominar o atendimento e alcançar o nível máximo
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInfoModal(false)}
                  style={{
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "transparent",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    color: "#666",
                    fontSize: "18px",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#FFE600"
                    e.currentTarget.style.borderColor = "rgba(255, 230, 0, 0.3)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#666"
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"
                  }}
                >
                  ✕
                </button>
              </div>
              
              {/* Levels Guide */}
              <div style={{
                background: "rgba(255, 230, 0, 0.05)",
                borderRadius: "16px",
                padding: "24px",
                marginBottom: "24px",
                border: "1px solid rgba(255, 230, 0, 0.1)"
              }}>
                <h3 style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#FFE600",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <Trophy size={18} />
                  Jornada dos Níveis
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {LEVELS.map((level, index) => (
                    <div key={level.level} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      padding: "12px",
                      background: currentLevel.level === level.level ? "rgba(255, 230, 0, 0.1)" : "rgba(0, 0, 0, 0.3)",
                      borderRadius: "8px",
                      border: currentLevel.level === level.level ? "1px solid rgba(255, 230, 0, 0.3)" : "1px solid transparent"
                    }}>
                      <div style={{ fontSize: "24px" }}>{level.badge}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: "14px",
                          fontWeight: "600",
                          color: level.color,
                          marginBottom: "2px"
                        }}>
                          Nível {level.level}: {level.title}
                        </div>
                        <div style={{
                          fontSize: "12px",
                          color: "#999"
                        }}>
                          {level.minQuestions} - {level.maxQuestions === 999999 ? "∞" : level.maxQuestions} perguntas
                        </div>
                      </div>
                      {currentLevel.level === level.level && (
                        <span style={{
                          padding: "4px 8px",
                          background: "rgba(255, 230, 0, 0.2)",
                          borderRadius: "4px",
                          fontSize: "11px",
                          color: "#FFE600",
                          fontWeight: "600"
                        }}>
                          ATUAL
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Tips Section */}
              <div style={{
                background: "rgba(59, 130, 246, 0.05)",
                borderRadius: "16px",
                padding: "24px",
                marginBottom: "24px",
                border: "1px solid rgba(59, 130, 246, 0.1)"
              }}>
                <h3 style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#3B82F6",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <Sparkles size={18} />
                  Dicas do Mercado Livre
                </h3>
                <div style={{ display: "grid", gap: "12px" }}>
                  <div style={{
                    padding: "12px",
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "8px",
                    display: "flex",
                    gap: "12px"
                  }}>
                    <Clock size={20} style={{ color: "#FFE600", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#FFE600", marginBottom: "4px" }}>
                        Responda em menos de 1 hora
                      </div>
                      <div style={{ fontSize: "12px", color: "#999" }}>
                        Segundo o ML, respostas rápidas aumentam vendas em até 10%. O algoritmo prioriza anúncios com respostas ágeis.
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    padding: "12px",
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "8px",
                    display: "flex",
                    gap: "12px"
                  }}>
                    <Heart size={20} style={{ color: "#EC4899", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#EC4899", marginBottom: "4px" }}>
                        Seja cordial e completo
                      </div>
                      <div style={{ fontSize: "12px", color: "#999" }}>
                        Respostas detalhadas e amigáveis convertem 3x mais. Use o nome do cliente quando disponível.
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    padding: "12px",
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "8px",
                    display: "flex",
                    gap: "12px"
                  }}>
                    <Target size={20} style={{ color: "#10B981", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#10B981", marginBottom: "4px" }}>
                        Foque na conversão
                      </div>
                      <div style={{ fontSize: "12px", color: "#999" }}>
                        Sempre inclua um call-to-action. Convide para comprar, ofereça frete grátis ou desconto quando possível.
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    padding: "12px",
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "8px",
                    display: "flex",
                    gap: "12px"
                  }}>
                    <Zap size={20} style={{ color: "#F59E0B", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#F59E0B", marginBottom: "4px" }}>
                        Mantenha consistência
                      </div>
                      <div style={{ fontSize: "12px", color: "#999" }}>
                        Responda todos os dias, mesmo fins de semana. O ML valoriza vendedores sempre ativos.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Achievements Guide */}
              <div style={{
                background: "rgba(236, 72, 153, 0.05)",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid rgba(236, 72, 153, 0.1)"
              }}>
                <h3 style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#EC4899",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <Award size={18} />
                  Como Desbloquear Conquistas
                </h3>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px"
                }}>
                  <div style={{
                    padding: "12px",
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "8px"
                  }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#FFE600", marginBottom: "4px" }}>
                      🎯 Volume
                    </div>
                    <div style={{ fontSize: "11px", color: "#999" }}>
                      Responda muitas perguntas para conquistar "No Pântano", "No Corre" e "Sem Freio"
                    </div>
                  </div>
                  
                  <div style={{
                    padding: "12px",
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "8px"
                  }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#3B82F6", marginBottom: "4px" }}>
                      ⚡ Velocidade
                    </div>
                    <div style={{ fontSize: "11px", color: "#999" }}>
                      Seja rápido! "Velocidade da Luz" e "The Flash" recompensam agilidade
                    </div>
                  </div>
                  
                  <div style={{
                    padding: "12px",
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "8px"
                  }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#10B981", marginBottom: "4px" }}>
                      💎 Qualidade
                    </div>
                    <div style={{ fontSize: "11px", color: "#999" }}>
                      Aprove sem editar para "Mestre das Vendas" e evite erros para "Sem Erro"
                    </div>
                  </div>
                  
                  <div style={{
                    padding: "12px",
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "8px"
                  }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#EC4899", marginBottom: "4px" }}>
                      🚀 Consistência
                    </div>
                    <div style={{ fontSize: "11px", color: "#999" }}>
                      Mantenha ritmo diário para "Foguete Não Dá Ré" e "Linha de Montagem"
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Call to Action */}
              <div style={{
                textAlign: "center",
                padding: "24px",
                background: "linear-gradient(135deg, rgba(255, 230, 0, 0.1) 0%, rgba(255, 230, 0, 0.05) 100%)",
                borderRadius: "16px",
                border: "1px solid rgba(255, 230, 0, 0.2)"
              }}>
                <Crown size={32} style={{ color: "#FFE600", margin: "0 auto 12px" }} />
                <h3 style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#FFE600",
                  marginBottom: "8px"
                }}>
                  Rumo ao Gigachad!
                </h3>
                <p style={{
                  fontSize: "13px",
                  color: "#999",
                  lineHeight: "1.6"
                }}>
                  Você está no nível <span style={{ color: "#FFE600", fontWeight: "600" }}>{currentLevel.title}</span> com{" "}
                  <span style={{ color: "#FFE600", fontWeight: "600" }}>{metrics.totalQuestions}</span> perguntas respondidas.
                  <br />
                  Faltam <span style={{ color: "#FFE600", fontWeight: "600" }}>
                    {Math.max(0, 5001 - metrics.totalQuestions)}
                  </span> perguntas para alcançar o Gigachad!
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}