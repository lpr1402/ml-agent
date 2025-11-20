'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { motion } from "framer-motion"
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getValidAvatarUrl } from '@/lib/utils/avatar-utils'
import {
  MessageSquare,
  Clock,
  Zap,
  Activity,
  BarChart3,
  User,
  TrendingUp,
  Timer
} from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

interface AccountMetrics {
  accountId: string
  nickname: string
  thumbnail?: string
  totalAnswered: number
  avgResponseTime: number
  avgProcessingTime: number
  successRate: number
  totalSales?: number
  totalRevenue?: number
}

interface OrganizationMetrics {
  totalQuestionsAnswered: number
  avgSystemResponseTime: number
  avgAIProcessingTime: number
  accountsMetrics: AccountMetrics[]
  organizationPlan: 'FREE' | 'PRO'
  accountsLimit: number
  accountsActive: number
  automationRate: number
  totalQuestionsToday: number
  fastResponseRate: number
  conversionBoost: number
  previousPeriodAnswered?: number
  growthPercentage?: number
  responseTimeStatus?: string
  aiProcessingStatus?: string
  salesConversionRate?: number
  totalRevenue?: number
  projectedSales?: number
  chartData?: number[]
  chartLabels?: string[]
}

// 🚀 ENTERPRISE: Memoização para evitar re-renders desnecessários
export const MLAgentDashboardModern = memo(function MLAgentDashboardModern() {
  const [metrics, setMetrics] = useState<OrganizationMetrics>({
    totalQuestionsAnswered: 0,
    avgSystemResponseTime: 0,
    avgAIProcessingTime: 0,
    accountsMetrics: [],
    organizationPlan: 'FREE',
    accountsLimit: 1,
    accountsActive: 0,
    automationRate: 0,
    totalQuestionsToday: 0,
    fastResponseRate: 0,
    conversionBoost: 0,
    chartData: []
  })
  const [loading, setLoading] = useState(true)
  const [activeAccountIndex, setActiveAccountIndex] = useState(0)
  // Período FIXO em 'all' - Histórico completo desde criação da organização
  const period = 'all'

  const fetchMetrics = useCallback(async () => {
    try {
      const [session, multiMetrics] = await Promise.all([
        apiClient.get('/api/auth/session'),
        apiClient.get(`/api/agent/metrics-multi?period=${period}`)
      ])

      const currentPlan = multiMetrics?.plan || session?.plan || 'FREE'

      const orgMetrics: OrganizationMetrics = {
        totalQuestionsAnswered: multiMetrics?.aggregated?.answeredQuestions || 0,
        avgSystemResponseTime: Math.round(multiMetrics?.aggregated?.avgResponseTime || 0),
        avgAIProcessingTime: Math.round(multiMetrics?.aggregated?.avgProcessingTime || 0),
        accountsMetrics: [],
        organizationPlan: currentPlan,
        accountsLimit: currentPlan === 'PRO' ? 10 : 1,
        accountsActive: session?.accountCount || 1,
        automationRate: 0,
        totalQuestionsToday: multiMetrics?.aggregated?.questionsToday || 0,
        fastResponseRate: 0,
        conversionBoost: 0,
        responseTimeStatus: multiMetrics?.aggregated?.responseTimeStatus || 'Calculando...',
        aiProcessingStatus: multiMetrics?.aggregated?.aiProcessingStatus || 'Calculando...',
        salesConversionRate: multiMetrics?.aggregated?.salesConversionRate || 0,
        totalRevenue: multiMetrics?.aggregated?.totalRevenue || 0,
        projectedSales: multiMetrics?.projectedSales || 0,
        chartData: multiMetrics?.chartData || [],
        chartLabels: multiMetrics?.chartLabels || [],
        previousPeriodAnswered: multiMetrics?.aggregated?.previousPeriodAnswered || 0,
        growthPercentage: multiMetrics?.aggregated?.growthPercentage || 0
      }

      if (multiMetrics?.byAccount) {
        // Calculate automation rate
        const autoApproved = multiMetrics.aggregated?.autoApprovedQuestions || 0
        const totalAnswered = multiMetrics.aggregated?.answeredQuestions || 0
        orgMetrics.automationRate = totalAnswered > 0 ? Math.round((autoApproved / totalAnswered) * 100) : 0

        // Calcular taxa de respostas rápidas (<1h) - AGREGADO DE TODAS AS CONTAS
        const fastResponses = multiMetrics.fastResponses || 0
        const totalResponses = multiMetrics.aggregated?.answeredQuestions || 0
        orgMetrics.fastResponseRate = totalResponses > 0 ? Math.round((fastResponses / totalResponses) * 100) : 0

        // Conversão boost agora vem do backend com cálculo real
        orgMetrics.conversionBoost = Math.round(multiMetrics.aggregated?.salesConversionRate || 0)

        orgMetrics.accountsMetrics = multiMetrics.byAccount.map((acc: any) => ({
          accountId: acc.accountId,
          nickname: acc.nickname,
          thumbnail: acc.thumbnail,
          totalAnswered: acc.answeredQuestions || 0,
          avgResponseTime: Math.round(acc.avgResponseTime || 0),
          avgProcessingTime: Math.round(acc.avgProcessingTime || 0),
          successRate: acc.autoApprovedCount && acc.answeredQuestions
            ? Math.round((acc.autoApprovedCount / acc.answeredQuestions) * 100)
            : 0,
          totalSales: acc.totalSales || 0,
          totalRevenue: acc.totalRevenue || 0
        }))
        orgMetrics.accountsActive = multiMetrics.byAccount.length
      }

      setMetrics(orgMetrics)
      setLoading(false)
    } catch (error) {
      logger.error('[Dashboard] Error fetching metrics:', { error: error instanceof Error ? error.message : 'Unknown' })
      setLoading(false)
    }
  }, [period])

  // IntersectionObserver para detectar conta visível no carousel
  useEffect(() => {
    const carousel = document.getElementById('accounts-carousel')
    if (!carousel) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const targetId = (entry.target as HTMLElement).id
            if (targetId && targetId.includes('-')) {
              const parts = targetId.split('-')
              const idx = parseInt(parts[1] || '0')
              if (!isNaN(idx)) {
                setActiveAccountIndex(idx)
              }
            }
          }
        })
      },
      {
        root: carousel,
        threshold: 0.6,
        rootMargin: '0px'
      }
    )

    // Observar todos os cards de conta
    const accountCards = carousel.querySelectorAll('[id^="account-"]')
    accountCards.forEach((card) => observer.observe(card))

    return () => observer.disconnect()
  }, [metrics.accountsMetrics])

  useEffect(() => {
    fetchMetrics()
    // 🚀 OTIMIZAÇÃO ENTERPRISE: Auto-refresh a cada 5 minutos (dados do banco)
    const interval = setInterval(fetchMetrics, 300000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  const formatTime = (seconds: number) => {
    if (!seconds || seconds === 0) return "0s"
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`
    return `${(seconds / 3600).toFixed(1)}h`
  }

  const formatProcessingTime = (seconds: number) => {
    if (!seconds || seconds === 0) return "--"
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`
    return `${Math.round(seconds / 3600)}h`
  }

  // Calcula tempo economizado: Vendedor levaria 5-10min (média 7.5min) para resposta manual vs ML Agent
  const calculateTimeSaved = (totalAnswered: number, avgProcessingTime: number) => {
    const MANUAL_RESPONSE_TIME = 450 // 7.5 minutos em segundos (média entre 5-10min para redigir resposta profissional completa)
    const timeSavedPerQuestion = Math.max(0, MANUAL_RESPONSE_TIME - avgProcessingTime)
    const totalTimeSaved = timeSavedPerQuestion * totalAnswered
    return totalTimeSaved
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Activity className="h-8 w-8 text-gold animate-pulse" />
      </div>
    )
  }

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      {/* Header Section - Matching Central de Atendimento Style */}
      <div className="flex items-center sm:items-start justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-lg shadow-gold/20">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-black" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gold tracking-tight">
              Central de Performance
            </h3>
            <p className="text-xs text-gray-400 hidden sm:block lg:text-sm mt-0.5">
              Métricas em tempo real da organização
            </p>
          </div>
        </div>

        {/* Badge Histórico Completo */}
        <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-black/40 border border-gold/20 flex-shrink-0">
          <BarChart3 className="w-3.5 h-3.5 text-gold" />
          <span className="text-[10px] sm:text-xs font-bold text-gold hidden sm:inline">Histórico Completo</span>
          <span className="text-[10px] sm:text-xs font-bold text-gold sm:hidden">Total</span>
        </div>
      </div>

      {/* 🔥 MAIN METRICS - 3 Cards em Linha (Mobile-First) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-5 lg:mb-6">
        {/* 1️⃣ Total de Perguntas Respondidas */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/5 p-2.5 sm:p-4 overflow-hidden group"
        >
          {/* Hover Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative z-10">
            <div className="flex items-center mb-1.5 sm:mb-2">
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gold flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl lg:text-3xl font-black text-gold mb-0.5 sm:mb-1 leading-none">
              {metrics.totalQuestionsAnswered.toLocaleString('pt-BR')}
            </p>
            <p className="text-[8px] sm:text-[10px] lg:text-xs text-gray-400 font-medium leading-tight">
              Perguntas<br className="sm:hidden"/>
              <span className="hidden sm:inline"> respondidas</span>
            </p>
          </div>
        </motion.div>

        {/* 2️⃣ Tempo Médio de Resposta dos Vendedores */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/5 p-2.5 sm:p-4 overflow-hidden group"
        >
          {/* Hover Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative z-10">
            <div className="flex items-center mb-1.5 sm:mb-2">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gold flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl lg:text-3xl font-black text-gold mb-0.5 sm:mb-1 leading-none">
              {formatTime(metrics.avgSystemResponseTime)}
            </p>
            <p className="text-[8px] sm:text-[10px] lg:text-xs text-gray-400 font-medium leading-tight">
              Tempo médio<br className="sm:hidden"/>
              <span className="hidden sm:inline"> vendedores</span>
            </p>
            <p className="text-[7px] sm:text-[9px] text-gray-600 mt-0.5 sm:mt-1 leading-none">
              {metrics.responseTimeStatus}
            </p>
          </div>
        </motion.div>

        {/* 3️⃣ Processamento ML Agent (Últimas 10) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/5 p-2.5 sm:p-4 overflow-hidden group"
        >
          {/* Hover Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative z-10">
            <div className="flex items-center mb-1.5 sm:mb-2">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gold flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl lg:text-3xl font-black text-gold mb-0.5 sm:mb-1 leading-none">
              {formatProcessingTime(metrics.avgAIProcessingTime)}
            </p>
            <p className="text-[8px] sm:text-[10px] lg:text-xs text-gray-400 font-medium leading-tight">
              ML Agent<br className="sm:hidden"/>
              <span className="hidden sm:inline"> processamento</span>
            </p>
            <p className="text-[7px] sm:text-[9px] text-gray-600 mt-0.5 sm:mt-1 leading-none">
              Últimas 10 perguntas
            </p>
          </div>
        </motion.div>
      </div>

      {/* 📊 GRÁFICO - Volume de Perguntas */}
      <div className="rounded-lg sm:rounded-xl bg-black/40 border border-white/5 p-3 sm:p-4 lg:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-gold flex-shrink-0" />
            <h4 className="text-xs sm:text-sm lg:text-base font-bold text-gold">Volume de Perguntas</h4>
          </div>
          {metrics.chartLabels && metrics.chartLabels.length > 0 && (
            <span className="text-[9px] sm:text-[10px] lg:text-xs text-gray-500 font-medium">
              Desde {metrics.chartLabels[0]}
            </span>
          )}
        </div>

        {/* Chart ou Empty State */}
        {metrics.chartData && metrics.chartData.length > 0 ? (
          <div className="h-48 sm:h-56 md:h-64 lg:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={metrics.chartData.map((value, index) => ({
                  label: metrics.chartLabels?.[index] || `P${index + 1}`,
                  value: value
                }))}
                margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorGoldPremium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#666"
                  style={{ fontSize: '10px', fill: '#999' }}
                  tick={{ fill: '#999' }}
                  height={28}
                  angle={-45}
                  textAnchor="end"
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#666"
                  style={{ fontSize: '11px', fill: '#999' }}
                  tick={{ fill: '#999' }}
                  width={35}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.95)',
                    border: '1px solid #D4AF37',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    backdropFilter: 'blur(8px)'
                  }}
                  labelStyle={{ color: '#D4AF37', fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}
                  itemStyle={{ color: '#FFF', fontSize: '14px', fontWeight: '600' }}
                  formatter={(value) => [`${value} perguntas`, '']}
                  cursor={{ stroke: '#D4AF37', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#D4AF37"
                  strokeWidth={2.5}
                  fill="url(#colorGoldPremium)"
                  animationDuration={750}
                  dot={{ fill: '#D4AF37', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: '#D4AF37', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 sm:h-56 md:h-64 lg:h-72 w-full flex flex-col items-center justify-center text-center px-4">
            <BarChart3 className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 text-gray-700 mb-3 opacity-50" />
            <p className="text-sm sm:text-base text-gray-400 font-medium mb-1">
              Aguardando dados históricos
            </p>
            <p className="text-xs sm:text-sm text-gray-600">
              Responda perguntas para ver o volume de atendimento
            </p>
          </div>
        )}
      </div>

      {/* 🔥 BREAKDOWN POR CONTA - Direct Content */}
      {metrics.accountsMetrics.length > 0 && (
        <div className="space-y-5 sm:space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-lg shadow-gold/20">
              <User className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="text-sm sm:text-base lg:text-lg font-bold text-gold tracking-tight">
                Breakdown por Conta
              </h4>
              <p className="text-xs text-gray-400 lg:text-sm mt-0.5">
                {metrics.accountsMetrics.length} {metrics.accountsMetrics.length === 1 ? 'conta ativa' : 'contas ativas'}
              </p>
            </div>
          </div>

          {/* Layout Dinâmico: 1-2 contas = maior | 3+ contas = grid 3 colunas */}
          {metrics.accountsMetrics.length <= 2 ? (
            /* 1-2 Contas: Grid maior e mais espaçado */
            <div className={`grid ${metrics.accountsMetrics.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 sm:grid-cols-2'} gap-3 sm:gap-4 lg:gap-5`}>
              {metrics.accountsMetrics.map((account) => {
                const accountImage = getValidAvatarUrl(account.thumbnail)

                return (
                  <motion.div
                    key={account.accountId}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/5 p-4 sm:p-5 lg:p-6 overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="relative z-10">
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
                            {account.totalAnswered} {account.totalAnswered === 1 ? 'resposta' : 'respostas'}
                          </p>
                        </div>
                      </div>

                      {/* Métricas - Grid 2x2 Maiores */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div className="bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20 rounded-lg sm:rounded-xl p-3 sm:p-4">
                          <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-gold flex-shrink-0" />
                            <span className="text-xs sm:text-sm text-gold/70 font-medium">Perguntas</span>
                          </div>
                          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gold leading-none">
                            {account.totalAnswered}
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4">
                          <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                            <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300 flex-shrink-0" />
                            <span className="text-xs sm:text-sm text-gray-400 font-medium">Economizado</span>
                          </div>
                          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-none">
                            {formatTime(calculateTimeSaved(account.totalAnswered, account.avgProcessingTime))}
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4">
                          <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300 flex-shrink-0" />
                            <span className="text-xs sm:text-sm text-gray-400 font-medium">Proc. IA</span>
                          </div>
                          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-none">
                            {formatProcessingTime(account.avgProcessingTime)}
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4">
                          <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300 flex-shrink-0" />
                            <span className="text-xs sm:text-sm text-gray-400 font-medium">Resposta</span>
                          </div>
                          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-none">
                            {formatTime(account.avgResponseTime)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            /* 3+ Contas: Mobile 1 por vez | Desktop Grid */
            <div>
              {/* Mobile: Carousel horizontal swipe */}
              <div className="lg:hidden">
                <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-3 -mx-4 px-4" id="accounts-carousel">
                  {[...metrics.accountsMetrics]
                    .sort((a, b) => b.totalAnswered - a.totalAnswered) // Ordenar por mais perguntas primeiro
                    .map((account, idx) => {
                    const accountImage = getValidAvatarUrl(account.thumbnail)

                    return (
                      <div
                        key={account.accountId}
                        id={`account-${idx}`}
                        className="snap-center flex-shrink-0 w-[calc(100vw-2rem)]"
                      >
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative rounded-xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] overflow-hidden shadow-lg"
                        >
                          {/* Glow effect */}
                          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-40" />

                          <div className="relative z-10 p-4">
                            {/* Header com Avatar - Compacto */}
                            <div className="flex items-center gap-2.5 mb-3">
                              <Avatar className="h-9 w-9 ring-2 ring-gold/30 flex-shrink-0">
                                {accountImage ? (
                                  <AvatarImage
                                    src={accountImage}
                                    alt={account.nickname}
                                    className="object-cover"
                                  />
                                ) : (
                                  <AvatarFallback className="bg-gradient-to-br from-gold/20 to-gold/10">
                                    <User className="h-4.5 w-4.5 text-gold" />
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">
                                  {account.nickname}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {account.totalAnswered} respostas
                                </p>
                              </div>
                            </div>

                            {/* Métricas Grid 2x2 - Compacto e Clean */}
                            <div className="grid grid-cols-2 gap-2">
                              {/* Perguntas */}
                              <div className="bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20 rounded-lg p-2.5">
                                <div className="flex items-center gap-1 mb-1">
                                  <MessageSquare className="w-3 h-3 text-gold flex-shrink-0" strokeWidth={2.5} />
                                  <span className="text-[9px] text-gold/70 font-semibold">Perguntas</span>
                                </div>
                                <p className="text-lg font-bold text-gold leading-none">
                                  {account.totalAnswered}
                                </p>
                              </div>

                              {/* Tempo */}
                              <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] rounded-lg p-2.5">
                                <div className="flex items-center gap-1 mb-1">
                                  <Timer className="w-3 h-3 text-gray-300 flex-shrink-0" strokeWidth={2.5} />
                                  <span className="text-[9px] text-gray-400 font-semibold">Economizado</span>
                                </div>
                                <p className="text-lg font-bold text-white leading-none">
                                  {formatTime(calculateTimeSaved(account.totalAnswered, account.avgProcessingTime))}
                                </p>
                              </div>

                              {/* Proc IA */}
                              <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] rounded-lg p-2.5">
                                <div className="flex items-center gap-1 mb-1">
                                  <Activity className="w-3 h-3 text-gray-300 flex-shrink-0" strokeWidth={2.5} />
                                  <span className="text-[9px] text-gray-400 font-semibold">Proc. IA</span>
                                </div>
                                <p className="text-lg font-bold text-white leading-none">
                                  {formatProcessingTime(account.avgProcessingTime)}
                                </p>
                              </div>

                              {/* Resposta */}
                              <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] rounded-lg p-2.5">
                                <div className="flex items-center gap-1 mb-1">
                                  <Clock className="w-3 h-3 text-gray-300 flex-shrink-0" strokeWidth={2.5} />
                                  <span className="text-[9px] text-gray-400 font-semibold">Resposta</span>
                                </div>
                                <p className="text-lg font-bold text-white leading-none">
                                  {formatTime(account.avgResponseTime)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    )
                  })}
                </div>

                {/* Navigation dots - Premium com gradiente dourado */}
                {[...metrics.accountsMetrics]
                  .sort((a, b) => b.totalAnswered - a.totalAnswered).length > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-3">
                    {[...metrics.accountsMetrics]
                      .sort((a, b) => b.totalAnswered - a.totalAnswered)
                      .map((acc, dotIdx) => (
                      <button
                        key={acc.accountId}
                        onClick={() => {
                          const element = document.getElementById(`account-${dotIdx}`)
                          element?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
                          setActiveAccountIndex(dotIdx)
                        }}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          dotIdx === activeAccountIndex
                            ? 'w-8 bg-gradient-to-r from-gold via-gold-light to-gold shadow-lg shadow-gold/40'
                            : 'w-1.5 bg-white/20 hover:bg-white/40 active:scale-110'
                        }`}
                        aria-label={`Ver conta ${acc.nickname}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop: Grid 3 colunas - Clean & Minimalista */}
              <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 lg:gap-6 xl:gap-7">
                {metrics.accountsMetrics.map((account, index) => {
                  const accountImage = getValidAvatarUrl(account.thumbnail)

                  return (
                    <motion.div
                      key={account.accountId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.4 }}
                      className="group relative"
                    >
                      {/* Card Container - Clean e minimalista */}
                      <div className="relative rounded-2xl bg-black/20 border border-white/[0.06] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-gold/20 hover:shadow-xl hover:shadow-gold/5">
                        {/* Subtle gradient overlay on hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.02] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Content */}
                        <div className="relative z-10 p-6 xl:p-7">
                          {/* Header - Avatar + Nome (Clean) */}
                          <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/[0.04]">
                            <Avatar className="h-14 w-14 xl:h-16 xl:w-16 ring-1 ring-white/[0.08] flex-shrink-0 transition-all duration-300 group-hover:ring-gold/30">
                              {accountImage ? (
                                <AvatarImage
                                  src={accountImage}
                                  alt={account.nickname}
                                  className="object-cover"
                                />
                              ) : (
                                <AvatarFallback className="bg-gradient-to-br from-gray-800/50 to-gray-900/50">
                                  <User className="h-7 w-7 xl:h-8 xl:w-8 text-gold/70" strokeWidth={1.5} />
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <h3 className="text-base xl:text-lg font-semibold text-white/95 truncate mb-1.5 tracking-tight">
                                {account.nickname}
                              </h3>
                              <p className="text-xs xl:text-sm text-gray-500 font-medium">
                                {account.totalAnswered.toLocaleString('pt-BR')} {account.totalAnswered === 1 ? 'pergunta' : 'perguntas'}
                              </p>
                            </div>
                          </div>

                          {/* Métricas - Clean Stack Layout */}
                          <div className="space-y-4">
                            {/* Métrica Principal - Perguntas Respondidas (Destaque) */}
                            <div className="relative rounded-xl bg-gradient-to-r from-gold/[0.08] to-gold/[0.04] border border-gold/10 p-4 xl:p-5 transition-all duration-300 hover:border-gold/20 hover:shadow-md hover:shadow-gold/10">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] xl:text-xs uppercase tracking-wider font-bold text-gold/60">
                                  Total Respondido
                                </span>
                                <MessageSquare className="w-4 h-4 xl:w-4.5 xl:h-4.5 text-gold/50" strokeWidth={2} />
                              </div>
                              <p className="text-3xl xl:text-4xl font-bold text-gold tracking-tight">
                                {account.totalAnswered.toLocaleString('pt-BR')}
                              </p>
                            </div>

                            {/* Métricas Secundárias - Grid Horizontal Clean */}
                            <div className="grid grid-cols-3 gap-3 xl:gap-3.5">
                              {/* Tempo Economizado */}
                              <div className="relative rounded-lg bg-white/[0.02] border border-white/[0.04] p-3 xl:p-3.5 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.08]">
                                <Timer className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-gray-400/80 mb-2" strokeWidth={2} />
                                <p className="text-sm xl:text-base font-bold text-white/90 leading-none mb-1">
                                  {formatTime(calculateTimeSaved(account.totalAnswered, account.avgProcessingTime))}
                                </p>
                                <p className="text-[9px] xl:text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                                  Economizado
                                </p>
                              </div>

                              {/* Proc. IA */}
                              <div className="relative rounded-lg bg-white/[0.02] border border-white/[0.04] p-3 xl:p-3.5 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.08]">
                                <Activity className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-gray-400/80 mb-2" strokeWidth={2} />
                                <p className="text-sm xl:text-base font-bold text-white/90 leading-none mb-1">
                                  {formatProcessingTime(account.avgProcessingTime)}
                                </p>
                                <p className="text-[9px] xl:text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                                  Proc. IA
                                </p>
                              </div>

                              {/* Resposta */}
                              <div className="relative rounded-lg bg-white/[0.02] border border-white/[0.04] p-3 xl:p-3.5 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.08]">
                                <Clock className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-gray-400/80 mb-2" strokeWidth={2} />
                                <p className="text-sm xl:text-base font-bold text-white/90 leading-none mb-1">
                                  {formatTime(account.avgResponseTime)}
                                </p>
                                <p className="text-[9px] xl:text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                                  Resposta
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
