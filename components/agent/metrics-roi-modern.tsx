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
  Sparkles,
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
  const [metrics, setMetrics] = useState<any>({
    roi: { percentage: 0, netProfit: 0, currentPeriodCost: 0, daysSinceLastBilling: 0 },
    timeEconomy: { hoursEconomized: 0, monetaryValueSaved: 0, savingsPerResponse: 0 },
    aiPerformance: { efficiency: 0, autoApprovalRate: 0 },
    costAnalysis: { costPerResponse: 0 },
    aggregated: { avgProcessingTime: 0, avgResponseTime: 0, totalQuestions: 0 }
  })

  const [animatedValues, setAnimatedValues] = useState({
    roi: 0,
    savedHours: 0,
    efficiency: 0,
    autoApprovalRate: 0
  })

  // Fetch metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const params = new URLSearchParams()
        if (accountId) params.append('accountId', accountId)
        params.append('organizationId', organizationId)
        params.append('period', selectedPeriod)

        const response = await fetch(`/api/agent/metrics-multi?${params}`)
        const data = await response.json()

        if (data) {
          setMetrics(data)
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

  // Animate values
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValues({
        roi: metrics.roi?.percentage || 0,
        savedHours: metrics.timeEconomy?.hoursEconomized || 0,
        efficiency: metrics.aiPerformance?.efficiency || 0,
        autoApprovalRate: metrics.aiPerformance?.autoApprovalRate || 0
      })
    }, 100)
    return () => clearTimeout(timer)
  }, [metrics])

  // Chart data with real-time labels
  const getChartLabels = () => {
    const now = new Date()

    if (selectedPeriod === "24h") {
      // Show current hour and previous hours
      return Array.from({length: 24}, (_, i) => {
        const hour = (now.getHours() - (23 - i) + 24) % 24
        return `${hour}h`
      })
    } else if (selectedPeriod === "7d") {
      // Show last 7 days with day names
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      return Array.from({length: 7}, (_, i) => {
        const date = new Date(now)
        date.setDate(date.getDate() - (6 - i))
        return `${days[date.getDay()]} ${date.getDate()}`
      })
    } else {
      // Show last 30 days with dates
      return Array.from({length: 30}, (_, i) => {
        if (i % 5 === 0) {
          const date = new Date(now)
          date.setDate(date.getDate() - (29 - i))
          return `${date.getDate()}/${date.getMonth() + 1}`
        }
        return ''
      })
    }
  }

  const chartDataFormatted = {
    labels: getChartLabels(),
    datasets: [{
      label: selectedPeriod === "24h" ? "Perguntas por Hora" : "Perguntas por Dia",
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
      {/* ROI Section - Mobile Optimized */}
      <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-900/90 backdrop-blur-2xl border border-white/5 shadow-2xl overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5 opacity-30 pointer-events-none" />

        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
          {/* Header - Mobile Optimized */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6 lg:mb-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gold">
                  ROI e Análise
                </h3>
                <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">
                  Métricas de Performance Operacional
                </p>
              </div>
            </div>

            {/* Period Selector - Mobile Optimized */}
            <div className="flex gap-1 sm:gap-2 bg-black/50 p-1 rounded-lg sm:rounded-xl w-full sm:w-auto">
              {(["24h", "7d", "30d"] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`flex-1 sm:flex-none px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 ${
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

          {/* Main ROI Cards - Mobile Optimized - Production Ready */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6 lg:mb-8">
            {/* ROI Real Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-3 sm:p-4 lg:p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-gold/10 text-gold font-semibold">
                    ROI
                  </span>
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-xl sm:text-2xl lg:text-3xl font-bold mb-1 ${animatedValues.roi > 0 ? 'text-gold' : 'text-red-400'}`}
                >
                  {animatedValues.roi > 0 ? "+" : ""}{Math.round(animatedValues.roi)}%
                </motion.p>
                <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">Retorno Real</p>
                <div className="flex items-center gap-1 mt-1 sm:mt-2">
                  <ArrowUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gold" />
                  <span className="text-[9px] sm:text-xs text-gray-400 truncate">
                    R$ {Math.round(metrics.roi?.netProfit || 0)} lucro
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Hours Saved Card - Real */}
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
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl sm:text-2xl lg:text-3xl font-bold text-gold mb-1"
                >
                  {Math.round(animatedValues.savedHours)}h
                </motion.p>
                <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">Economizadas</p>
                <div className="flex items-center gap-1 mt-1 sm:mt-2">
                  <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gold" />
                  <span className="text-[9px] sm:text-xs text-gray-400 truncate">
                    R$ {Math.round(metrics.timeEconomy?.monetaryValueSaved || 0)}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* AI Efficiency Card - Real */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-3 sm:p-4 lg:p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-white/5 text-gray-400 font-semibold">
                    IA
                  </span>
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl sm:text-2xl lg:text-3xl font-bold text-gold mb-1"
                >
                  {Math.round(animatedValues.efficiency)}%
                </motion.p>
                <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">Eficiência</p>
                <div className="flex items-center gap-1 mt-1 sm:mt-2">
                  <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gold" />
                  <span className="text-[9px] sm:text-xs text-gray-400">
                    Sem edição
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Auto-Approval Rate Card - More Valuable Metric */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/5 p-3 sm:p-4 lg:p-5 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-white/5 text-gray-400 font-semibold">
                    AUTO
                  </span>
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl sm:text-2xl lg:text-3xl font-bold text-gold mb-1"
                >
                  {Math.round(metrics.aiPerformance?.autoApprovalRate || 0)}%
                </motion.p>
                <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">Auto-aprovação</p>
                <div className="flex items-center gap-1 mt-1 sm:mt-2">
                  <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gold" />
                  <span className="text-[9px] sm:text-xs text-gray-400 truncate">
                    R$ {((metrics.roi?.currentPeriodCost || 500) / 30).toFixed(0)}/dia
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Charts Section - Mobile Optimized */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Activity Chart - Mobile Optimized */}
            <div className="lg:col-span-2 rounded-lg sm:rounded-xl bg-black/50 border border-white/5 p-3 sm:p-4 lg:p-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3 lg:mb-4">
                <h4 className="text-xs sm:text-sm font-semibold text-gold">
                  Atividade - {selectedPeriod === "24h" ? "Últimas 24h" : selectedPeriod === "7d" ? "Últimos 7 dias" : "Últimos 30 dias"}
                </h4>
                <span className="text-[10px] sm:text-xs text-gray-500 font-medium">
                  {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="h-32 sm:h-40 lg:h-48">
                <Line data={chartDataFormatted} options={chartOptions} />
              </div>
            </div>

            {/* Quick Stats - Mobile Optimized - Production Ready */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 lg:gap-3">
              {[
                {
                  label: "Processamento IA",
                  value: (() => {
                    const time = metrics.aggregated?.avgProcessingTime || 0
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
                  value: (() => {
                    const time = metrics.aggregated?.avgResponseTime || 0
                    if (!time || time === 0) return "--"
                    if (time < 60) return `${Math.round(time)}s`
                    if (time < 3600) return `${Math.round(time / 60)}min`
                    return `${(time / 3600).toFixed(1)}h`
                  })(),
                  icon: Timer,
                  color: (metrics.aggregated?.avgResponseTime || 0) <= 3600 ? "text-gold" : "text-gray-400"
                },
                {
                  label: "Total Perguntas",
                  value: (metrics.aggregated?.totalQuestions || 0).toLocaleString('pt-BR'),
                  icon: MessageSquare,
                  color: "text-gold"
                },
                {
                  label: "Auto-Aprovação",
                  value: `${Math.round(metrics.aiPerformance?.autoApprovalRate || 0)}%`,
                  icon: Sparkles,
                  color: (metrics.aiPerformance?.autoApprovalRate || 0) > 80 ? "text-gold" : "text-gray-400"
                }
              ].map((stat, index) => {
                const Icon = stat.icon
                return (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.03 }}
                    className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3"
                  >
                    <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stat.color} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-gray-500 truncate">{stat.label}</p>
                      <p className={`text-sm sm:text-base lg:text-lg font-bold ${stat.color} truncate`}>
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