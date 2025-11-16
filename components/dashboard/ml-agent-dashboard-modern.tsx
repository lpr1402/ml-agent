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
  TrendingUp
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Activity className="h-8 w-8 text-gold animate-pulse" />
      </div>
    )
  }

  return (
    <div className="w-full space-y-4 sm:space-y-5 lg:space-y-6">
      {/* 🎯 CENTRAL DE PERFORMANCE - Premium Card */}
      <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5 shadow-xl overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

        <div className="relative z-10 p-4 sm:p-5 lg:p-6">
          {/* Header - Mobile Optimized */}
          <div className="flex items-center justify-between mb-4 sm:mb-5 lg:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gold">Central de Performance</h3>
                <p className="text-xs text-gray-500 hidden sm:block">Métricas em tempo real da organização</p>
              </div>
            </div>

            {/* Badge Histórico Completo */}
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-black/40 border border-gold/20">
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
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gold flex-shrink-0" />
                  <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
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
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gold flex-shrink-0" />
                  <div className="w-1 h-1 rounded-full bg-gold animate-pulse" />
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
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-yellow-500 flex-shrink-0" />
                  <div className="w-1 h-1 rounded-full bg-yellow-500 animate-pulse" />
                </div>
                <p className="text-lg sm:text-2xl lg:text-3xl font-black text-yellow-500 mb-0.5 sm:mb-1 leading-none">
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

          {/* 📊 GRÁFICO - Evolução Temporal Histórico Completo */}
          <div className="rounded-lg sm:rounded-xl bg-black/40 border border-white/5 p-3 sm:p-4 lg:p-5">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-gold flex-shrink-0" />
                <h4 className="text-xs sm:text-sm font-bold text-gold">Evolução Temporal - Histórico Completo</h4>
              </div>
              {metrics.chartLabels && metrics.chartLabels.length > 0 && (
                <span className="text-[10px] sm:text-xs text-gray-500 font-medium">
                  {metrics.chartLabels[0]} até hoje
                </span>
              )}
            </div>

            {/* Chart ou Empty State */}
            {metrics.chartData && metrics.chartData.length > 0 ? (
              <div className="h-40 sm:h-48 lg:h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={metrics.chartData.map((value, index) => ({
                      label: metrics.chartLabels?.[index] || `P${index + 1}`,
                      value: value
                    }))}
                    margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
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
                      style={{ fontSize: '9px', fill: '#999' }}
                      tick={{ fill: '#999' }}
                      height={25}
                    />
                    <YAxis
                      stroke="#666"
                      style={{ fontSize: '10px', fill: '#999' }}
                      tick={{ fill: '#999' }}
                      width={30}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'rgba(0, 0, 0, 0.95)',
                        border: '1px solid #D4AF37',
                        borderRadius: '8px',
                        padding: '8px 12px'
                      }}
                      labelStyle={{ color: '#D4AF37', fontWeight: 'bold', fontSize: '11px' }}
                      itemStyle={{ color: '#FFF', fontSize: '13px' }}
                      formatter={(value) => [`${value} perguntas`, '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#D4AF37"
                      strokeWidth={2}
                      fill="url(#colorGoldPremium)"
                      animationDuration={750}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 sm:h-48 lg:h-56 w-full flex flex-col items-center justify-center text-center px-4">
                <BarChart3 className="w-12 h-12 sm:w-16 sm:h-16 text-gray-700 mb-3 opacity-50" />
                <p className="text-sm sm:text-base text-gray-400 font-medium mb-1">
                  Aguardando dados históricos
                </p>
                <p className="text-xs sm:text-sm text-gray-600">
                  Responda perguntas para ver o gráfico de evolução
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🔥 BREAKDOWN POR CONTA - Premium com Avatares */}
      {metrics.accountsMetrics.length > 0 && (
        <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-xl border border-white/5 shadow-xl overflow-hidden">
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

          <div className="relative z-10 p-4 sm:p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-5">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-gold flex-shrink-0" />
              <h4 className="text-sm sm:text-base font-bold text-gold">
                Breakdown por Conta ({metrics.accountsMetrics.length} {metrics.accountsMetrics.length === 1 ? 'conta' : 'contas'})
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {metrics.accountsMetrics.map((account) => {
                const accountImage = getValidAvatarUrl(account.thumbnail)

                return (
                  <motion.div
                    key={account.accountId}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/5 p-3 sm:p-4 overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="relative z-10">
                      {/* Header com Avatar */}
                      <div className="flex items-center gap-2.5 mb-3">
                        <Avatar className="h-9 w-9 sm:h-10 sm:w-10 ring-2 ring-gold/20">
                          {accountImage ? (
                            <AvatarImage
                              src={accountImage}
                              alt={account.nickname}
                              className="object-cover"
                            />
                          ) : (
                            <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-900">
                              <User className="h-4 w-4 sm:h-5 sm:w-5 text-gold" />
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm sm:text-base font-bold text-white truncate">
                            {account.nickname}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500">
                            {account.totalAnswered} respondidas
                          </p>
                        </div>
                      </div>

                      {/* Métricas em Grid Compacto */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Perguntas */}
                        <div className="bg-gradient-to-br from-gold/10 to-yellow-500/10 border border-gold/20 rounded-lg p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <MessageSquare className="w-3 h-3 text-gold" />
                            <span className="text-[9px] sm:text-[10px] text-gold/70 font-medium">Perguntas</span>
                          </div>
                          <p className="text-base sm:text-lg font-bold text-gold leading-none">
                            {account.totalAnswered}
                          </p>
                        </div>

                        {/* Taxa de Automação */}
                        <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-lg p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Zap className="w-3 h-3 text-emerald-400" />
                            <span className="text-[9px] sm:text-[10px] text-emerald-400/70 font-medium">Auto</span>
                          </div>
                          <p className="text-base sm:text-lg font-bold text-emerald-400 leading-none">
                            {account.successRate}%
                          </p>
                        </div>

                        {/* Proc IA */}
                        <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 rounded-lg p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Activity className="w-3 h-3 text-purple-400" />
                            <span className="text-[9px] sm:text-[10px] text-purple-400/70 font-medium">Proc IA</span>
                          </div>
                          <p className="text-base sm:text-lg font-bold text-purple-400 leading-none">
                            {formatProcessingTime(account.avgProcessingTime)}
                          </p>
                        </div>

                        {/* Tempo Resp */}
                        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Clock className="w-3 h-3 text-blue-400" />
                            <span className="text-[9px] sm:text-[10px] text-blue-400/70 font-medium">T Resp</span>
                          </div>
                          <p className="text-base sm:text-lg font-bold text-blue-400 leading-none">
                            {formatTime(account.avgResponseTime)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
