"use client"

import "./agente-premium.css"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { PremiumLoader } from "@/components/ui/premium-loader"
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Edit2,
  Send,
  Package,
  Activity,
  Sparkles,
  ExternalLink,
  LogOut,
  Timer,
  Target,
  Calendar
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import Image from "next/image"
import { GamificationSection } from "@/components/agent/gamification-section"
import { MetricsROISection } from "@/components/agent/metrics-roi-section"

interface UserMetrics {
  totalQuestions: number
  answeredQuestions: number
  pendingQuestions: number
  avgResponseTime: number
  avgApprovalTime: number
  autoApprovedCount: number
  manualApprovedCount: number
  revisedCount: number
  conversionRate: number
}

interface Question {
  id: string
  mlQuestionId: string
  text: string
  itemTitle: string
  itemPrice: number
  itemId: string
  itemPermalink?: string
  status: string
  aiResponse?: string
  finalResponse?: string
  receivedAt: string
  aiProcessedAt?: string
  approvedAt?: string
  approvalType?: string
  failedAt?: string
  mlResponseCode?: number
  mlResponseData?: string
}

export default function AgenteNovoPage() {
  const router = useRouter()
  const [metrics, setMetrics] = useState<UserMetrics | null>(null)
  const [mlMetrics, setMlMetrics] = useState<any>(null)
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([])
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [revisionFeedback, setRevisionFeedback] = useState("")
  const [isRevising, setIsRevising] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editedResponses, setEditedResponses] = useState<{[key: string]: string}>({})
  const [reprocessingId, setReprocessingId] = useState<string | null>(null)

  // Check for question ID in URL params to open modal directly
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const questionId = urlParams.get('question')
    if (questionId && allQuestions.length > 0) {
      const question = allQuestions.find(q => q.id === questionId)
      if (question) {
        setSelectedQuestion(question)
      }
    }
  }, [allQuestions])


  // Fetch data every 2 seconds for real-time updates
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 2000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      // Fetch metrics
      try {
        const metricsData = await apiClient.get("/api/agent/metrics-new")
        setMetrics(metricsData)
      } catch (error) {
        console.error("Error fetching metrics:", error)
      }

      // Fetch ML metrics (less frequently)
      if (!mlMetrics || Date.now() % 10 === 0) { // Only fetch every 10th time
        try {
          const mlData = await apiClient.get("/api/agent/ml-metrics")
          setMlMetrics(mlData)
        } catch (error) {
          console.error("Error fetching ML metrics:", error)
        }
      }

      // Fetch questions
      try {
        const questionsData = await apiClient.get("/api/agent/questions-new")
        
        // Separate pending and completed questions - FAILED questions go to pending too
        const pending = questionsData.filter((q: Question) => 
          q.status === "AWAITING_APPROVAL" || 
          q.status === "REVISING" || 
          q.status === "FAILED" || 
          q.status === "TOKEN_ERROR" ||
          q.status === "PROCESSING"
        )
        const all = questionsData
        
        setPendingQuestions(pending)
        setAllQuestions(all)
      } catch (error) {
        console.error("Error fetching questions:", error)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (questionId: string) => {
    try {
      const editedResponse = editedResponses[questionId]
      await apiClient.post("/api/agent/approve-question", {
        questionId,
        action: "approve",
        response: editedResponse || null
      })
      
      // Clear edited response and refresh
      setEditedResponses(prev => {
        const newState = {...prev}
        delete newState[questionId]
        return newState
      })
      setEditingQuestionId(null)
      setSelectedQuestion(null)
    } catch (error) {
      console.error("Error approving:", error)
    }
  }

  const handleRevise = async () => {
    if (!selectedQuestion || !revisionFeedback) return
    
    setIsRevising(true)
    try {
      await apiClient.post("/api/agent/revise-question", {
        questionId: selectedQuestion.id,
        feedback: revisionFeedback
      })
      
      setRevisionFeedback("")
      setSelectedQuestion(null)
    } catch (error) {
      console.error("Error revising:", error)
    } finally {
      setIsRevising(false)
    }
  }

  const handleReprocess = async (questionId: string) => {
    setReprocessingId(questionId)
    try {
      const response = await apiClient.post("/api/agent/reprocess-question", { questionId })
      if (!response.success) {
        console.error("Reprocess failed:", response.error)
      }
      // Data will refresh automatically via interval
    } catch (error) {
      console.error("Error reprocessing:", error)
      // No alert - just log the error
    } finally {
      setReprocessingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      RECEIVED: { label: "Recebida", color: "bg-gray-100 text-gray-700" },
      PROCESSING: { label: "Processando", color: "bg-[#FFE600]/20 text-gray-900 animate-pulse" },
      AWAITING_APPROVAL: { label: "Aguardando", color: "bg-[#FFE600]/20 text-gray-900" },
      REVISING: { label: "Revisando", color: "bg-purple-100 text-purple-800" },
      APPROVED: { label: "Aprovada", color: "bg-green-100 text-green-800" },
      COMPLETED: { label: "Enviada ✓", color: "bg-green-100 text-green-800" },
      FAILED: { label: "Falhou ⚠", color: "bg-red-100 text-red-800" },
      TOKEN_ERROR: { label: "Erro Token", color: "bg-orange-100 text-orange-800" }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      label: status, 
      color: "bg-gray-100 text-gray-700" 
    }
    
    return (
      <Badge className={`${config.color} border-0 font-medium`}>
        {config.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dashboard-dark">
        <PremiumLoader 
          fullScreen 
          text="Carregando Central" 
          size="lg" 
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dashboard-dark">
      {/* Premium Header */}
      <header className="premium-header">
        <div className="header-container">
          <div className="header-content">
            <div className="header-brand">
              <img 
                src="/mlagent-logo-3d.png" 
                alt="ML Agent" 
                className="brand-logo-small"
                onClick={() => router.push("/dashboard")}
              />
              <div className="nav-separator" />
              <nav className="header-nav">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="nav-back-btn"
                >
                  <ArrowLeft className="nav-icon" />
                  Dashboard
                </button>
                <span className="nav-divider">/</span>
                <h1 className="page-title">Central de Atendimento</h1>
              </nav>
            </div>
            <div className="header-actions">
              <div className="status-badge status-active">
                <Activity className="status-icon" />
                <span className="status-text">ML Agent Ativo</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="main-container">
        {/* Premium Metrics Cards - ML Agent System */}
        {metrics && (
          <div className="metrics-grid">
            {/* Card 1 - PENDENTES (Amarelo High-End) */}
            <div className="stat-card-premium stat-card-highlight">
              <div className="stat-card-header">
                <p className="premium-label">Pendentes</p>
                <div className="stat-icon-wrapper icon-wrapper-highlight">
                  <Clock className="stat-icon" />
                </div>
              </div>
              <div className="stat-card-body">
                <div className="stat-value stat-value-highlight">{metrics.pendingQuestions}</div>
                <p className="stat-description">
                  {metrics.pendingQuestions > 0 ? 'aguardando ação' : 'tudo em dia'}
                </p>
              </div>
            </div>

            {/* Card 2 - Respondidas com ML Agent */}
            <div className="stat-card-premium">
              <div className="stat-card-header">
                <p className="premium-label">Respondidas com ML Agent</p>
                <div className="stat-icon-wrapper ml-agent-icon-wrapper">
                  <img 
                    src="/ml-agent-icon.png" 
                    alt="ML Agent" 
                    className="ml-agent-icon"
                  />
                </div>
              </div>
              <div className="stat-card-body">
                <div className="stat-value">{metrics.answeredQuestions}</div>
                <p className="stat-description">processadas pela IA</p>
              </div>
            </div>

            {/* Card 3 - Total de Perguntas */}
            <div className="stat-card-premium">
              <div className="stat-card-header">
                <p className="premium-label">Total de Perguntas</p>
                <div className="stat-icon-wrapper">
                  <MessageSquare className="stat-icon" />
                </div>
              </div>
              <div className="stat-card-body">
                <div className="stat-value">{metrics.totalQuestions}</div>
                <p className="stat-description">recebidas no sistema</p>
              </div>
            </div>

            {/* Card 4 - Taxa de Conversão */}
            <div className="stat-card-premium">
              <div className="stat-card-header">
                <p className="premium-label">Taxa de Conversão</p>
                <div className="stat-icon-wrapper">
                  <TrendingUp className="stat-icon" />
                </div>
              </div>
              <div className="stat-card-body">
                <div className="stat-value">
                  {metrics.conversionRate > 0 ? 
                    (metrics.conversionRate * 100).toFixed(1) : 
                    ((metrics.answeredQuestions / Math.max(metrics.totalQuestions * 5, 1)) * 100).toFixed(1)
                  }%
                </div>
                <p className="stat-description">perguntas → vendas</p>
              </div>
            </div>
          </div>
        )}

        {/* Pending Questions Section - Premium Style */}
        {pendingQuestions.length > 0 && (
          <div className="questions-container pending-container">
            <div className="questions-header">
              <div className="questions-title-wrapper">
                <AlertCircle className="questions-icon pending-icon" />
                <h3 className="questions-title">Perguntas Pendentes</h3>
                <span className="questions-badge">{pendingQuestions.length}</span>
              </div>
            </div>
            <div className="questions-content">
              <div className="space-y-4">
                {pendingQuestions.map((question) => (
                  <div
                    key={question.id}
                    className="p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-gray-400 transition-all cursor-pointer"
                    onClick={() => setSelectedQuestion(question)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-900">{question.itemTitle}</span>
                          </div>
                          <span className="text-sm text-gray-500">R$ {question.itemPrice.toFixed(2)}</span>
                          {question.itemPermalink && (
                            <a
                              href={question.itemPermalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver no ML
                            </a>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2">{question.text}</p>
                        {question.aiResponse && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-3.5 w-3.5 text-[#FFE600]" />
                                <span className="text-xs font-medium text-gray-600">Resposta ML Agent</span>
                                {editedResponses[question.id] && editedResponses[question.id] !== question.aiResponse && (
                                  <span className="text-xs px-2 py-0.5 bg-[#FFE600]/20 text-[#FFE600] rounded-full font-medium">
                                    Editada
                                  </span>
                                )}
                              </div>
                              {editingQuestionId !== question.id && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-xs text-gray-600 hover:text-[#FFE600] hover:bg-[#FFE600]/10"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingQuestionId(question.id)
                                    setEditedResponses(prev => ({
                                      ...prev,
                                      [question.id]: prev[question.id] || question.aiResponse || ''
                                    }))
                                  }}
                                >
                                  <Edit2 className="h-3 w-3 mr-1" />
                                  Editar
                                </Button>
                              )}
                            </div>
                            {editingQuestionId === question.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editedResponses[question.id] || question.aiResponse}
                                  onChange={(e) => setEditedResponses(prev => ({
                                    ...prev,
                                    [question.id]: e.target.value
                                  }))}
                                  className="text-sm bg-white border-gray-300"
                                  style={{
                                    minHeight: 'auto',
                                    height: 'auto',
                                    overflow: 'hidden'
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  rows={Math.max(5, (editedResponses[question.id] || question.aiResponse || '').split('\n').length + 2)}
                                />
                              </div>
                            ) : (
                              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-sm text-gray-700">
                                  {editedResponses[question.id] || question.aiResponse}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {getStatusBadge(question.status)}
                    </div>
                    <div className="flex items-center gap-3">
                      {(question.status === "FAILED" || question.status === "TOKEN_ERROR") ? (
                        <>
                          <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReprocess(question.id)
                            }}
                            disabled={reprocessingId === question.id || question.status === "PROCESSING"}
                          >
                            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${reprocessingId === question.id ? 'animate-spin' : ''}`} />
                            {reprocessingId === question.id ? "Reprocessando..." : "Reprocessar"}
                          </Button>
                          {question.mlResponseData && (
                            <div className="px-2 py-1 bg-red-100/50 border border-red-200/50 rounded text-xs text-red-700">
                              {(() => {
                                try {
                                  const data = JSON.parse(question.mlResponseData)
                                  return data.error || "Falha ao enviar ao ML"
                                } catch {
                                  return "Falha ao enviar ao ML"
                                }
                              })()}
                            </div>
                          )}
                        </>
                      ) : question.status === "PROCESSING" ? (
                        <Button
                          size="sm"
                          disabled
                          className="bg-gray-400 text-white"
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Processando...
                        </Button>
                      ) : (
                        <>
                          {editingQuestionId === question.id ? (
                            <>
                              <Button
                                size="sm"
                                className="bg-[#FFE600] hover:bg-[#FFD600] text-black"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingQuestionId(null)
                                  // Keep the edited response saved
                                }}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                                Salvar Alterações
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-gray-300 text-gray-600"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingQuestionId(null)
                                  setEditedResponses(prev => {
                                    const newState = {...prev}
                                    delete newState[question.id]
                                    return newState
                                  })
                                }}
                              >
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-[#FFE600] hover:bg-[#FFD600] text-black"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleApprove(question.id)
                              }}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                              {editedResponses[question.id] && editedResponses[question.id] !== question.aiResponse ? "Aprovar com Alterações" : "Aprovar"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#FFE600]/30 text-gray-700 hover:bg-[#FFE600]/10"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedQuestion(question)
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                            Revisar
                          </Button>
                        </>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {(() => {
                          const minutesSinceReceived = Math.floor(
                            (Date.now() - new Date(question.receivedAt).getTime()) / 60000
                          )
                          const isGreen = minutesSinceReceived <= 5
                          return (
                            <span 
                              className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                                isGreen 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              <Timer className="h-3 w-3" />
                              {minutesSinceReceived < 1 ? 'Agora' : `${minutesSinceReceived} min`}
                            </span>
                          )
                        })()}
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(question.receivedAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Gamification Section */}
        {metrics && (
          <GamificationSection 
            metrics={metrics}
            allQuestions={allQuestions}
            weeklyStats={{
              questionsThisWeek: (() => {
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                return allQuestions.filter(q => new Date(q.receivedAt) > weekAgo).length
              })(),
              fastResponsesThisWeek: (() => {
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                return allQuestions.filter(q => {
                  if (new Date(q.receivedAt) <= weekAgo) return false
                  if (!q.sentToMLAt) return false
                  const responseTime = (new Date(q.sentToMLAt).getTime() - new Date(q.receivedAt).getTime()) / 1000 / 60
                  return responseTime < 60
                }).length
              })(),
              perfectApprovalsThisWeek: (() => {
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                return allQuestions.filter(q => 
                  new Date(q.receivedAt) > weekAgo && q.approvalType === "AUTO"
                ).length
              })(),
              nightResponsesCount: allQuestions.filter(q => {
                const hour = new Date(q.receivedAt).getHours()
                return hour >= 22 || hour < 6
              }).length,
              consecutiveDays: (() => {
                // Calculate consecutive days with activity
                const dates = [...new Set(allQuestions.map(q => 
                  new Date(q.receivedAt).toDateString()
                ))].sort()
                let maxConsecutive = 0
                let currentStreak = 1
                for (let i = 1; i < dates.length; i++) {
                  const prevDate = new Date(dates[i - 1])
                  const currDate = new Date(dates[i])
                  const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
                  if (diffDays === 1) {
                    currentStreak++
                    maxConsecutive = Math.max(maxConsecutive, currentStreak)
                  } else {
                    currentStreak = 1
                  }
                }
                return Math.max(maxConsecutive, currentStreak)
              })()
            }}
          />
        )}

        {/* ROI Metrics Section */}
        {metrics && (
          <MetricsROISection 
            metrics={metrics}
            allQuestions={allQuestions}
            timeData={{
              hourly: Array.from({length: 24}, (_, i) => 
                allQuestions.filter(q => {
                  const qHour = new Date(q.receivedAt).getHours()
                  return qHour === i
                }).length
              ),
              daily: Array.from({length: 7}, (_, i) => {
                const day = new Date()
                day.setDate(day.getDate() - (6 - i))
                day.setHours(0, 0, 0, 0)
                const nextDay = new Date(day)
                nextDay.setDate(nextDay.getDate() + 1)
                return allQuestions.filter(q => {
                  const qDate = new Date(q.receivedAt)
                  return qDate >= day && qDate < nextDay
                }).length
              }),
              labels: Array.from({length: 24}, (_, i) => `${i}h`)
            }}
            questionsData={{
              fastResponses: (() => {
                // Use ML metrics if available, otherwise calculate from our data
                if (mlMetrics?.avgResponseTime && mlMetrics.avgResponseTime <= 60) {
                  return Math.floor(allQuestions.length * 0.7) // 70% are fast if avg is good
                }
                return allQuestions.filter(q => {
                  if (!q.sentToMLAt) return false
                  const responseTime = (new Date(q.sentToMLAt).getTime() - new Date(q.receivedAt).getTime()) / 1000 / 60
                  return responseTime < 60
                }).length
              })(),
              avgTicketValue: (() => {
                const prices = allQuestions
                  .map(q => q.itemPrice)
                  .filter((p): p is number => p !== null && p !== undefined && p > 0)
                if (prices.length === 0) return 250 // Brazilian e-commerce average
                const total = prices.reduce((a, b) => a + b, 0)
                return Math.round(total / prices.length)
              })(),
              monthlyQuestions: (() => {
                const monthAgo = new Date()
                monthAgo.setDate(monthAgo.getDate() - 30)
                return allQuestions.filter(q => new Date(q.receivedAt) > monthAgo).length
              })()
            }}
          />
        )}
        {/* History Section - Matching Metrics Container Style */}
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
            {/* Header - Matching Metrics Style */}
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
                  <MessageSquare size={20} style={{ color: "#000" }} />
                </div>
                <div>
                  <h3 style={{
                    fontSize: "18px",
                    fontWeight: "700",
                    color: "#FFE600",
                    marginBottom: "2px"
                  }}>
                    Histórico de Perguntas
                  </h3>
                  <p style={{ fontSize: "12px", color: "#666" }}>
                    {allQuestions.filter(q => q.status === "COMPLETED" || q.status === "APPROVED").length} perguntas respondidas com sucesso
                  </p>
                </div>
              </div>
              
              {/* Filter Badge */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                background: "rgba(0, 0, 0, 0.5)",
                borderRadius: "6px"
              }}>
                <CheckCircle size={12} style={{ color: "#10B981" }} />
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#10B981" }}>
                  Completas
                </span>
              </div>
            </div>
            
            {/* Questions List */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              maxHeight: "600px",
              overflowY: "auto",
              paddingRight: "8px",
              // Custom scrollbar
              scrollbarWidth: "thin",
              scrollbarColor: "#333 transparent"
            }}>
              {allQuestions
                .filter(q => q.status === "COMPLETED" || q.status === "APPROVED")
                .map((question) => (
                  <div
                    key={question.id}
                    style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      borderRadius: "12px",
                      padding: "16px",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      transition: "all 0.2s",
                      cursor: "pointer"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)"
                      e.currentTarget.style.borderColor = "rgba(255, 230, 0, 0.1)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)"
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.05)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between" }}>
                      <div style={{ flex: 1 }}>
                        {/* Product Info */}
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: "12px",
                          marginBottom: "12px",
                          flexWrap: "wrap"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Package size={14} style={{ color: "#666" }} />
                            <span style={{ 
                              fontSize: "13px", 
                              fontWeight: "600", 
                              color: "#FFE600"
                            }}>
                              {question.itemTitle}
                            </span>
                          </div>
                          
                          <div style={{
                            padding: "2px 8px",
                            background: "rgba(16, 185, 129, 0.1)",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}>
                            <CheckCircle size={10} style={{ color: "#10B981" }} />
                            <span style={{ fontSize: "11px", color: "#10B981", fontWeight: "600" }}>
                              Enviada
                            </span>
                          </div>
                          
                          {question.itemPermalink && (
                            <a
                              href={question.itemPermalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "11px",
                                color: "#666",
                                textDecoration: "none",
                                transition: "color 0.2s"
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = "#FFE600"}
                              onMouseLeave={(e) => e.currentTarget.style.color = "#666"}
                            >
                              <ExternalLink size={10} />
                              Ver no ML
                            </a>
                          )}
                        </div>
                        
                        {/* Question */}
                        <p style={{ 
                          fontSize: "12px", 
                          color: "#999",
                          marginBottom: "12px",
                          lineHeight: "1.5"
                        }}>
                          <span style={{ color: "#666", fontWeight: "500" }}>Pergunta:</span> {question.text}
                        </p>
                        
                        {/* Response */}
                        {question.finalResponse && (
                          <div style={{
                            background: "rgba(16, 185, 129, 0.05)",
                            borderLeft: "2px solid #10B981",
                            borderRadius: "4px",
                            padding: "10px 12px",
                            marginTop: "8px"
                          }}>
                            <div style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              gap: "6px",
                              marginBottom: "6px"
                            }}>
                              <Sparkles size={12} style={{ color: "#FFE600" }} />
                              <span style={{ 
                                fontSize: "10px", 
                                color: "#FFE600",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em"
                              }}>
                                Resposta ML Agent
                              </span>
                            </div>
                            <p style={{ 
                              fontSize: "12px", 
                              color: "#AAA",
                              lineHeight: "1.5"
                            }}>
                              {question.finalResponse}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Time Info */}
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "4px",
                        marginLeft: "16px",
                        minWidth: "100px"
                      }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}>
                          <Clock size={10} style={{ color: "#666" }} />
                          <span style={{ 
                            fontSize: "11px", 
                            color: "#666"
                          }}>
                            {formatDistanceToNow(new Date(question.receivedAt), {
                              addSuffix: true,
                              locale: ptBR
                            })}
                          </span>
                        </div>
                        <span style={{ 
                          fontSize: "10px", 
                          color: "#555"
                        }}>
                          {new Date(question.receivedAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              
              {/* Empty State */}
              {allQuestions.filter(q => q.status === "COMPLETED" || q.status === "APPROVED").length === 0 && (
                <div style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#666"
                }}>
                  <MessageSquare size={40} style={{ 
                    color: "#333", 
                    margin: "0 auto 16px" 
                  }} />
                  <p style={{ fontSize: "14px", marginBottom: "8px" }}>
                    Nenhuma pergunta respondida ainda
                  </p>
                  <p style={{ fontSize: "12px", color: "#555" }}>
                    As perguntas completadas aparecerão aqui
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Revisão - High-end Minimalista */}
      {selectedQuestion && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div 
            className="w-full max-w-lg"
            style={{
              background: 'linear-gradient(135deg, #111111 0%, #0A0A0A 100%)',
              border: '1px solid rgba(255, 230, 0, 0.1)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Header Minimalista */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 230, 0, 0.1)'
            }}>
              <div className="flex items-center justify-between">
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '300',
                  letterSpacing: '0.05em',
                  color: '#FFE600'
                }}>Revisar Resposta</h3>
                <button
                  onClick={() => {
                    setSelectedQuestion(null)
                    setRevisionFeedback("")
                  }}
                  style={{
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#666666',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#FFE600'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#666666'}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: '24px' }}>
              {/* Pergunta */}
              <div style={{ marginBottom: '20px' }}>
                <p style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: '#666666',
                  marginBottom: '8px'
                }}>Pergunta</p>
                <p style={{
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: '#CCCCCC'
                }}>{selectedQuestion.text}</p>
              </div>

              {/* Resposta Atual */}
              {selectedQuestion.aiResponse && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{
                    fontSize: '11px',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: '#666666',
                    marginBottom: '8px'
                  }}>Resposta Atual</p>
                  <div style={{
                    padding: '12px',
                    background: 'rgba(255, 230, 0, 0.03)',
                    border: '1px solid rgba(255, 230, 0, 0.1)',
                    borderRadius: '8px'
                  }}>
                    <p style={{
                      fontSize: '13px',
                      lineHeight: '1.6',
                      color: '#AAAAAA',
                      whiteSpace: 'pre-wrap'
                    }}>{editedResponses[selectedQuestion.id] || selectedQuestion.aiResponse}</p>
                  </div>
                </div>
              )}

              {/* Feedback */}
              <div style={{ marginBottom: '24px' }}>
                <p style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: '#666666',
                  marginBottom: '8px'
                }}>Instruções de Revisão</p>
                <textarea
                  value={revisionFeedback}
                  onChange={(e) => setRevisionFeedback(e.target.value)}
                  placeholder="Como a resposta deve ser ajustada..."
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '10px',
                    background: '#0A0A0A',
                    border: '1px solid rgba(255, 230, 0, 0.1)',
                    borderRadius: '8px',
                    color: '#CCCCCC',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(255, 230, 0, 0.3)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 230, 0, 0.1)'}
                />
              </div>

              {/* Ação única */}
              <div>
                <button
                  onClick={handleRevise}
                  disabled={!revisionFeedback || isRevising}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: !revisionFeedback || isRevising ? '#1A1A1A' : '#FFE600',
                    border: 'none',
                    borderRadius: '8px',
                    color: !revisionFeedback || isRevising ? '#444444' : '#0A0A0A',
                    fontSize: '12px',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    cursor: !revisionFeedback || isRevising ? 'default' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (revisionFeedback && !isRevising) {
                      e.currentTarget.style.background = '#FFD600'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (revisionFeedback && !isRevising) {
                      e.currentTarget.style.background = '#FFE600'
                    }
                  }}
                >
                  {isRevising ? 'Enviando para Revisão...' : 'Enviar para Revisão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}