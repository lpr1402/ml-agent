"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  TrendingUp,
  DollarSign,
  Clock,
  Zap,
  Target,
  ArrowUp,
  CheckCircle,
  Activity,
  Timer,
  MessageSquare,
  AlertCircle,
  Award
} from "lucide-react"
import { Line } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js"

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface MetricsROIProps {
  accountId: string | null
  organizationId: string
}

export function MetricsROIModern({ accountId, organizationId }: MetricsROIProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<"24h" | "7d" | "30d">("7d")
  const [chartData, setChartData] = useState<number[]>([])
  const [metrics, setMetrics] = useState({
    totalQuestions: 0,
    answeredQuestions: 0,
    pendingQuestions: 0,
    autoApprovedCount: 0,
    manualApprovedCount: 0,
    revisedCount: 0,
    avgResponseTime: 0,
    avgApprovalTime: 0,
    conversionRate: 0,
    questionsData: {
      fastResponses: 0,
      avgTicketValue: 0,
      monthlyQuestions: 0
    },
    mlAgentCost: 0,
    plan: 'FREE' as 'FREE' | 'PRO'
  })

  const [animatedValues, setAnimatedValues] = useState({
    roi: 0,
    savedHours: 0,
    incrementalSales: 0,
    efficiency: 0
  })

  // Fetch metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {

        // Build URL with filters
        const params = new URLSearchParams()
        if (accountId) params.append('accountId', accountId)
        params.append('organizationId', organizationId)
        params.append('period', selectedPeriod)

        const response = await fetch(`/api/agent/metrics-multi?${params}`)
        const data = await response.json()

        if (data) {
          setMetrics({
            totalQuestions: data.totalQuestions || 0,
            answeredQuestions: data.answeredQuestions || 0,
            pendingQuestions: data.pendingQuestions || 0,
            autoApprovedCount: data.autoApprovedCount || 0,
            manualApprovedCount: data.manualApprovedCount || 0,
            revisedCount: data.revisedCount || 0,
            avgResponseTime: data.avgResponseTime || 0,
            avgApprovalTime: data.avgProcessingTime || 0, // Usando o tempo de processamento da IA correto
            conversionRate: data.conversionRate || 0,
            questionsData: {
              fastResponses: data.fastResponses || 0,
              avgTicketValue: data.avgTicketValue || 0,
              monthlyQuestions: data.monthlyQuestions || 0
            },
            mlAgentCost: data.mlAgentCost || 0,
            plan: data.plan || 'FREE'
          })

          // Set real chart data
          if (data.chartData) {
            setChartData(data.chartData)
          }
        }
      } catch (error) {
        console.error('Error fetching metrics:', error)
      }
    }

    fetchMetrics()
  }, [accountId, organizationId, selectedPeriod])

  // Calculate ROI metrics using dynamic values from API
  const ML_AGENT_COST = metrics.mlAgentCost // Dynamic cost based on plan
  const HOUR_VALUE = 30 // R$ 30/hour (average customer service hourly cost)
  const MINUTES_PER_QUESTION = 5 // Average time to answer a question manually

  // Use real monthly questions or calculate projection
  const realMonthlyQuestions = metrics.questionsData.monthlyQuestions > 0
    ? metrics.questionsData.monthlyQuestions
    : metrics.answeredQuestions * (30 / (selectedPeriod === "24h" ? 1 : selectedPeriod === "7d" ? 7 : 30))

  const savedHoursMonthly = (realMonthlyQuestions * MINUTES_PER_QUESTION) / 60
  const savedValue = savedHoursMonthly * HOUR_VALUE

  // Real incremental sales calculation based on ML documentation
  // Fast responses (<1h) increase conversion by 10%
  const incrementalSales = metrics.questionsData.fastResponses * metrics.questionsData.avgTicketValue * 0.1 * metrics.conversionRate
  const totalValue = savedValue + incrementalSales
  // Only calculate ROI if there's a cost (PRO plan), FREE plan shows only benefits
  const roi = ML_AGENT_COST > 0 ? ((totalValue - ML_AGENT_COST) / ML_AGENT_COST) * 100 : totalValue
  const efficiencyScore = Math.min(100, (metrics.autoApprovedCount / Math.max(metrics.totalQuestions, 1)) * 100)

  // Animate values
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValues({
        roi: roi,
        savedHours: savedHoursMonthly,
        incrementalSales: incrementalSales,
        efficiency: efficiencyScore
      })
    }, 100)
    return () => clearTimeout(timer)
  }, [roi, savedHoursMonthly, incrementalSales, efficiencyScore])

  // Chart data with real data
  const chartDataFormatted = {
    labels: selectedPeriod === "24h"
      ? Array.from({length: 24}, (_, i) => `${i}h`)
      : selectedPeriod === "7d"
      ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      : Array.from({length: 30}, (_, i) => i % 5 === 0 ? `${i+1}` : ''),
    datasets: [{
      label: "Perguntas",
      data: chartData.length > 0 ? chartData :
        (selectedPeriod === "24h" ? Array(24).fill(0) :
         selectedPeriod === "7d" ? Array(7).fill(0) :
         Array(30).fill(0)),
      fill: true,
      backgroundColor: "rgba(255, 230, 0, 0.1)",
      borderColor: "#FFE600",
      borderWidth: 2,
      tension: 0.4,
      pointBackgroundColor: "#FFE600",
      pointBorderColor: "#000",
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        titleColor: "#FFE600",
        bodyColor: "#FFF",
        borderColor: "#FFE600",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { color: "rgba(255, 255, 255, 0.05)" },
        ticks: { color: "#666" }
      },
      y: {
        grid: { color: "rgba(255, 255, 255, 0.05)" },
        ticks: { color: "#666" }
      }
    }
  }

  return (
    <div className="w-full">
      {/* ROI Section */}
      <div className="relative rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-2xl overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

        <div className="relative z-10 p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
                <TrendingUp className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gold">
                  ROI e Análise
                </h3>
                <p className="text-sm text-gray-400">
                  Métricas de Performance Operacional
                </p>
              </div>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2 bg-black/50 p-1 rounded-xl">
              {(["24h", "7d", "30d"] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    selectedPeriod === period
                      ? 'bg-gradient-to-r from-gold to-gold-light text-black shadow-lg shadow-gold/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {period === "24h" ? "Hoje" : period === "7d" ? "7 dias" : "30 dias"}
                </button>
              ))}
            </div>
          </div>

          {/* Main ROI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* ROI Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="w-5 h-5 text-gold" />
                  <span className="text-xs px-2 py-1 rounded-md bg-gold/10 text-gold font-semibold">
                    ROI
                  </span>
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-3xl font-bold mb-1 ${animatedValues.roi > 0 ? 'text-gold' : 'text-red-400'}`}
                >
                  {animatedValues.roi > 0 ? "+" : ""}{Math.round(animatedValues.roi)}%
                </motion.p>
                <p className="text-xs text-gray-500">Retorno sobre investimento</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUp className="w-3 h-3 text-gold" />
                  <span className="text-xs text-gray-400">
                    R$ {Math.max(0, Math.round(totalValue - ML_AGENT_COST))}/mês
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Hours Saved Card */}
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
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-bold text-gold mb-1"
                >
                  {Math.round(animatedValues.savedHours)}h
                </motion.p>
                <p className="text-xs text-gray-500">Horas economizadas</p>
                <div className="flex items-center gap-1 mt-2">
                  <CheckCircle className="w-3 h-3 text-gold" />
                  <span className="text-xs text-gray-400">
                    R$ {Math.round(savedValue)} economizado
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Conversion Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <Target className="w-5 h-5 text-gold" />
                  <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-400 font-semibold">
                    VENDAS
                  </span>
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-bold text-gold mb-1"
                >
                  {(metrics.conversionRate * 100).toFixed(1)}%
                </motion.p>
                <p className="text-xs text-gray-500">Taxa de conversão</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="w-3 h-3 text-gold" />
                  <span className="text-xs text-gray-400">
                    R$ {Math.round(incrementalSales)} extras
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Efficiency Card */}
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
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-bold text-gold mb-1"
                >
                  {Math.round(animatedValues.efficiency)}%
                </motion.p>
                <p className="text-xs text-gray-500">Eficiência da IA</p>
                <div className="flex items-center gap-1 mt-2">
                  <Award className="w-3 h-3 text-gold" />
                  <span className="text-xs text-gray-400">
                    Auto-aprovação
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Activity Chart */}
            <div className="lg:col-span-2 rounded-xl bg-black/50 border border-white/5 p-5">
              <h4 className="text-sm font-semibold text-gold mb-4">
                Atividade - {selectedPeriod === "24h" ? "Últimas 24h" : selectedPeriod === "7d" ? "Últimos 7 dias" : "Últimos 30 dias"}
              </h4>
              <div className="h-48">
                <Line data={chartDataFormatted} options={chartOptions} />
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-3">
              {[
                {
                  label: "Tempo IA",
                  value: (() => {
                    const time = metrics.avgApprovalTime
                    if (!time || time === 0) return "--"
                    if (time < 60) return `${Math.round(time)}s`
                    if (time < 3600) return `${Math.round(time / 60)}min`
                    return `${Math.round(time / 3600)}h`
                  })(),
                  icon: Activity,
                  color: "text-gold"
                },
                {
                  label: "Resposta Média",
                  value: `${Math.round(metrics.avgResponseTime)}min`,
                  icon: Timer,
                  color: metrics.avgResponseTime <= 60 ? "text-gold" : "text-gray-400"
                },
                {
                  label: "Total Perguntas",
                  value: metrics.totalQuestions > 0 ? metrics.totalQuestions.toLocaleString('pt-BR') : "0",
                  icon: MessageSquare,
                  color: "text-gold"
                },
                {
                  label: "Taxa Revisão",
                  value: metrics.totalQuestions > 0
                    ? `${Math.round((metrics.revisedCount / metrics.totalQuestions) * 100)}%`
                    : "0%",
                  icon: AlertCircle,
                  color: metrics.revisedCount / Math.max(metrics.totalQuestions, 1) < 0.1 ? "text-gold" : "text-gray-400"
                }
              ].map((stat, index) => {
                const Icon = stat.icon
                return (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.03 }}
                    className="rounded-lg bg-white/[0.02] border border-white/5 p-3 flex items-center gap-3"
                  >
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">{stat.label}</p>
                      <p className={`text-lg font-bold ${stat.color}`}>
                        {stat.value}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}