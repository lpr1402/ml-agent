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
  Sparkles,
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
  BarElement,
  ArcElement,
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
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface MetricsROIProps {
  metrics: {
    totalQuestions: number
    answeredQuestions: number
    pendingQuestions: number
    autoApprovedCount: number
    manualApprovedCount: number
    revisedCount: number
    avgResponseTime: number
    avgApprovalTime: number
    conversionRate: number
  }
  timeData?: {
    hourly: number[]
    daily: number[]
    labels: string[]
  }
  questionsData?: {
    fastResponses: number // <1h responses
    avgTicketValue: number // Average product price
    monthlyQuestions: number
  }
  allQuestions?: any[] // Add allQuestions for filtering
}

export function MetricsROISection({ metrics, questionsData, allQuestions = [] }: MetricsROIProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<"24h" | "7d" | "30d">("24h")
  const [filteredMetrics, setFilteredMetrics] = useState(metrics)
  const [animatedValues, setAnimatedValues] = useState({
    roi: 0,
    savedHours: 0,
    incrementalSales: 0,
    efficiency: 0
  })
  
  // Filter data based on selected period
  useEffect(() => {
    if (!allQuestions || allQuestions.length === 0) {
      setFilteredMetrics(metrics)
      return
    }
    
    const now = new Date()
    const startDate = new Date()
    
    switch (selectedPeriod) {
      case "24h":
        startDate.setHours(now.getHours() - 24)
        break
      case "7d":
        startDate.setDate(now.getDate() - 7)
        break
      case "30d":
        startDate.setDate(now.getDate() - 30)
        break
    }
    
    const filteredQuestions = allQuestions.filter(q => 
      new Date(q.receivedAt) >= startDate
    )
    
    // Calculate metrics for filtered period
    const newMetrics = {
      totalQuestions: filteredQuestions.length,
      answeredQuestions: filteredQuestions.filter(q => q.status === "COMPLETED" || q.status === "APPROVED").length,
      pendingQuestions: filteredQuestions.filter(q => 
        q.status === "AWAITING_APPROVAL" || q.status === "PROCESSING" || q.status === "REVISING"
      ).length,
      autoApprovedCount: filteredQuestions.filter(q => q.approvalType === "AUTO").length,
      manualApprovedCount: filteredQuestions.filter(q => q.approvalType === "MANUAL").length,
      revisedCount: filteredQuestions.filter(q => q.revisedCount > 0).length,
      avgResponseTime: (() => {
        const withResponse = filteredQuestions.filter(q => q.sentToMLAt && q.receivedAt)
        if (withResponse.length === 0) return 0
        const totalTime = withResponse.reduce((sum, q) => {
          const time = (new Date(q.sentToMLAt).getTime() - new Date(q.receivedAt).getTime()) / 1000 / 60
          return sum + time
        }, 0)
        return totalTime / withResponse.length
      })(),
      avgApprovalTime: metrics.avgApprovalTime,
      conversionRate: metrics.conversionRate
    }
    
    setFilteredMetrics(newMetrics)
  }, [selectedPeriod, allQuestions, metrics])
  
  // Calculate ROI metrics with REAL values
  const ML_AGENT_COST = 500 // R$ 500/month - Real cost
  const HOUR_VALUE = 30 // R$ 30/hour - Brazilian market avg for support staff
  const MINUTES_PER_QUESTION = 5 // Real avg time to write quality response
  
  // Use real data or realistic defaults
  const monthlyQuestions = questionsData?.monthlyQuestions || filteredMetrics.answeredQuestions
  const avgTicket = questionsData?.avgTicketValue || 250 // Brazilian e-commerce avg
  const fastResponses = questionsData?.fastResponses || 
    Math.floor(filteredMetrics.answeredQuestions * (filteredMetrics.avgResponseTime <= 60 ? 0.8 : 0.3))
  
  // Calculate saved hours (monthly projection)
  const savedHoursMonthly = (monthlyQuestions * MINUTES_PER_QUESTION) / 60
  const savedValue = savedHoursMonthly * HOUR_VALUE
  
  // Calculate incremental sales - ML documentation: <1h = +10% sales increase
  const conversionRate = filteredMetrics.conversionRate > 0 ? filteredMetrics.conversionRate : 0.15 // 15% default
  const incrementalSales = fastResponses * avgTicket * 0.1 * conversionRate
  
  // Calculate total ROI
  const totalValue = savedValue + incrementalSales
  const roi = ML_AGENT_COST > 0 ? ((totalValue - ML_AGENT_COST) / ML_AGENT_COST) * 100 : 0
  
  // Calculate efficiency score (capped at 100%)
  const efficiencyScore = Math.min(100, (filteredMetrics.autoApprovedCount / Math.max(filteredMetrics.totalQuestions, 1)) * 100)
  
  // Animate values on mount
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
  
  // Calculate activity data based on selected period
  const getActivityData = () => {
    const now = new Date()
    const startDate = new Date()
    let labels: string[] = []
    let data: number[] = []
    
    if (!allQuestions || allQuestions.length === 0) {
      // Return empty data structure based on period
      switch (selectedPeriod) {
        case "24h":
          return { labels: Array.from({length: 24}, (_, i) => `${i}h`), data: Array(24).fill(0) }
        case "7d":
          return { labels: Array.from({length: 7}, (_, i) => `Dia ${i+1}`), data: Array(7).fill(0) }
        case "30d":
          return { labels: Array.from({length: 30}, (_, i) => `${i+1}`), data: Array(30).fill(0) }
      }
    }
    
    switch (selectedPeriod) {
      case "24h":
        // Show hourly data for last 24 hours
        labels = Array.from({length: 24}, (_, i) => `${i}h`)
        data = Array(24).fill(0)
        startDate.setHours(now.getHours() - 24)
        
        allQuestions.forEach(q => {
          const qDate = new Date(q.receivedAt)
          if (qDate >= startDate) {
            const hour = qDate.getHours()
            if (data[hour] !== undefined) {
              data[hour]++
            }
          }
        })
        break
        
      case "7d":
        // Show daily totals for last 7 days
        const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        labels = []
        data = Array(7).fill(0)
        
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now)
          date.setDate(date.getDate() - i)
          date.setHours(0, 0, 0, 0)
          
          const nextDate = new Date(date)
          nextDate.setDate(nextDate.getDate() + 1)
          
          // Format label: "Seg 18"
          labels.push(`${weekDays[date.getDay()]} ${date.getDate()}`)
          
          // Count questions for this day
          const dayCount = allQuestions.filter(q => {
            const qDate = new Date(q.receivedAt)
            return qDate >= date && qDate < nextDate
          }).length
          
          data[6 - i] = dayCount
        }
        break
        
      case "30d":
        // Show daily totals for last 30 days (simplified labels)
        labels = []
        data = Array(30).fill(0)
        
        for (let i = 29; i >= 0; i--) {
          const date = new Date(now)
          date.setDate(date.getDate() - i)
          date.setHours(0, 0, 0, 0)
          
          const nextDate = new Date(date)
          nextDate.setDate(nextDate.getDate() + 1)
          
          // Show day number every 5 days for cleaner chart
          if (i === 29 || i === 24 || i === 19 || i === 14 || i === 9 || i === 4 || i === 0) {
            labels.push(`${date.getDate()}/${date.getMonth() + 1}`)
          } else {
            labels.push('')
          }
          
          // Count questions for this day
          const dayCount = allQuestions.filter(q => {
            const qDate = new Date(q.receivedAt)
            return qDate >= date && qDate < nextDate
          }).length
          
          data[29 - i] = dayCount
        }
        break
    }
    
    return { labels, data }
  }
  
  const { labels: chartLabels, data: chartData } = getActivityData()
  
  const activityData = {
    labels: chartLabels,
    datasets: [{
      label: selectedPeriod === "24h" ? "Perguntas por Hora" : "Perguntas por Dia",
      data: chartData,
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
      legend: {
        display: false
      },
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
        grid: {
          color: "rgba(255, 255, 255, 0.05)"
        },
        ticks: {
          color: "#666"
        }
      },
      y: {
        grid: {
          color: "rgba(255, 255, 255, 0.05)"
        },
        ticks: {
          color: "#666"
        }
      }
    }
  }

  return (
    <div className="metrics-roi-container">
      {/* ROI Highlight Section */}
      <div style={{
        background: "linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 230, 0, 0.15)",
        padding: "24px",
        marginBottom: "24px",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Animated background */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "radial-gradient(circle at 80% 20%, rgba(255, 230, 0, 0.1) 0%, transparent 50%)",
          pointerEvents: "none"
        }} />
        
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "40px",
                height: "40px",
                background: "linear-gradient(135deg, #FFE600 0%, #FFC700 100%)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <TrendingUp size={20} style={{ color: "#000" }} />
              </div>
              <div>
                <h3 style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#FFE600",
                  marginBottom: "2px"
                }}>
                  Métricas do Sistema
                </h3>
                <p style={{ fontSize: "12px", color: "#666" }}>
                  Performance e Análise Operacional
                </p>
              </div>
            </div>
            
            {/* Period Selector */}
            <div style={{
              display: "flex",
              gap: "8px",
              background: "rgba(0, 0, 0, 0.5)",
              padding: "4px",
              borderRadius: "8px"
            }}>
              {(["24h", "7d", "30d"] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: selectedPeriod === period ? "#FFE600" : "transparent",
                    color: selectedPeriod === period ? "#000" : "#666",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  {period === "24h" ? "Hoje" : period === "7d" ? "7 dias" : "30 dias"}
                </button>
              ))}
            </div>
          </div>
          
          {/* Main ROI Cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "24px"
          }}>
            {/* ROI Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <DollarSign size={20} style={{ color: "#FFE600" }} />
                <span style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  background: "rgba(255, 230, 0, 0.2)",
                  borderRadius: "4px",
                  color: "#FFE600",
                  fontWeight: "600"
                }}>
                  ROI
                </span>
              </div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontSize: "32px",
                  fontWeight: "700",
                  color: animatedValues.roi > 0 ? "#FFE600" : "#FF6B6B",
                  marginBottom: "4px"
                }}
              >
                {animatedValues.roi > 0 ? "+" : ""}{animatedValues.roi.toFixed(0)}%
              </motion.p>
              <p style={{ fontSize: "12px", color: "#999" }}>
                Retorno sobre investimento
              </p>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                marginTop: "8px"
              }}>
                <ArrowUp size={12} style={{ color: "#FFE600" }} />
                <span style={{ fontSize: "11px", color: "#999" }}>
                  R$ {(totalValue - ML_AGENT_COST).toFixed(0)} lucro/mês
                </span>
              </div>
            </motion.div>
            
            {/* Saved Hours Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <Clock size={20} style={{ color: "#FFE600" }} />
                <span style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "4px",
                  color: "#999",
                  fontWeight: "600"
                }}>
                  TEMPO
                </span>
              </div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontSize: "32px",
                  fontWeight: "700",
                  color: "#FFE600",
                  marginBottom: "4px"
                }}
              >
                {animatedValues.savedHours.toFixed(0)}h
              </motion.p>
              <p style={{ fontSize: "12px", color: "#999" }}>
                Horas economizadas
              </p>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                marginTop: "8px"
              }}>
                <Sparkles size={12} style={{ color: "#FFE600" }} />
                <span style={{ fontSize: "11px", color: "#999" }}>
                  R$ {savedValue.toFixed(0)} economizado
                </span>
              </div>
            </motion.div>
            
            {/* Incremental Sales Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <Target size={20} style={{ color: "#FFE600" }} />
                <span style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "4px",
                  color: "#999",
                  fontWeight: "600"
                }}>
                  VENDAS
                </span>
              </div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontSize: "32px",
                  fontWeight: "700",
                  color: "#FFE600",
                  marginBottom: "4px"
                }}
              >
                +{(metrics.conversionRate * 100).toFixed(0)}%
              </motion.p>
              <p style={{ fontSize: "12px", color: "#999" }}>
                Taxa de conversão
              </p>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                marginTop: "8px"
              }}>
                <TrendingUp size={12} style={{ color: "#FFE600" }} />
                <span style={{ fontSize: "11px", color: "#999" }}>
                  R$ {incrementalSales.toFixed(0)} vendas extras
                </span>
              </div>
            </motion.div>
            
            {/* Efficiency Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <Zap size={20} style={{ color: "#FFE600" }} />
                <span style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "4px",
                  color: "#999",
                  fontWeight: "600"
                }}>
                  IA
                </span>
              </div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontSize: "32px",
                  fontWeight: "700",
                  color: "#FFE600",
                  marginBottom: "4px"
                }}
              >
                {animatedValues.efficiency.toFixed(0)}%
              </motion.p>
              <p style={{ fontSize: "12px", color: "#999" }}>
                Eficiência da IA
              </p>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                marginTop: "8px"
              }}>
                <CheckCircle size={12} style={{ color: "#FFE600" }} />
                <span style={{ fontSize: "11px", color: "#999" }}>
                  Aprovadas sem edição
                </span>
              </div>
            </motion.div>
          </div>
          
          {/* Charts and Metrics Section */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr",
            gap: "16px"
          }}>
            {/* Activity Chart */}
            <div style={{
              background: "rgba(0, 0, 0, 0.5)",
              borderRadius: "12px",
              padding: "20px",
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}>
              <h4 style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#FFE600",
                marginBottom: "16px"
              }}>
                {selectedPeriod === "24h" ? "Atividade por Hora (Últimas 24h)" : 
                 selectedPeriod === "7d" ? "Atividade Diária (Últimos 7 dias)" : 
                 "Atividade Diária (Últimos 30 dias)"}
              </h4>
              <div style={{ height: "200px" }}>
                <Line data={activityData} options={chartOptions} />
              </div>
            </div>
            
            {/* Key Metrics Grid - Moved here */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "12px",
              alignContent: "start"
            }}>
              {[
                {
                  label: "Tempo Médio IA",
                  value: (() => {
                    // Calcular tempo real de processamento da IA
                    const now = new Date()
                    const startDate = new Date()

                    switch (selectedPeriod) {
                      case "24h": startDate.setHours(now.getHours() - 24); break
                      case "7d": startDate.setDate(now.getDate() - 7); break
                      case "30d": startDate.setDate(now.getDate() - 30); break
                    }

                    // Filtrar perguntas do período que tem dados de processamento
                    const periodQuestions = allQuestions?.filter(q => {
                      const receivedDate = new Date(q.receivedAt)
                      return receivedDate >= startDate &&
                             q.receivedAt &&
                             (q.aiProcessedAt || q.processedAt)
                    }) || []

                    if (periodQuestions.length === 0) return "--"

                    // Calcular tempo médio entre recebimento e processamento da IA
                    const processingTimes = periodQuestions.map(q => {
                      const receivedTime = new Date(q.receivedAt).getTime()
                      const processedTime = new Date(q.aiProcessedAt || q.processedAt).getTime()
                      return (processedTime - receivedTime) / 1000 // em segundos
                    })

                    const avgTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length

                    // Formatar o tempo
                    if (avgTime < 60) return `${Math.round(avgTime)}s`
                    if (avgTime < 3600) return `${Math.round(avgTime / 60)}min`
                    return `${Math.round(avgTime / 3600)}h`
                  })(),
                  icon: Activity,
                  color: "#FFE600",
                  description: "Processamento da IA"
                },
                { 
                  label: "Tempo Resposta", 
                  value: filteredMetrics.avgResponseTime > 0 ? `${Math.round(filteredMetrics.avgResponseTime)}min` : "--", 
                  icon: Timer, 
                  color: filteredMetrics.avgResponseTime <= 60 ? "#FFE600" : "#999",
                  description: "Média até envio" 
                },
                { 
                  label: "Perguntas", 
                  value: filteredMetrics.totalQuestions, 
                  icon: MessageSquare, 
                  color: "#FFE600",
                  description: selectedPeriod === "24h" ? "Hoje" : selectedPeriod === "7d" ? "Últimos 7 dias" : "Últimos 30 dias"
                },
                { 
                  label: "Taxa Revisão", 
                  value: `${((filteredMetrics.revisedCount / Math.max(filteredMetrics.totalQuestions, 1)) * 100).toFixed(0)}%`, 
                  icon: AlertCircle, 
                  color: filteredMetrics.revisedCount / Math.max(filteredMetrics.totalQuestions, 1) < 0.1 ? "#FFE600" : "#999",
                  description: "Precisaram revisão"
                },
                { 
                  label: "Respostas < 1h", 
                  value: (() => {
                    const now = new Date()
                    const startDate = new Date()
                    
                    switch (selectedPeriod) {
                      case "24h": startDate.setHours(now.getHours() - 24); break
                      case "7d": startDate.setDate(now.getDate() - 7); break
                      case "30d": startDate.setDate(now.getDate() - 30); break
                    }
                    
                    const periodQuestions = allQuestions?.filter(q => new Date(q.receivedAt) >= startDate) || []
                    const fastCount = periodQuestions.filter(q => {
                      if (!q.sentToMLAt || !q.receivedAt) return false
                      const responseTime = (new Date(q.sentToMLAt).getTime() - new Date(q.receivedAt).getTime()) / 1000 / 60
                      return responseTime < 60
                    }).length
                    
                    const total = periodQuestions.filter(q => q.status === "COMPLETED" || q.status === "APPROVED").length || 1
                    const percentage = Math.round((fastCount / total) * 100)
                    return `${percentage}%`
                  })(), 
                  icon: Zap, 
                  color: "#FFE600",
                  description: "+10% vendas (ML)" 
                },
                { 
                  label: "Eficiência", 
                  value: `${efficiencyScore.toFixed(0)}%`, 
                  icon: Award, 
                  color: efficiencyScore >= 80 ? "#FFE600" : "#999",
                  description: "Auto-aprovação" 
                }
              ].map((metric, index) => {
                const Icon = metric.icon
                return (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.05 }}
                    style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      borderRadius: "8px",
                      padding: "12px",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      cursor: "pointer"
                    }}
                  >
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px"
                    }}>
                      <Icon size={14} style={{ color: metric.color }} />
                      <span style={{
                        fontSize: "10px",
                        color: "#666",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em"
                      }}>
                        {metric.label}
                      </span>
                    </div>
                    <p style={{
                      fontSize: "20px",
                      fontWeight: "700",
                      color: metric.color,
                      marginBottom: "2px"
                    }}>
                      {metric.value}
                    </p>
                    <p style={{
                      fontSize: "9px",
                      color: "#555",
                      lineHeight: "1.2"
                    }}>
                      {metric.description}
                    </p>
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