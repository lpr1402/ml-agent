"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Trophy,
  MessageSquare,
  DollarSign,
  Plus,
  User,
  RefreshCw,
  Calendar
} from "lucide-react"

interface AccountMetrics {
  id: string
  nickname: string
  mlUserId: string
  isActive: boolean
  totalQuestions: number
  answeredQuestions: number
  pendingQuestions: number
  totalRevenue: number
  avgResponseTime: number
  conversionRate: number
  reputation: number
  lastSync?: Date
  activeListings?: number
  totalSales?: number
  thumbnail?: string | null
  realProfit?: number // Lucro real calculado
  mlFees?: number // Taxas do ML
  shippingCosts?: number // Custos de envio
}

interface MLAccountsPodiumProps {
  organizationId: string
  onAddAccount?: () => void
}

export function MLAccountsPodium({ organizationId, onAddAccount }: MLAccountsPodiumProps) {
  const [accounts, setAccounts] = useState<AccountMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<"revenue" | "questions">("revenue")
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<"today" | "7days" | "30days">("7days")

  // Fetch REAL accounts data from database with period filter
  const fetchAccounts = async () => {
    try {
      setRefreshing(true)
      const response = await fetch(`/api/ml-accounts/metrics?period=${period}`)
      if (response.ok) {
        const data = await response.json()
        // Calculate real profit for each account
        const accountsWithProfit = (data.accounts || []).map((acc: AccountMetrics) => {
          // Calculate ML fees (average 13% commission)
          const mlFees = acc.totalRevenue * 0.13
          // Estimate shipping costs (average R$15 per sale)
          const shippingCosts = acc.answeredQuestions * 15
          // Calculate real profit
          const realProfit = acc.totalRevenue - mlFees - shippingCosts

          return {
            ...acc,
            mlFees,
            shippingCosts,
            realProfit: Math.max(0, realProfit)
          }
        })
        setAccounts(accountsWithProfit)
      }
    } catch (error) {
      console.error("Error fetching real accounts data:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
    // Periodic refresh every minute (SSE handles real-time)
    const interval = setInterval(fetchAccounts, 60000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, period])

  // Sort accounts by selected metric - using REAL DATA
  const sortedAccounts = [...accounts].sort((a, b) => {
    if (sortBy === "questions") {
      return b.totalQuestions - a.totalQuestions
    } else {
      // Sort by revenue
      return b.totalRevenue - a.totalRevenue
    }
  })

  // Create podium structure with proper positions
  const topThree = sortedAccounts.slice(0, 3)

  // Podium slots configuration: [left, center, right]
  interface PodiumSlot {
    account: AccountMetrics | null
    position: number // 1, 2, 3 (actual ranking)
    visualIndex: number // 0=left, 1=center, 2=right
  }

  const podiumSlots: PodiumSlot[] = [
    { account: null, position: 2, visualIndex: 0 }, // Left slot - 2nd place
    { account: null, position: 1, visualIndex: 1 }, // Center slot - 1st place
    { account: null, position: 3, visualIndex: 2 }  // Right slot - 3rd place
  ]

  // Fill slots based on available accounts
  if (topThree[0]) {
    podiumSlots[1]!.account = topThree[0] // 1st place -> center
  }
  if (topThree[1]) {
    podiumSlots[0]!.account = topThree[1] // 2nd place -> left
  }
  if (topThree[2]) {
    podiumSlots[2]!.account = topThree[2] // 3rd place -> right
  }

  // Other accounts (4th to 10th place)
  const otherAccounts = sortedAccounts.slice(3, 10)

  // Format REAL currency values from database
  const formatCurrency = (value: number) => {
    if (!value || value === 0) return "R$ 0"
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  // Format REAL time values from database
  const formatTime = (minutes: number) => {
    if (!minutes || minutes === 0) return "0min"
    if (minutes < 60) return `${Math.round(minutes)}min`
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}h${mins > 0 ? ` ${mins}m` : ""}`
  }



  // Get position style with premium medal colors matching the header icon
  const getPodiumStyle = (position: number) => {
    switch (position) {
      case 1:  // 1st place - GOLD (matching header icon)
        return {
          medalColor: "from-gold to-gold-light",
          borderColor: "border-gold/20",
          shadowColor: "shadow-gold/30",
          textColor: "text-gold",
          bgGlow: "from-gold/10 via-transparent to-gold/10",
          ringColor: "ring-gold/40",
          badgeTextColor: "text-black",
          height: 320,
          badgeSize: "w-9 h-9 sm:w-12 sm:h-12 lg:w-14 lg:h-14",
          fontSize: "text-xs sm:text-base lg:text-lg",
          avatarSize: "w-12 h-12 sm:w-16 sm:h-16 lg:w-18 lg:h-18",
          nameSize: "text-[11px] sm:text-sm lg:text-base",
          position: "1º"
        }
      case 2:  // 2nd place - SILVER (harmonized with gold)
        return {
          medalColor: "from-gray-300 to-gray-400",
          borderColor: "border-gray-400/20",
          shadowColor: "shadow-gray-400/20",
          textColor: "text-gray-300",
          bgGlow: "from-gray-400/10 via-transparent to-gray-400/10",
          ringColor: "ring-gray-400/30",
          badgeTextColor: "text-gray-800",
          height: 280,
          badgeSize: "w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12",
          fontSize: "text-xs sm:text-base lg:text-lg",
          avatarSize: "w-11 h-11 sm:w-14 sm:h-14 lg:w-15 lg:h-15",
          nameSize: "text-[10px] sm:text-sm lg:text-base",
          position: "2º"
        }
      case 3:  // 3rd place - BRONZE (harmonized with gold)
        return {
          medalColor: "from-amber-600 to-amber-700",
          borderColor: "border-amber-700/20",
          shadowColor: "shadow-amber-700/20",
          textColor: "text-amber-600",
          bgGlow: "from-amber-700/10 via-transparent to-amber-700/10",
          ringColor: "ring-amber-700/30",
          badgeTextColor: "text-amber-900",
          height: 240,
          badgeSize: "w-7 h-7 sm:w-9 sm:h-9 lg:w-11 lg:h-11",
          fontSize: "text-[10px] sm:text-sm lg:text-base",
          avatarSize: "w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14",
          nameSize: "text-[10px] sm:text-xs lg:text-sm",
          position: "3º"
        }
      default:  // 4th-10th place - minimal styling
        return {
          medalColor: "from-gray-600 to-gray-700",
          borderColor: "border-gray-600/20",
          shadowColor: "shadow-gray-600/20",
          textColor: "text-gray-500",
          bgGlow: "from-gray-600/5 via-transparent to-gray-600/5",
          ringColor: "ring-gray-700/20",
          badgeTextColor: "text-gray-700",
          height: 200,
          badgeSize: "w-10 h-10",
          fontSize: "text-sm",
          avatarSize: "w-12 h-12",
          nameSize: "text-xs",
          position: `${position}º`
        }
    }
  }

  return (
    <div className="w-full">
      {/* Container matching MetricsROIModern style - Mobile Optimized */}
      <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-2xl overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
          {/* Header - Mobile Optimized */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6 lg:mb-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gold">
                  Ranking da Organização
                </h3>
                <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">
                  Performance em tempo real das contas
                </p>
              </div>
            </div>

            {/* Controls - Mobile Optimized */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
              {/* Period selector - Mobile Optimized */}
              <div className="flex gap-1 bg-black/50 p-1 rounded-lg sm:rounded-xl flex-1 sm:flex-none">
                {[
                  { value: "today" as const, label: "Hoje", icon: Calendar },
                  { value: "7days" as const, label: "7 Dias", icon: Calendar },
                  { value: "30days" as const, label: "30 Dias", icon: Calendar }
                ].map(option => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      onClick={() => setPeriod(option.value)}
                      className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold transition-all duration-300 flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 ${
                        period === option.value
                          ? 'bg-gradient-to-r from-gold to-gold-light text-black shadow-lg shadow-gold/30'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span className="hidden sm:inline">{option.label}</span>
                      <span className="sm:hidden">{option.value === "today" ? "Hoje" : option.value === "7days" ? "7D" : "30D"}</span>
                    </button>
                  )
                })}
              </div>

              {/* Sort selector - Mobile Optimized */}
              <div className="flex gap-1 bg-black/50 p-1 rounded-lg sm:rounded-xl flex-1 sm:flex-none">
                {[
                  { value: "revenue" as const, label: "Faturamento", icon: DollarSign },
                  { value: "questions" as const, label: "Perguntas", icon: MessageSquare }
                ].map(option => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-1 sm:gap-1.5 ${
                        sortBy === option.value
                          ? 'bg-white/10 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span className="hidden sm:inline">{option.label}</span>
                      <span className="sm:hidden">{option.value === "revenue" ? "R$" : "Q"}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {loading && !refreshing ? (
            // Loading state
            <div className="flex justify-center items-center h-64">
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw className="w-6 h-6 text-gold" />
                </motion.div>
                <span className="text-sm text-gray-400">Carregando dados reais...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Podium Section - Mobile: Sequencial (1º,2º,3º) | Desktop: Pódio (2º,1º,3º) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2 lg:gap-4 mb-4 sm:mb-6 sm:items-stretch">
                {podiumSlots.map((slot) => {
                  const { account, position, visualIndex } = slot
                  const style = getPodiumStyle(position)
                  const isFirst = position === 1
                  const isSecond = position === 2

                  // Different heights for desktop based on position
                  // Mobile: altura compacta otimizada | Desktop: altura maior com espaço adequado
                  const heightClass = position === 1
                    ? "min-h-[220px] sm:min-h-[360px]"
                    : position === 2
                    ? "min-h-[220px] sm:min-h-[320px]"
                    : "min-h-[220px] sm:min-h-[280px]"

                  // Mobile: ordem sequencial (1º, 2º, 3º)
                  // Desktop: ordem de pódio (2º à esquerda, 1º centro, 3º direita)
                  const mobileOrder = position === 1 ? 'order-1' : position === 2 ? 'order-2' : 'order-3'
                  const desktopOrder = 'sm:order-none' // Desktop usa ordem natural do grid

                  return (
                    <motion.div
                      key={visualIndex}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: visualIndex * 0.1 }}
                      className={`relative block w-full ${heightClass} ${mobileOrder} ${desktopOrder}`}
                    >
                      {account ? (
                        // Premium Card - Modal Inspired Style
                        <motion.div
                          whileHover={{ scale: 1.01, y: -2 }}
                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          className={`relative w-full h-full rounded-2xl bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-2xl border border-white/5 group hover:border-${isFirst ? 'gold' : isSecond ? 'gray-400' : 'amber-600'}/20 transition-all duration-300 flex flex-col`}
                        >
                          {/* Premium Background Glow */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${style.bgGlow} opacity-30 pointer-events-none`} />
                          {/* Position Badge - Premium Clean */}
                          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20">
                            <div className="relative">
                              <div className={`absolute inset-0 bg-${isFirst ? 'gold' : isSecond ? 'gray-400' : 'amber-600'}/20 blur-xl`} />
                              <div className={`relative ${style.badgeSize} rounded-full bg-gradient-to-br ${style.medalColor} shadow-lg flex items-center justify-center`}>
                                <span className={`${style.fontSize} font-bold ${style.badgeTextColor} leading-none`}>{style.position}</span>
                              </div>
                            </div>
                          </div>

                          {/* Content - Mobile Optimized */}
                          <div className="relative z-10 h-full flex flex-col p-3 sm:p-5 lg:p-6">
                            {/* Account Header - Ultra Clean */}
                            <div className="text-center mb-3 sm:mb-4 mt-6 sm:mt-8">
                              {/* Avatar - Clean Minimal Style */}
                              <div className="mb-2 sm:mb-3 flex justify-center">
                                {account.thumbnail ? (
                                  <div className="relative">
                                    <div className={`absolute inset-0 bg-${isFirst ? 'gold' : isSecond ? 'gray-400' : 'amber-600'}/10 blur-xl`} />
                                    <div className={`relative ${style.avatarSize} rounded-full border border-white/10 p-1 bg-black/30`}>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={account.thumbnail}
                                        alt={account.nickname}
                                        className="w-full h-full rounded-full object-cover"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <div className={`absolute inset-0 bg-${isFirst ? 'gold' : isSecond ? 'gray-400' : 'amber-600'}/10 blur-xl`} />
                                    <div className={`relative ${style.avatarSize} rounded-full bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 flex items-center justify-center`}>
                                      <User className={`${isFirst ? "w-10 h-10" : isSecond ? "w-8 h-8" : "w-7 h-7"} ${style.textColor} opacity-50`} />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Name - Clean Typography */}
                              <h4 className={`font-semibold text-white ${style.nameSize} px-2 sm:px-4 leading-tight line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem] flex items-center justify-center`}>
                                {account.nickname}
                              </h4>
                            </div>

                            {/* Primary Metric - Compacto Mobile */}
                            <div className="flex-1 flex flex-col justify-center mb-3 sm:mb-4 px-1 sm:px-2">
                              <div className="p-2.5 sm:p-3 lg:p-4 rounded-lg bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5">
                                <p className={`${
                                  isFirst ? 'text-sm sm:text-2xl lg:text-3xl' : isSecond ? 'text-xs sm:text-xl lg:text-2xl' : 'text-[11px] sm:text-lg lg:text-xl'
                                } font-bold ${style.textColor} leading-none`}>
                                  {sortBy === "revenue"
                                    ? formatCurrency(account.totalRevenue)
                                    : account.totalQuestions.toLocaleString()
                                  }
                                </p>
                                <p className={`text-[8px] sm:text-[10px] lg:text-[11px] text-gray-400 opacity-80 uppercase tracking-widest mt-1 sm:mt-1.5 font-medium leading-none`}>
                                  {sortBy === "revenue" ? "Faturamento" : "Perguntas"}
                                </p>
                              </div>
                            </div>

                            {/* Metrics Row - Compacto Mobile com padding inferior adequado */}
                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:gap-2.5 px-1 sm:px-2 pb-1 sm:pb-2">
                              <div className="text-center p-2 sm:p-2.5 lg:p-3 rounded-md sm:rounded-lg bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 group hover:border-white/10 transition-all">
                                <p className={`${
                                  isFirst ? 'text-[11px] sm:text-sm lg:text-base' : 'text-[10px] sm:text-xs lg:text-sm'
                                } font-semibold ${style.textColor} leading-none`}>
                                  {account.answeredQuestions || 0}
                                </p>
                                <p className="text-[7px] sm:text-[9px] lg:text-[10px] text-gray-400 uppercase tracking-wider font-medium leading-none mt-1.5 sm:mt-1">Resp</p>
                              </div>
                              <div className="text-center p-2 sm:p-2.5 lg:p-3 rounded-md sm:rounded-lg bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 group hover:border-white/10 transition-all">
                                <p className={`${
                                  isFirst ? 'text-[11px] sm:text-sm lg:text-base' : 'text-[10px] sm:text-xs lg:text-sm'
                                } font-semibold ${style.textColor} leading-none`}>
                                  {formatTime(account.avgResponseTime)}
                                </p>
                                <p className="text-[7px] sm:text-[9px] lg:text-[10px] text-gray-400 uppercase tracking-wider font-medium leading-none mt-1.5 sm:mt-1">Tempo</p>
                              </div>
                              <div className="text-center p-2 sm:p-2.5 lg:p-3 rounded-md sm:rounded-lg bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 group hover:border-white/10 transition-all">
                                <p className={`${
                                  isFirst ? 'text-[11px] sm:text-sm lg:text-base' : 'text-[10px] sm:text-xs lg:text-sm'
                                } font-semibold ${
                                  (account.realProfit || 0) > 0 ? 'text-green-400' : 'text-gray-400'
                                } leading-none`}>
                                  {formatCurrency(account.realProfit || 0)}
                                </p>
                                <p className="text-[7px] sm:text-[9px] lg:text-[10px] text-gray-400 uppercase tracking-wider font-medium leading-none mt-1.5 sm:mt-1">Lucro</p>
                              </div>
                            </div>

                          </div>
                        </motion.div>
                      ) : (
                        // Empty position - Modal Style
                        <div className="relative h-full rounded-2xl bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-2xl border border-white/5 overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-white/[0.02] opacity-50 pointer-events-none" />
                          <div className="flex flex-col items-center justify-center h-full gap-3 sm:gap-4 p-4 sm:p-5">
                            <div className={`${style.badgeSize} rounded-full bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 flex items-center justify-center`}>
                              <span className={`${style.fontSize} font-medium text-gray-600 leading-none`}>{style.position}</span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-gray-500 font-medium">Vazio</p>
                            {onAddAccount && (
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={onAddAccount}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 hover:border-gold/30 transition-all flex items-center justify-center group">
                                <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-gold/50 group-hover:text-gold transition-colors" />
                              </motion.button>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>

              {/* Other positions - Clean List */}
              {otherAccounts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Outras Posições
                    </h4>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent ml-4" />
                  </div>
                  <div className="grid gap-2">
                    {otherAccounts.map((account, index) => {
                      const position = index + 4

                      return (
                        <motion.div
                          key={account.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          whileHover={{ scale: 1.005 }}
                          className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-2xl border border-white/5 hover:border-gold/10 p-2 sm:p-3 overflow-hidden group transition-all duration-300">
                          {/* Subtle glow on hover */}
                          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none" />

                          <div className="relative flex items-center justify-between">
                            {/* Left side - Compact Mobile Optimized */}
                            <div className="flex items-center gap-2 sm:gap-3">
                              {/* Position */}
                              <div className="text-center min-w-[24px] sm:min-w-[32px]">
                                <span className="text-xs sm:text-sm font-black text-gray-600">
                                  {position}º
                                </span>
                              </div>

                              {/* Avatar + Name - Mobile Optimized */}
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                {account.thumbnail ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={account.thumbnail}
                                    alt={account.nickname}
                                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-white/10 object-cover"
                                  />
                                ) : (
                                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center">
                                    <User className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs sm:text-sm font-semibold text-gray-300 truncate max-w-[80px] sm:max-w-[120px]">
                                    {account.nickname}
                                  </p>
                                  <p className="text-[9px] sm:text-[10px] text-gray-500">
                                    {account.totalQuestions} perguntas
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Right side - Key Metrics Mobile Optimized */}
                            <div className="flex items-center gap-2 sm:gap-3">
                              {/* Main metric - Mobile Optimized */}
                              <div className="text-right">
                                <p className="text-xs sm:text-sm font-bold text-gold">
                                  {sortBy === "revenue"
                                    ? formatCurrency(account.totalRevenue)
                                    : `${account.totalQuestions}`
                                  }
                                </p>
                                <p className="text-[8px] sm:text-[9px] text-gray-500 hidden sm:block">
                                  {sortBy === "revenue" ? "receita" : "total"}
                                </p>
                              </div>

                              {/* Profit - Mobile Optimized */}
                              <div className="text-right min-w-[50px] sm:min-w-[60px] hidden sm:block">
                                <p className={`text-[10px] sm:text-xs font-semibold ${
                                  (account.realProfit || 0) > 0 ? 'text-green-400' : 'text-gray-500'
                                }`}>
                                  {formatCurrency(account.realProfit || 0)}
                                </p>
                                <p className="text-[8px] sm:text-[9px] text-gray-500">lucro</p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Add accounts - Minimal */}
              {accounts.length < 10 && onAddAccount && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 sm:mt-6 flex justify-center"
                >
                  <button
                    onClick={onAddAccount}
                    className="group flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-black/50 border border-white/5 hover:border-gold/20 transition-all">
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 group-hover:text-gold transition-colors" />
                    <span className="text-[10px] sm:text-xs text-gray-500 group-hover:text-gold transition-colors">
                      Adicionar Conta ({10 - accounts.length} vagas)
                    </span>
                  </button>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}