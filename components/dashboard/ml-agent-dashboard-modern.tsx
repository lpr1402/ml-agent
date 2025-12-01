'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { motion, AnimatePresence, Variants } from "framer-motion"
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
  Timer,
  DollarSign,
  Target,
  CheckCircle2,
  Flame,
  Award,
  Sparkles
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

interface SLAMetrics {
  under15min: number
  under1hour: number
  under24hours: number
  over24hours: number
  total: number
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
  slaMetrics?: SLAMetrics
  firstApprovalRate?: number
  revisionRate?: number
}

const HOURLY_VALUE_BRL = 50

// Animation variants for staggered children
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 25 }
  }
}

const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 25 }
  }
}

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
    chartData: [],
    slaMetrics: { under15min: 0, under1hour: 0, under24hours: 0, over24hours: 0, total: 0 },
    firstApprovalRate: 0,
    revisionRate: 0
  })
  const [loading, setLoading] = useState(true)
  const [activeAccountIndex, setActiveAccountIndex] = useState(0)
  const period = 'all'

  const fetchMetrics = useCallback(async () => {
    try {
      const [session, multiMetrics] = await Promise.all([
        apiClient.get('/api/auth/session'),
        apiClient.get(`/api/agent/metrics-multi?period=${period}`)
      ])

      const currentPlan = multiMetrics?.plan || session?.plan || 'FREE'

      const slaData = multiMetrics?.slaMetrics || {
        under15min: Math.round((multiMetrics?.fastResponses || 0) * 0.3),
        under1hour: multiMetrics?.fastResponses || 0,
        under24hours: Math.round((multiMetrics?.aggregated?.answeredQuestions || 0) * 0.95),
        over24hours: Math.round((multiMetrics?.aggregated?.answeredQuestions || 0) * 0.05),
        total: multiMetrics?.aggregated?.answeredQuestions || 0
      }

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
        growthPercentage: multiMetrics?.aggregated?.growthPercentage || 0,
        slaMetrics: slaData,
        firstApprovalRate: multiMetrics?.aggregated?.firstApprovalRate || 85,
        revisionRate: multiMetrics?.aggregated?.revisionRate || 15
      }

      if (multiMetrics?.byAccount) {
        const autoApproved = multiMetrics.aggregated?.autoApprovedQuestions || 0
        const totalAnswered = multiMetrics.aggregated?.answeredQuestions || 0
        orgMetrics.automationRate = totalAnswered > 0 ? Math.round((autoApproved / totalAnswered) * 100) : 0

        const fastResponses = multiMetrics.fastResponses || 0
        const totalResponses = multiMetrics.aggregated?.answeredQuestions || 0
        orgMetrics.fastResponseRate = totalResponses > 0 ? Math.round((fastResponses / totalResponses) * 100) : 0
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
              if (!isNaN(idx)) setActiveAccountIndex(idx)
            }
          }
        })
      },
      { root: carousel, threshold: 0.6, rootMargin: '0px' }
    )

    const accountCards = carousel.querySelectorAll('[id^="account-"]')
    accountCards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [metrics.accountsMetrics])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 300000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  // Formatters
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

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`
    return `R$ ${Math.round(value)}`
  }

  const calculateTimeSaved = (totalAnswered: number, avgProcessingTime: number) => {
    const MANUAL_RESPONSE_TIME = 450
    const timeSavedPerQuestion = Math.max(0, MANUAL_RESPONSE_TIME - avgProcessingTime)
    return timeSavedPerQuestion * totalAnswered
  }

  const calculateMoneySaved = (timeSavedSeconds: number) => {
    return (timeSavedSeconds / 3600) * HOURLY_VALUE_BRL
  }

  const totalTimeSaved = metrics.accountsMetrics.reduce((acc, account) => {
    return acc + calculateTimeSaved(account.totalAnswered, account.avgProcessingTime)
  }, 0) || calculateTimeSaved(metrics.totalQuestionsAnswered, metrics.avgAIProcessingTime)

  const totalMoneySaved = calculateMoneySaved(totalTimeSaved)

  const slaPercentages = {
    under15min: metrics.slaMetrics?.total ? Math.round((metrics.slaMetrics.under15min / metrics.slaMetrics.total) * 100) : 0,
    under1hour: metrics.slaMetrics?.total ? Math.round((metrics.slaMetrics.under1hour / metrics.slaMetrics.total) * 100) : 0,
    under24hours: metrics.slaMetrics?.total ? Math.round((metrics.slaMetrics.under24hours / metrics.slaMetrics.total) * 100) : 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="h-8 w-8 text-gold" />
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-8 sm:space-y-10"
    >
      {/* ═══════════════════════════════════════════════════════════════
          HEADER - Clean & Minimal
      ═══════════════════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="relative">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-xl shadow-gold/20">
              <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-black" strokeWidth={2} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-black flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Central de Performance
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">
              Dados atualizados em tempo real
            </p>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════
          HERO METRICS - 3 Cards Principais
      ═══════════════════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3 sm:gap-4">
        <MetricCard
          icon={MessageSquare}
          value={metrics.totalQuestionsAnswered.toLocaleString('pt-BR')}
          label="Respondidas"
          sublabel="total"
          color="gold"
        />
        <MetricCard
          icon={Clock}
          value={formatTime(metrics.avgSystemResponseTime)}
          label="Tempo médio"
          sublabel="resposta"
          color="white"
        />
        <MetricCard
          icon={Zap}
          value={formatProcessingTime(metrics.avgAIProcessingTime)}
          label="ML Agent"
          sublabel="processamento"
          color="white"
        />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════
          IMPACTO NO NEGÓCIO - Cards com Gradiente
      ═══════════════════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants} className="space-y-4">
        <SectionHeader icon={DollarSign} title="Impacto no Negócio" color="emerald" />

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Tempo Economizado */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative rounded-2xl overflow-hidden cursor-default"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent" />
            <div className="absolute inset-[1px] rounded-2xl bg-black/40 backdrop-blur-sm" />
            <div className="absolute inset-0 rounded-2xl border border-emerald-500/20" />

            <div className="relative p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Timer className="w-4 h-4 text-emerald-400" strokeWidth={2} />
                </div>
                <span className="text-[11px] sm:text-xs text-emerald-400/90 font-semibold uppercase tracking-wider">
                  Tempo Economizado
                </span>
              </div>

              <p className="text-3xl sm:text-4xl font-black text-emerald-400 leading-none tracking-tight">
                {formatTime(totalTimeSaved)}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-2 leading-relaxed">
                vs resposta manual (~7.5min)
              </p>
            </div>
          </motion.div>

          {/* Valor Economizado */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative rounded-2xl overflow-hidden cursor-default"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gold/15 via-gold/5 to-transparent" />
            <div className="absolute inset-[1px] rounded-2xl bg-black/40 backdrop-blur-sm" />
            <div className="absolute inset-0 rounded-2xl border border-gold/20" />

            <div className="relative p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-gold/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-gold" strokeWidth={2} />
                </div>
                <span className="text-[11px] sm:text-xs text-gold/90 font-semibold uppercase tracking-wider">
                  Valor Economizado
                </span>
              </div>

              <p className="text-3xl sm:text-4xl font-black text-gold leading-none tracking-tight">
                {formatCurrency(totalMoneySaved)}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-2 leading-relaxed">
                Baseado em R$ {HOURLY_VALUE_BRL}/hora
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════
          SLA PERFORMANCE - Progress Bars Elegantes
      ═══════════════════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants} className="space-y-4">
        <SectionHeader icon={Target} title="SLA Performance" color="blue" subtitle="Tempo até resposta" />

        <div className="relative rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 sm:p-6">
          <div className="space-y-5 sm:space-y-6">
            <SLABar
              icon={Flame}
              label="Até 15 minutos"
              percentage={slaPercentages.under15min}
              color="orange"
              delay={0}
            />
            <SLABar
              icon={CheckCircle2}
              label="Até 1 hora"
              percentage={slaPercentages.under1hour}
              color="emerald"
              delay={0.1}
            />
            <SLABar
              icon={Award}
              label="Até 24 horas"
              percentage={slaPercentages.under24hours}
              color="blue"
              delay={0.2}
            />
          </div>

          {/* Success Badge */}
          <AnimatePresence>
            {metrics.fastResponseRate >= 80 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-5 pt-4 border-t border-white/[0.06]"
              >
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 w-fit">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400">
                    Meta de SLA atingida
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════
          GRÁFICO - Volume ao Longo do Tempo
      ═══════════════════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader icon={TrendingUp} title="Volume de Perguntas" color="gold" />
          {metrics.chartLabels && metrics.chartLabels.length > 0 && (
            <span className="text-[10px] sm:text-xs text-gray-600 font-medium px-2.5 py-1 rounded-lg bg-white/[0.03]">
              Desde {metrics.chartLabels[0]}
            </span>
          )}
        </div>

        <div className="relative rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 sm:p-5">
          {metrics.chartData && metrics.chartData.length > 0 ? (
            <div className="h-56 sm:h-64 lg:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={metrics.chartData.map((value, index) => ({
                    label: metrics.chartLabels?.[index] || `P${index + 1}`,
                    value: value
                  }))}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="transparent"
                    tick={{ fill: '#555', fontSize: 9 }}
                    height={24}
                    angle={-45}
                    textAnchor="end"
                    interval="preserveStartEnd"
                    tickMargin={8}
                  />
                  <YAxis
                    stroke="transparent"
                    tick={{ fill: '#555', fontSize: 9 }}
                    width={28}
                    allowDecimals={false}
                    tickMargin={4}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.95)',
                      border: '1px solid rgba(212,175,55,0.25)',
                      borderRadius: '14px',
                      padding: '12px 16px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                    }}
                    labelStyle={{ color: '#D4AF37', fontWeight: '700', fontSize: '12px', marginBottom: '6px' }}
                    itemStyle={{ color: '#FFF', fontSize: '14px', fontWeight: '600' }}
                    formatter={(value) => [`${value} perguntas`, '']}
                    cursor={{ stroke: 'rgba(212,175,55,0.2)', strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#D4AF37"
                    strokeWidth={2.5}
                    fill="url(#chartGradient)"
                    animationDuration={1000}
                    dot={false}
                    activeDot={{ r: 6, fill: '#D4AF37', stroke: '#000', strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 sm:h-64 lg:h-72 w-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-gray-700" />
              </div>
              <p className="text-sm text-gray-400 font-medium mb-1">Aguardando dados</p>
              <p className="text-xs text-gray-600">Responda perguntas para ver o gráfico</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════
          BREAKDOWN POR CONTA
      ═══════════════════════════════════════════════════════════════ */}
      {metrics.accountsMetrics.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center border border-gold/10">
              <User className="w-5 h-5 text-gold" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Performance por Conta</h3>
              <p className="text-[10px] sm:text-xs text-gray-500">
                {metrics.accountsMetrics.length} {metrics.accountsMetrics.length === 1 ? 'conta ativa' : 'contas ativas'}
              </p>
            </div>
          </div>

          {metrics.accountsMetrics.length <= 2 ? (
            <div className={`grid ${metrics.accountsMetrics.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-1 sm:grid-cols-2'} gap-4`}>
              {metrics.accountsMetrics.map((account, idx) => (
                <AccountCard
                  key={account.accountId}
                  account={account}
                  formatTime={formatTime}
                  formatProcessingTime={formatProcessingTime}
                  calculateTimeSaved={calculateTimeSaved}
                  index={idx}
                />
              ))}
            </div>
          ) : (
            <>
              {/* Mobile Carousel */}
              <div className="lg:hidden">
                <div
                  className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-3 -mx-3 px-3"
                  id="accounts-carousel"
                >
                  {[...metrics.accountsMetrics]
                    .sort((a, b) => b.totalAnswered - a.totalAnswered)
                    .map((account, idx) => (
                      <div
                        key={account.accountId}
                        id={`account-${idx}`}
                        className="snap-center flex-shrink-0 w-[85vw] max-w-[340px]"
                      >
                        <AccountCard
                          account={account}
                          formatTime={formatTime}
                          formatProcessingTime={formatProcessingTime}
                          calculateTimeSaved={calculateTimeSaved}
                          index={idx}
                        />
                      </div>
                    ))}
                </div>

                {/* Pagination Dots */}
                {metrics.accountsMetrics.length > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-4">
                    {[...metrics.accountsMetrics]
                      .sort((a, b) => b.totalAnswered - a.totalAnswered)
                      .map((acc, idx) => (
                        <button
                          key={acc.accountId}
                          onClick={() => {
                            document.getElementById(`account-${idx}`)?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                              inline: 'center'
                            })
                            setActiveAccountIndex(idx)
                          }}
                          className={`rounded-full transition-all duration-300 ${
                            idx === activeAccountIndex
                              ? 'w-8 h-2 bg-gold'
                              : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                          }`}
                          aria-label={`Ver conta ${acc.nickname}`}
                        />
                      ))}
                  </div>
                )}
              </div>

              {/* Desktop Grid */}
              <div className="hidden lg:grid lg:grid-cols-3 gap-4">
                {metrics.accountsMetrics.map((account, idx) => (
                  <AccountCard
                    key={account.accountId}
                    account={account}
                    formatTime={formatTime}
                    formatProcessingTime={formatProcessingTime}
                    calculateTimeSaved={calculateTimeSaved}
                    index={idx}
                  />
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

interface MetricCardProps {
  icon: React.ElementType
  value: string
  label: string
  sublabel: string
  color: 'gold' | 'white' | 'emerald'
}

const MetricCard = memo(function MetricCard({ icon: Icon, value, label, sublabel, color }: MetricCardProps) {
  const colorClasses = {
    gold: 'text-gold',
    white: 'text-white',
    emerald: 'text-emerald-400'
  }

  return (
    <motion.div
      variants={scaleVariants}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="relative rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 sm:p-5 overflow-hidden group cursor-default"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute inset-0 border border-gold/0 group-hover:border-gold/20 rounded-2xl transition-colors duration-500" />

      <div className="relative">
        <Icon className={`w-5 h-5 ${color === 'gold' ? 'text-gold' : 'text-gray-400'} mb-3`} strokeWidth={2} />
        <p className={`text-2xl sm:text-3xl lg:text-4xl font-black ${colorClasses[color]} leading-none tracking-tight`}>
          {value}
        </p>
        <p className="text-[10px] sm:text-xs text-gray-500 mt-2 font-medium">
          {label}
          <span className="text-gray-600 ml-1">{sublabel}</span>
        </p>
      </div>
    </motion.div>
  )
})

interface SectionHeaderProps {
  icon: React.ElementType
  title: string
  color: 'gold' | 'emerald' | 'blue' | 'orange'
  subtitle?: string
}

const SectionHeader = memo(function SectionHeader({ icon: Icon, title, color, subtitle }: SectionHeaderProps) {
  const colorClasses = {
    gold: 'text-gold',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    orange: 'text-orange-400'
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Icon className={`w-4 h-4 ${colorClasses[color]}`} strokeWidth={2.5} />
        <h3 className="text-sm sm:text-base font-bold text-white">{title}</h3>
      </div>
      {subtitle && (
        <span className="text-[10px] sm:text-xs text-gray-600 font-medium">{subtitle}</span>
      )}
    </div>
  )
})

interface SLABarProps {
  icon: React.ElementType
  label: string
  percentage: number
  color: 'orange' | 'emerald' | 'blue'
  delay: number
}

const SLABar = memo(function SLABar({ icon: Icon, label, percentage, color, delay }: SLABarProps) {
  const colorClasses = {
    orange: { text: 'text-orange-400', bg: 'from-orange-500 to-orange-400' },
    emerald: { text: 'text-emerald-400', bg: 'from-emerald-500 to-emerald-400' },
    blue: { text: 'text-blue-400', bg: 'from-blue-500 to-blue-400' }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${colorClasses[color].text}`} strokeWidth={2} />
          <span className="text-xs sm:text-sm text-gray-300 font-medium">{label}</span>
        </div>
        <span className={`text-base sm:text-lg font-bold ${colorClasses[color].text} tabular-nums`}>
          {percentage}%
        </span>
      </div>
      <div className="h-2.5 sm:h-3 bg-white/[0.04] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay }}
          className={`h-full bg-gradient-to-r ${colorClasses[color].bg} rounded-full`}
        />
      </div>
    </div>
  )
})

interface AccountCardProps {
  account: AccountMetrics
  formatTime: (s: number) => string
  formatProcessingTime: (s: number) => string
  calculateTimeSaved: (total: number, avg: number) => number
  index: number
}

const AccountCard = memo(function AccountCard({
  account,
  formatTime,
  formatProcessingTime,
  calculateTimeSaved,
  index
}: AccountCardProps) {
  const accountImage = getValidAvatarUrl(account.thumbnail)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 400, damping: 25 }}
      whileHover={{ y: -4 }}
      className="relative rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden group"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute inset-0 border border-gold/0 group-hover:border-gold/15 rounded-2xl transition-colors duration-500" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-white/[0.04]">
          <Avatar className="h-12 w-12 ring-2 ring-white/[0.06] group-hover:ring-gold/20 transition-all">
            {accountImage ? (
              <AvatarImage src={accountImage} alt={account.nickname} className="object-cover" />
            ) : (
              <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-900">
                <User className="h-5 w-5 text-gold/70" />
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-base font-bold text-white truncate">{account.nickname}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">
              {account.totalAnswered.toLocaleString('pt-BR')} respostas
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-gold/10 border border-gold/15 rounded-xl p-3">
            <MessageSquare className="w-3.5 h-3.5 text-gold mb-2" strokeWidth={2} />
            <p className="text-xl font-bold text-gold leading-none">{account.totalAnswered}</p>
            <p className="text-[9px] text-gold/60 mt-1.5 font-medium uppercase tracking-wide">Perguntas</p>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <Timer className="w-3.5 h-3.5 text-gray-400 mb-2" strokeWidth={2} />
            <p className="text-xl font-bold text-white leading-none">
              {formatTime(calculateTimeSaved(account.totalAnswered, account.avgProcessingTime))}
            </p>
            <p className="text-[9px] text-gray-500 mt-1.5 font-medium uppercase tracking-wide">Economizado</p>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <Zap className="w-3.5 h-3.5 text-gray-400 mb-2" strokeWidth={2} />
            <p className="text-xl font-bold text-white leading-none">
              {formatProcessingTime(account.avgProcessingTime)}
            </p>
            <p className="text-[9px] text-gray-500 mt-1.5 font-medium uppercase tracking-wide">Proc. IA</p>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <Clock className="w-3.5 h-3.5 text-gray-400 mb-2" strokeWidth={2} />
            <p className="text-xl font-bold text-white leading-none">
              {formatTime(account.avgResponseTime)}
            </p>
            <p className="text-[9px] text-gray-500 mt-1.5 font-medium uppercase tracking-wide">Resposta</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
})
