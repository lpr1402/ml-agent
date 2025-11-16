"use client"

/**
 * Componente de Métricas de ROI e Conversão
 * Visual premium consistente com Central de Performance
 * 🚀 ENTERPRISE: Memoizado para performance
 */

import { useEffect, useState, useCallback, memo } from "react"
import { motion } from "framer-motion"
import { TrendingUp, ShoppingCart, DollarSign, Target, Clock, BarChart3, Activity } from "lucide-react"

interface MetricsROIConversionProps {
  days?: number
  refreshInterval?: number
}

// 🚀 ENTERPRISE: Memoização para evitar re-renders desnecessários
export const MetricsROIConversion = memo(function MetricsROIConversion({
  days = 30,
  refreshInterval = 300000 // 🚀 OTIMIZAÇÃO: 5 minutos (dados do banco, não precisa atualizar tanto)
}: MetricsROIConversionProps) {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'all' | '30d' | '7d'>('all') // Default: ALL TIME

  const fetchMetrics = useCallback(async () => {
    try {
      // 🔴 ENTERPRISE: Usar nova API de ALL TIME
      const response = await fetch(`/api/agent/metrics-roi-alltime?period=${period}&includeTop=true&includeTrend=true&includeRecent=true`)

      if (!response.ok) {
        throw new Error('Failed to fetch metrics')
      }

      const data = await response.json()

      if (data.success) {
        setMetrics(data.data.metrics)
        setError(null)
      } else {
        throw new Error(data.message || 'Failed to load metrics')
      }
    } catch (err) {
      console.error('Error fetching ROI metrics:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchMetrics, refreshInterval])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}min`
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`
    return `${Math.round(minutes / 1440)}d`
  }

  const getPerformanceStatus = (rate: number) => {
    if (rate >= 8) return { emoji: '🔥', text: 'Excelente', color: 'text-green-400' }
    if (rate >= 5) return { emoji: '✅', text: 'Bom', color: 'text-gold' }
    if (rate >= 3) return { emoji: '⚠️', text: 'Regular', color: 'text-yellow-400' }
    return { emoji: '❌', text: 'Baixo', color: 'text-red-400' }
  }

  const getPeriodLabel = () => {
    if (period === 'all') return 'Todos os Tempos'
    if (period === '30d') return 'Últimos 30 dias'
    if (period === '7d') return 'Últimos 7 dias'
    return 'Todos os Tempos'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Activity className="h-8 w-8 text-gold animate-pulse" />
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-2xl p-6">
        <div className="text-center">
          <p className="text-gold text-lg font-semibold mb-2">Erro ao Carregar Métricas</p>
          <p className="text-gray-400 text-sm">{error || 'Dados não disponíveis'}</p>
        </div>
      </div>
    )
  }

  // Calculate metrics - ENTERPRISE COMPLETE
  const totalQuestions = metrics.totalQuestions || 0
  const questionsAnswered = metrics.questionsAnswered || 0
  const totalSales = metrics.totalSales || 0
  const totalRevenue = metrics.totalRevenue || 0
  const conversionRate = metrics.conversionRate || 0
  const avgRevenuePerQuestion = metrics.avgRevenuePerQuestion || 0
  const timeSaved = metrics.timeSaved || 0
  const timeSavedValue = metrics.timeSavedValue || 0
  const platformCost = metrics.platformCost || 0 // Usado para cálculos futuros
  const roiPercentage = metrics.roiPercentage || 0
  const accountsCount = metrics.accountsCount || 0

  // Suprimir warning: variável reservada para uso futuro em dashboards enterprise
  void days // Parâmetro mantido para compatibilidade API
  void platformCost // Métrica importante para ROI completo

  // Calculate answer rate
  const answerRate = totalQuestions > 0 ? (questionsAnswered / totalQuestions) * 100 : 0

  const performance = getPerformanceStatus(metrics.conversionRate)

  return (
    <div className="w-full">
      {/* Conversion Metrics Section - Mobile Optimized */}
      <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-2xl overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
          {/* Header - Mobile Optimized */}
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 lg:mb-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
            </div>
            <div className="flex-1">
              <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gold">
                ROI e Análise de Conversão
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">
                {getPeriodLabel()} • {accountsCount} conta{accountsCount !== 1 ? 's' : ''} ML
              </p>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2 bg-black/50 p-1 rounded-xl">
              {(['all', '30d', '7d'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 ${
                    period === p
                      ? 'bg-gradient-to-r from-gold to-gold-light text-black shadow-lg shadow-gold/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {p === 'all' ? 'Todos' : p === '30d' ? '30d' : '7d'}
                </button>
              ))}
            </div>
          </div>

          {/* Metrics Cards Grid - Mobile Optimized */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            {/* Total Sales Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-3 sm:p-4 lg:p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-gold/10 text-gold font-semibold">
                    VENDAS
                  </span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gold mb-1">
                  {totalSales}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">Vendas geradas</p>
                <div className="flex items-center gap-1 mt-1 sm:mt-2">
                  <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gold" />
                  <span className="text-[9px] sm:text-xs text-gray-400 truncate">
                    {questionsAnswered} perguntas respondidas
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Total Revenue Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-3 sm:p-4 lg:p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-gold/10 text-gold font-semibold">
                    RECEITA
                  </span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gold mb-1">
                  {formatCurrency(totalRevenue)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">Receita total</p>
                <div className="flex items-center gap-1 mt-1 sm:mt-2">
                  <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gold" />
                  <span className="text-[9px] sm:text-xs text-gray-400 truncate">
                    Atribuído ao Agent
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Conversion Rate Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-3 sm:p-4 lg:p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-gold/10 text-gold font-semibold">
                    CONVERSÃO
                  </span>
                </div>
                <p className={`text-xl sm:text-2xl lg:text-3xl font-bold mb-1 ${performance.color}`}>
                  {conversionRate.toFixed(1)}%
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">Taxa de conversão</p>
                <div className="flex items-center gap-1 mt-1 sm:mt-2">
                  <span className="text-xs">{performance.emoji}</span>
                  <span className="text-[9px] sm:text-xs text-gray-400">
                    {performance.text}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Avg Revenue per Question Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-3 sm:p-4 lg:p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-white/5 text-gray-400 font-semibold">
                    MÉDIA
                  </span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gold mb-1">
                  {formatCurrency(avgRevenuePerQuestion)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">Valor/Pergunta</p>
                <div className="flex items-center gap-1 mt-1 sm:mt-2">
                  <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gold" />
                  <span className="text-[9px] sm:text-xs text-gray-400 truncate">
                    Receita média
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Time to Conversion Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-3 sm:p-4 lg:p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-white/5 text-gray-400 font-semibold">
                    TEMPO
                  </span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gold mb-1">
                  {formatTime(metrics.avgTimeToConversion || 0)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">Até conversão</p>
                <div className="flex items-center gap-1 mt-1 sm:mt-2">
                  <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gold" />
                  <span className="text-[9px] sm:text-xs text-gray-400 truncate">
                    Pergunta → Venda
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Benchmark Info Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-3 sm:p-4 lg:p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-white/5 text-gray-400 font-semibold">
                    INFO
                  </span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gold mb-1">
                  5-12%
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">Benchmark médio</p>
                <div className="flex items-center gap-1 mt-1 sm:mt-2">
                  <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gold" />
                  <span className="text-[9px] sm:text-xs text-gray-400 truncate">
                    E-commerce padrão
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Performance Summary Footer */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Taxa de Resposta</p>
                <p className="text-lg font-bold text-gold">{answerRate.toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Tempo Economizado</p>
                <p className="text-lg font-bold text-gold">{timeSaved.toFixed(1)}h</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Valor Economizado</p>
                <p className="text-lg font-bold text-gold">{formatCurrency(timeSavedValue)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">ROI Real</p>
                <p className={`text-lg font-bold ${roiPercentage > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                  {roiPercentage > 0 ? '+' : ''}{roiPercentage.toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
