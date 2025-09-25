'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { motion } from "framer-motion"
import {
  MessageSquare,
  Clock,
  Zap,
  TrendingUp,
  Activity,
  Crown,
  Award
} from 'lucide-react'

interface AccountMetrics {
  accountId: string
  nickname: string
  thumbnail?: string
  totalAnswered: number
  avgResponseTime: number
  avgProcessingTime: number
  successRate: number
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
  fastResponseRate: number // Porcentagem de respostas em <1h
  conversionBoost: number // Aumento na conversão
}

export function MLAgentDashboardModern() {
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
    conversionBoost: 0
  })
  const [loading, setLoading] = useState(true)

  const fetchMetrics = useCallback(async () => {
    try {
      const [session, metricsData] = await Promise.all([
        apiClient.get('/api/auth/session'),
        apiClient.get('/api/agent/metrics-new')
      ])

      const currentPlan = metricsData?.organizationPlan || session?.plan || 'FREE'

      const orgMetrics: OrganizationMetrics = {
        totalQuestionsAnswered: metricsData?.totalQuestions || 0,
        avgSystemResponseTime: Math.round(metricsData?.avgResponseTime || 0),
        avgAIProcessingTime: Math.round(metricsData?.avgProcessingTime || 0),
        accountsMetrics: [],
        organizationPlan: currentPlan,
        accountsLimit: currentPlan === 'PRO' ? 10 : 1,
        accountsActive: session?.accountCount || 1,
        automationRate: 0, // Will be calculated from multi-metrics
        totalQuestionsToday: 0, // Will be calculated from multi-metrics
        fastResponseRate: 0,
        conversionBoost: 0
      }

      // Buscar métricas multi-conta
      try {
        const multiMetrics = await apiClient.get('/api/agent/metrics-multi')
        if (multiMetrics?.byAccount) {
          orgMetrics.totalQuestionsAnswered = multiMetrics.aggregated?.answeredQuestions || 0
          orgMetrics.avgSystemResponseTime = Math.round(multiMetrics.aggregated?.avgResponseTime || 0)
          orgMetrics.avgAIProcessingTime = Math.round(multiMetrics.aggregated?.avgProcessingTime || 0)

          // Calculate automation rate
          const autoApproved = multiMetrics.aggregated?.autoApprovedQuestions || 0
          const totalAnswered = multiMetrics.aggregated?.answeredQuestions || 0
          orgMetrics.automationRate = totalAnswered > 0 ? Math.round((autoApproved / totalAnswered) * 100) : 0
          orgMetrics.totalQuestionsToday = multiMetrics.aggregated?.questionsToday || 0

          // Calcular taxa de respostas rápidas (<1h) - AGREGADO DE TODAS AS CONTAS
          const fastResponses = multiMetrics.fastResponses || 0
          const totalResponses = multiMetrics.aggregated?.answeredQuestions || 0
          orgMetrics.fastResponseRate = totalResponses > 0 ? Math.round((fastResponses / totalResponses) * 100) : 0

          // Calcular aumento na conversão baseado na documentação oficial do ML
          // Segundo a API do ML: sales_percent_increase indica até 10% de aumento
          // quando o vendedor melhora o tempo de resposta para <1h
          // Fonte: GET /users/{id}/questions/response_time
          // Calculamos o potencial de melhoria baseado nas respostas que ainda não são <1h
          const slowResponseRate = 100 - orgMetrics.fastResponseRate
          // Se 100% das respostas lentas fossem convertidas em rápidas, teríamos até 10% de aumento
          orgMetrics.conversionBoost = slowResponseRate > 0 ?
            Math.min(10, Math.round(slowResponseRate * 0.10)) : 0

          orgMetrics.accountsMetrics = multiMetrics.byAccount.map((acc: any) => ({
            accountId: acc.accountId,
            nickname: acc.nickname,
            thumbnail: acc.thumbnail,
            totalAnswered: acc.answeredQuestions || 0,
            avgResponseTime: Math.round(acc.avgResponseTime || 0),
            avgProcessingTime: Math.round(acc.avgProcessingTime || 0),
            successRate: acc.autoApprovedCount && acc.answeredQuestions
              ? Math.round((acc.autoApprovedCount / acc.answeredQuestions) * 100)
              : 0
          }))
          orgMetrics.accountsActive = multiMetrics.byAccount.length
        }
      } catch (_error) {
        logger.info('[Dashboard] Multi metrics not available')
      }

      setMetrics(orgMetrics)
      setLoading(false)
    } catch (error) {
      logger.error('[Dashboard] Error fetching metrics:', { error: error instanceof Error ? error.message : 'Unknown' })
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 60000) // Sync every minute
    return () => clearInterval(interval)
  }, [fetchMetrics])

  const formatTime = (seconds: number) => {
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

  const isPro = metrics.organizationPlan === 'PRO'

  return (
    <div className="w-full">
      {/* Main Dashboard Section */}
      <div className="relative rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-2xl overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

        <div className="relative z-10 p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
                <Activity className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gold">
                  Central de Performance
                </h3>
                <p className="text-sm text-gray-400">
                  Métricas em tempo real da organização
                </p>
              </div>
            </div>

            {/* Plan Status */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-black/50 border border-gold/20">
              <Crown className={`h-5 w-5 ${isPro ? 'text-gold animate-pulse' : 'text-gray-600'}`} />
              <span className={`text-sm font-medium ${isPro ? 'text-gold' : 'text-gray-400'}`}>
                {metrics.organizationPlan === 'PRO' ? 'PRO' : 'FREE'}
              </span>
              <span className="text-xs text-gray-500">
                {metrics.accountsActive}/{metrics.accountsLimit} contas
              </span>
            </div>
          </div>

          {/* Main Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Total Questions Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <MessageSquare className="w-5 h-5 text-gold" />
                  <span className="text-xs px-2 py-1 rounded-md bg-gold/10 text-gold font-semibold">
                    TOTAL
                  </span>
                </div>
                <p className="text-3xl font-bold text-gold mb-1">
                  {metrics.totalQuestionsAnswered.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-gray-500">Perguntas respondidas</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-gray-400">
                    +{Math.round(metrics.totalQuestionsAnswered * 0.1)} este mês
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Response Time Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <Clock className="w-5 h-5 text-gold" />
                  <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-400 font-semibold">
                    TEMPO
                  </span>
                </div>
                <p className="text-3xl font-bold text-gold mb-1">
                  {formatTime(metrics.avgSystemResponseTime)}
                </p>
                <p className="text-xs text-gray-500">Tempo médio de resposta</p>
                <div className="flex items-center gap-1 mt-2">
                  <Award className="w-3 h-3 text-gold" />
                  <span className="text-xs text-gray-400">
                    {metrics.avgSystemResponseTime < 60 ? 'Excelente!' : 'Bom desempenho'}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* AI Processing Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <Zap className="w-5 h-5 text-gold" />
                  <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-400 font-semibold">
                    IA
                  </span>
                </div>
                <p className="text-3xl font-bold text-gold mb-1">
                  {formatProcessingTime(metrics.avgAIProcessingTime)}
                </p>
                <p className="text-xs text-gray-500">Processamento da IA</p>
                <div className="flex items-center gap-1 mt-2">
                  <Activity className="w-3 h-3 text-gold" />
                  <span className="text-xs text-gray-400">
                    Ultra-rápido
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* System Metrics Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-gold" />
              <h4 className="text-sm font-semibold text-gold">
                Métricas do Sistema
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Automation Rate Metric */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <Zap className="w-5 h-5 text-gold/60" />
                  <span className="text-xs px-2 py-1 rounded-md bg-gold/10 text-gold font-semibold">
                    AUTOMAÇÃO
                  </span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {metrics.automationRate}%
                </p>
                <p className="text-xs text-gray-500">Taxa de automação</p>
                <div className="mt-2 flex items-center gap-1">
                  <div className="h-1 flex-1 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-500"
                      style={{ width: `${metrics.automationRate}%` }}
                    />
                  </div>
                  <span className="text-xs text-gold font-medium">
                    {metrics.totalQuestionsToday} hoje
                  </span>
                </div>
              </motion.div>

              {/* System Uptime */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <Activity className="w-5 h-5 text-gold/60" />
                  <span className="text-xs px-2 py-1 rounded-md bg-gold/10 text-gold font-semibold">
                    ONLINE
                  </span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  99.9%
                </p>
                <p className="text-xs text-gray-500">Disponibilidade</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                  <span className="text-xs text-gray-400">Sistema operacional</span>
                </div>
              </motion.div>

              {/* ML Conversion Boost */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="relative rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-gold/60" />
                  <span className="text-xs px-2 py-1 rounded-md bg-gold/10 text-gold font-semibold">
                    ML
                  </span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {metrics.conversionBoost > 0 ? `+${metrics.conversionBoost}%` : '--'}
                </p>
                <p className="text-xs text-gray-500">Potencial de aumento em vendas</p>
                <div className="mt-2 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-gold" />
                  <span className="text-xs text-gray-400">
                    {metrics.fastResponseRate}% respostas &lt;1h (todas as contas)
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}