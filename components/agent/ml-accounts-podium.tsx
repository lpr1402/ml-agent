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
          height: 380,
          badgeSize: "w-16 h-16",
          fontSize: "text-xl",
          avatarSize: "w-20 h-20",
          nameSize: "text-lg",
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
          height: 320,
          badgeSize: "w-14 h-14",
          fontSize: "text-lg",
          avatarSize: "w-16 h-16",
          nameSize: "text-base",
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
          height: 260,
          badgeSize: "w-12 h-12",
          fontSize: "text-base",
          avatarSize: "w-14 h-14",
          nameSize: "text-sm",
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
      {/* Container matching MetricsROIModern style */}
      <div className="relative rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-2xl overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

        <div className="relative z-10 p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
                <Trophy className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gold">
                  Ranking da Organização
                </h3>
                <p className="text-sm text-gray-400">
                  Performance em tempo real das contas
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-3 items-center">
              {/* Period selector */}
              <div className="flex gap-1 bg-black/50 p-1 rounded-xl">
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 ${
                        period === option.value
                          ? 'bg-gradient-to-r from-gold to-gold-light text-black shadow-lg shadow-gold/30'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{option.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Sort selector */}
              <div className="flex gap-1 bg-black/50 p-1 rounded-xl">
                {[
                  { value: "revenue" as const, label: "Faturamento", icon: DollarSign },
                  { value: "questions" as const, label: "Perguntas", icon: MessageSquare }
                ].map(option => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 ${
                        sortBy === option.value
                          ? 'bg-white/10 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{option.label}</span>
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
              {/* Podium Section - Premium Layout */}
              <div className="grid grid-cols-3 gap-4 mb-6 items-end">
                {podiumSlots.map((slot) => {
                  const { account, position, visualIndex } = slot
                  const style = getPodiumStyle(position)
                  const isFirst = position === 1
                  const isSecond = position === 2

                  // Use style height directly to ensure consistency
                  const containerStyle: React.CSSProperties = {
                    height: `${style.height}px`,
                    minHeight: `${style.height}px`,
                    maxHeight: `${style.height}px`,
                    position: 'relative',
                    display: 'block',
                    width: '100%'
                  }

                  return (
                    <motion.div
                      key={visualIndex}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: visualIndex * 0.1 }}
                      style={containerStyle as any}
                    >
                      {account ? (
                        // Premium Card - Modal Inspired Style
                        <motion.div
                          whileHover={{ scale: 1.01, y: -2 }}
                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          className={`relative h-full rounded-2xl bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-2xl border border-white/5 overflow-hidden group hover:border-${isFirst ? 'gold' : isSecond ? 'gray-400' : 'amber-600'}/20 transition-all duration-300`}
                        >
                          {/* Premium Background Glow */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${style.bgGlow} opacity-30 pointer-events-none`} />
                          {/* Position Badge - Premium Clean */}
                          <div className="absolute top-3 right-3 z-20">
                            <div className="relative">
                              <div className={`absolute inset-0 bg-${isFirst ? 'gold' : isSecond ? 'gray-400' : 'amber-600'}/20 blur-xl`} />
                              <div className={`relative ${style.badgeSize} rounded-full bg-gradient-to-br ${style.medalColor} shadow-lg flex items-center justify-center`}>
                                <span className={`${style.fontSize} font-bold ${style.badgeTextColor}`}>{style.position}</span>
                              </div>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="relative z-10 h-full flex flex-col p-4">
                            {/* Account Header - Ultra Clean with more top spacing */}
                            <div className="text-center mb-3 mt-8">
                              {/* Avatar - Clean Minimal Style */}
                              <div className="mb-3 flex justify-center">
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
                              <h4 className={`font-semibold text-white ${style.nameSize} truncate px-2`}>
                                {account.nickname}
                              </h4>
                            </div>

                            {/* Primary Metric - Modal Style */}
                            <div className="flex-1 flex flex-col justify-center mb-4 px-2">
                              <div className="p-3 rounded-lg bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5">
                                <p className={`${
                                  isFirst ? 'text-3xl' : isSecond ? 'text-2xl' : 'text-xl'
                                } font-bold ${style.textColor}`}>
                                  {sortBy === "revenue"
                                    ? formatCurrency(account.totalRevenue)
                                    : account.totalQuestions.toLocaleString()
                                  }
                                </p>
                                <p className={`text-[10px] text-gray-400 opacity-80 uppercase tracking-widest mt-1 font-medium`}>
                                  {sortBy === "revenue" ? "Faturamento" : "Perguntas"}
                                </p>
                              </div>
                            </div>

                            {/* Metrics Row - Modal Style Cards */}
                            <div className="grid grid-cols-3 gap-2 px-2">
                              <div className="text-center p-2 rounded-lg bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 group hover:border-white/10 transition-all">
                                <p className={`${
                                  isFirst ? 'text-base' : 'text-sm'
                                } font-semibold ${style.textColor}`}>
                                  {account.answeredQuestions || 0}
                                </p>
                                <p className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">Respostas</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 group hover:border-white/10 transition-all">
                                <p className={`${
                                  isFirst ? 'text-base' : 'text-sm'
                                } font-semibold ${style.textColor}`}>
                                  {formatTime(account.avgResponseTime)}
                                </p>
                                <p className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">Tempo de Resposta</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 group hover:border-white/10 transition-all">
                                <p className={`${
                                  isFirst ? 'text-base' : 'text-sm'
                                } font-semibold ${
                                  (account.realProfit || 0) > 0 ? 'text-green-400' : 'text-gray-400'
                                }`}>
                                  {formatCurrency(account.realProfit || 0)}
                                </p>
                                <p className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">Lucro</p>
                              </div>
                            </div>

                          </div>
                        </motion.div>
                      ) : (
                        // Empty position - Modal Style
                        <div className="relative h-full rounded-2xl bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-2xl border border-white/5 overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-white/[0.02] opacity-50 pointer-events-none" />
                          <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
                            <div className={`${style.badgeSize} rounded-full bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 flex items-center justify-center`}>
                              <span className={`${style.fontSize} font-medium text-gray-600`}>{style.position}</span>
                            </div>
                            <p className="text-[10px] text-gray-500 font-medium">Vazio</p>
                            {onAddAccount && (
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={onAddAccount}
                                className="w-8 h-8 rounded-lg bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 hover:border-gold/30 transition-all flex items-center justify-center group">
                                <Plus className="w-4 h-4 text-gold/50 group-hover:text-gold transition-colors" />
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
                          className="relative rounded-xl bg-gradient-to-br from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-2xl border border-white/5 hover:border-gold/10 p-3 overflow-hidden group transition-all duration-300">
                          {/* Subtle glow on hover */}
                          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none" />

                          <div className="relative flex items-center justify-between">
                            {/* Left side - Compact */}
                            <div className="flex items-center gap-3">
                              {/* Position */}
                              <div className="text-center min-w-[32px]">
                                <span className="text-sm font-black text-gray-600">
                                  {position}º
                                </span>
                              </div>

                              {/* Avatar + Name */}
                              <div className="flex items-center gap-2">
                                {account.thumbnail ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={account.thumbnail}
                                    alt={account.nickname}
                                    className="w-8 h-8 rounded-full border border-white/10 object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center">
                                    <User className="w-4 h-4 text-gray-600" />
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-semibold text-gray-300 truncate max-w-[120px]">
                                    {account.nickname}
                                  </p>
                                  <p className="text-[10px] text-gray-500">
                                    {account.totalQuestions} perguntas
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Right side - Key Metrics */}
                            <div className="flex items-center gap-3">
                              {/* Main metric */}
                              <div className="text-right">
                                <p className="text-sm font-bold text-gold">
                                  {sortBy === "revenue"
                                    ? formatCurrency(account.totalRevenue)
                                    : `${account.totalQuestions}`
                                  }
                                </p>
                                <p className="text-[9px] text-gray-500">
                                  {sortBy === "revenue" ? "receita" : "total"}
                                </p>
                              </div>

                              {/* Profit */}
                              <div className="text-right min-w-[60px]">
                                <p className={`text-xs font-semibold ${
                                  (account.realProfit || 0) > 0 ? 'text-green-400' : 'text-gray-500'
                                }`}>
                                  {formatCurrency(account.realProfit || 0)}
                                </p>
                                <p className="text-[9px] text-gray-500">lucro</p>
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
                  className="mt-6 flex justify-center"
                >
                  <button
                    onClick={onAddAccount}
                    className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-black/50 border border-white/5 hover:border-gold/20 transition-all">
                    <Plus className="w-4 h-4 text-gray-500 group-hover:text-gold transition-colors" />
                    <span className="text-xs text-gray-500 group-hover:text-gold transition-colors">
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