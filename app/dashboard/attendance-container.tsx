"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import {
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Zap,
  Timer,
  Target,
  Sparkles,
  Activity,
  ArrowRight,
  RefreshCw,
  Edit2,
  Send,
  Package,
  ExternalLink,
  ChevronRight
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

interface MLAgentQuestion {
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
  sentToMLAt?: string
}

interface MLAgentMetrics {
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

interface AttendanceContainerProps {
  attendanceMetrics?: any
  agentStats?: any
  questions?: any
  conversionMetrics?: any
}

export function AttendanceContainer({
  attendanceMetrics,
  agentStats,
  questions,
  conversionMetrics
}: AttendanceContainerProps) {
  const router = useRouter()
  const [mlQuestions, setMlQuestions] = useState<MLAgentQuestion[]>([])
  const [mlMetrics, setMlMetrics] = useState<MLAgentMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)

  // Fetch ML Agent data
  useEffect(() => {
    const fetchMLAgentData = async () => {
      try {
        // Fetch questions from ML Agent API
        const [questionsData, metricsData] = await Promise.all([
          apiClient.get("/api/agent/questions-new").catch(() => []),
          apiClient.get("/api/agent/metrics-new").catch(() => null)
        ])
        
        // Filter pending questions from ML Agent
        if (Array.isArray(questionsData)) {
          const pending = questionsData.filter((q: MLAgentQuestion) => 
            q.status === "AWAITING_APPROVAL" || 
            q.status === "REVISING" || 
            q.status === "PROCESSING" ||
            q.status === "FAILED" ||
            q.status === "TOKEN_ERROR"
          )
          setMlQuestions(pending)
        }

        if (metricsData) {
          setMlMetrics(metricsData)
        }
      } catch (error) {
        console.error("Error fetching ML Agent data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMLAgentData()
    const interval = setInterval(fetchMLAgentData, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [])

  // Calculate real metrics
  const pendingCount = mlMetrics?.pendingQuestions || mlQuestions.length || 0
  const answeredByAgent = mlMetrics?.answeredQuestions || 0
  const autoApproved = mlMetrics?.autoApprovedCount || 0
  const manualApproved = mlMetrics?.manualApprovedCount || 0
  
  // Real conversion rate from ML Agent or ML API
  const conversionRate = mlMetrics?.conversionRate 
    ? (mlMetrics.conversionRate * 100).toFixed(1)
    : attendanceMetrics?.metrics?.effectiveness?.conversionRate || 
      conversionMetrics?.summary?.conversion_rate?.toFixed(1) || '0'
  
  // Real average response time
  const avgResponseTime = mlMetrics?.avgResponseTime 
    ? mlMetrics.avgResponseTime < 60 
      ? `${Math.round(mlMetrics.avgResponseTime)}min`
      : `${Math.round(mlMetrics.avgResponseTime / 60)}h`
    : 'N/A'

  // Calculate fast responses (< 1 hour)
  const fastResponses = mlQuestions.filter(q => {
    if (!q.sentToMLAt || !q.receivedAt) return false
    const responseTime = (new Date(q.sentToMLAt).getTime() - new Date(q.receivedAt).getTime()) / 1000 / 60
    return responseTime < 60
  }).length

  const fastResponseRate = mlQuestions.length > 0 
    ? ((fastResponses / mlQuestions.length) * 100).toFixed(0)
    : '0'

  const handleQuickApprove = async (questionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setIsProcessing(questionId)
    try {
      await apiClient.post("/api/agent/approve-question", {
        questionId,
        action: "approve"
      })
      // Data will refresh automatically
    } catch (error) {
      console.error("Error approving:", error)
    } finally {
      setIsProcessing(null)
    }
  }

  const getTimeAgo = (date: string) => {
    const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
    if (minutes < 1) return 'Agora'
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  const getPriorityColor = (receivedAt: string) => {
    const hoursAgo = (Date.now() - new Date(receivedAt).getTime()) / (1000 * 60 * 60)
    if (hoursAgo > 24) return '#F87171'
    if (hoursAgo > 12) return '#FFE600'
    if (hoursAgo > 6) return '#FFC700'
    return '#999999'
  }

  // Calculate revenue from answered questions (estimate based on conversion)
  const revenueFromQuestions = mlMetrics?.answeredQuestions && mlMetrics?.conversionRate
    ? (mlMetrics.answeredQuestions * mlMetrics.conversionRate * 250).toLocaleString('pt-BR', { 
        style: 'currency', 
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })
    : 'R$ 0'

  return (
    <div 
      className="attendance-container-premium"
      style={{
        background: "linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 230, 0, 0.15)",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
      }}
      onClick={() => router.push("/agente")}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(255, 230, 0, 0.3)"
        e.currentTarget.style.transform = "translateY(-2px)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255, 230, 0, 0.15)"
        e.currentTarget.style.transform = "translateY(0)"
      }}
    >
      {/* Animated Background Gradient */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "radial-gradient(circle at 80% 20%, rgba(255, 230, 0, 0.1) 0%, transparent 50%)",
        pointerEvents: "none",
        opacity: 0.5
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Premium Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              background: pendingCount > 0 
                ? "linear-gradient(135deg, rgba(255, 230, 0, 0.2) 0%, rgba(255, 200, 0, 0.1) 100%)"
                : "rgba(255, 255, 255, 0.05)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative"
            }}>
              <MessageSquare size={20} style={{ color: pendingCount > 0 ? "#FFE600" : "#666" }} />
              {pendingCount > 0 && (
                <div style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  width: "16px",
                  height: "16px",
                  background: "#F87171",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  fontWeight: "700",
                  color: "#FFF",
                  animation: "pulse 2s infinite"
                }}>
                  {pendingCount}
                </div>
              )}
            </div>
            <div>
              <h3 style={{
                fontSize: "18px",
                fontWeight: "700",
                color: "#FFE600",
                marginBottom: "2px"
              }}>
                Central de Atendimento
              </h3>
              <p style={{ 
                fontSize: "12px", 
                color: "#666",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <Activity size={12} style={{ color: "#FFE600" }} />
                ML Agent processando em tempo real
              </p>
            </div>
          </div>
          
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            background: "rgba(255, 230, 0, 0.1)",
            borderRadius: "8px",
            cursor: "pointer"
          }}>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#FFE600" }}>
              Gerenciar
            </span>
            <ChevronRight size={14} style={{ color: "#FFE600" }} />
          </div>
        </div>

        {/* ML Agent Real Metrics Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "20px"
        }}>
          {/* Pendentes Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            style={{
              background: pendingCount > 0 
                ? "rgba(255, 230, 0, 0.05)" 
                : "rgba(255, 255, 255, 0.02)",
              borderRadius: "10px",
              padding: "12px",
              border: pendingCount > 0
                ? "1px solid rgba(255, 230, 0, 0.2)"
                : "1px solid rgba(255, 255, 255, 0.05)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <Clock size={14} style={{ color: pendingCount > 0 ? "#FFE600" : "#666" }} />
              {pendingCount > 0 && (
                <span style={{
                  fontSize: "9px",
                  padding: "2px 4px",
                  background: "#F87171",
                  borderRadius: "4px",
                  color: "#FFF",
                  fontWeight: "600",
                  animation: "pulse 2s infinite"
                }}>
                  URGENTE
                </span>
              )}
            </div>
            <p style={{
              fontSize: "24px",
              fontWeight: "700",
              color: pendingCount > 0 ? "#FFE600" : "#666",
              marginBottom: "4px"
            }}>
              {pendingCount}
            </p>
            <p style={{ fontSize: "10px", color: "#666" }}>
              Pendentes
            </p>
          </motion.div>

          {/* ML Agent Respondidas Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "10px",
              padding: "12px",
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <Sparkles size={14} style={{ color: "#FFE600" }} />
              <span style={{
                fontSize: "9px",
                padding: "2px 4px",
                background: "rgba(255, 230, 0, 0.2)",
                borderRadius: "4px",
                color: "#FFE600",
                fontWeight: "600"
              }}>
                IA
              </span>
            </div>
            <p style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#FFE600",
              marginBottom: "4px"
            }}>
              {answeredByAgent}
            </p>
            <p style={{ fontSize: "10px", color: "#666" }}>
              Respondidas
            </p>
            {autoApproved > 0 && (
              <p style={{ fontSize: "9px", color: "#10B981", marginTop: "2px" }}>
                {autoApproved} auto-aprovadas
              </p>
            )}
          </motion.div>

          {/* Conversão Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "10px",
              padding: "12px",
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <TrendingUp size={14} style={{ color: "#10B981" }} />
              <Target size={10} style={{ color: "#10B981" }} />
            </div>
            <p style={{
              fontSize: "24px",
              fontWeight: "700",
              color: parseFloat(conversionRate) > 20 ? "#10B981" : 
                     parseFloat(conversionRate) > 10 ? "#FFE600" : "#666",
              marginBottom: "4px"
            }}>
              {conversionRate}%
            </p>
            <p style={{ fontSize: "10px", color: "#666" }}>
              Conversão
            </p>
            <p style={{ fontSize: "9px", color: "#10B981", marginTop: "2px" }}>
              Perguntas → Vendas
            </p>
          </motion.div>

          {/* Tempo Resposta Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "10px",
              padding: "12px",
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <Timer size={14} style={{ color: "#FFE600" }} />
              <Zap size={10} style={{ color: "#FFE600" }} />
            </div>
            <p style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#FFE600",
              marginBottom: "4px"
            }}>
              {avgResponseTime}
            </p>
            <p style={{ fontSize: "10px", color: "#666" }}>
              Tempo Médio
            </p>
            <p style={{ fontSize: "9px", color: "#FFE600", marginTop: "2px" }}>
              {fastResponseRate}% &lt; 1h
            </p>
          </motion.div>
        </div>

        {/* Questions List with Actions */}
        {mlQuestions.length > 0 && (
          <div style={{
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: "12px",
            padding: "16px",
            border: "1px solid rgba(255, 255, 255, 0.05)"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px"
            }}>
              <h4 style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#FFE600",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <AlertCircle size={12} />
                Perguntas Aguardando Aprovação
              </h4>
              <span style={{
                fontSize: "10px",
                color: "#666"
              }}>
                {mlQuestions.length} {mlQuestions.length === 1 ? 'pergunta' : 'perguntas'}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {mlQuestions.slice(0, 3).map((q) => (
                <motion.div
                  key={q.id}
                  whileHover={{ x: 4 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/agente?question=${q.id}`)
                  }}
                  style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    borderRadius: "8px",
                    padding: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 230, 0, 0.05)"
                    e.currentTarget.style.borderColor = "rgba(255, 230, 0, 0.1)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)"
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.05)"
                  }}
                >
                  {/* Question Header */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                      <Package size={12} style={{ color: "#666" }} />
                      <span style={{
                        fontSize: "11px",
                        color: "#999",
                        maxWidth: "200px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
                        {q.itemTitle}
                      </span>
                      {q.itemPrice && (
                        <span style={{
                          fontSize: "11px",
                          color: "#FFE600",
                          fontWeight: "600"
                        }}>
                          R$ {q.itemPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                    
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}>
                      <div style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: getPriorityColor(q.receivedAt),
                        animation: getPriorityColor(q.receivedAt) === '#F87171' ? "pulse 1s infinite" : "none"
                      }} />
                      <span style={{
                        fontSize: "10px",
                        color: getPriorityColor(q.receivedAt)
                      }}>
                        {getTimeAgo(q.receivedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <p style={{
                    fontSize: "12px",
                    color: "#CCC",
                    marginBottom: "10px",
                    lineHeight: "1.4",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}>
                    "{q.text}"
                  </p>

                  {/* AI Response Preview */}
                  {q.aiResponse && (
                    <div style={{
                      background: "rgba(255, 230, 0, 0.03)",
                      borderLeft: "2px solid rgba(255, 230, 0, 0.2)",
                      borderRadius: "4px",
                      padding: "8px",
                      marginBottom: "10px"
                    }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "4px"
                      }}>
                        <Sparkles size={10} style={{ color: "#FFE600" }} />
                        <span style={{
                          fontSize: "9px",
                          color: "#FFE600",
                          fontWeight: "600",
                          textTransform: "uppercase"
                        }}>
                          ML Agent Sugeriu
                        </span>
                      </div>
                      <p style={{
                        fontSize: "11px",
                        color: "#999",
                        lineHeight: "1.3",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden"
                      }}>
                        {q.aiResponse}
                      </p>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    {q.status !== "FAILED" && q.status !== "TOKEN_ERROR" ? (
                      <>
                        <button
                          onClick={(e) => handleQuickApprove(q.id, e)}
                          disabled={isProcessing === q.id || q.status === "PROCESSING"}
                          style={{
                            padding: "6px 12px",
                            background: isProcessing === q.id || q.status === "PROCESSING" ? "#666" : "#FFE600",
                            border: "none",
                            borderRadius: "6px",
                            color: "#000",
                            fontSize: "11px",
                            fontWeight: "600",
                            cursor: isProcessing === q.id || q.status === "PROCESSING" ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            if (isProcessing !== q.id && q.status !== "PROCESSING") {
                              e.currentTarget.style.background = "#FFC700"
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (isProcessing !== q.id && q.status !== "PROCESSING") {
                              e.currentTarget.style.background = "#FFE600"
                            }
                          }}
                        >
                          {isProcessing === q.id || q.status === "PROCESSING" ? (
                            <>
                              <RefreshCw size={10} className="animate-spin" />
                              Processando...
                            </>
                          ) : (
                            <>
                              <CheckCircle size={10} />
                              Aprovar
                            </>
                          )}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/agente?question=${q.id}`)
                          }}
                          style={{
                            padding: "6px 12px",
                            background: "transparent",
                            border: "1px solid rgba(255, 230, 0, 0.2)",
                            borderRadius: "6px",
                            color: "#999",
                            fontSize: "11px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "rgba(255, 230, 0, 0.4)"
                            e.currentTarget.style.color = "#FFE600"
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "rgba(255, 230, 0, 0.2)"
                            e.currentTarget.style.color = "#999"
                          }}
                        >
                          <Edit2 size={10} />
                          Revisar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          // Reprocess failed question
                          handleQuickApprove(q.id, e)
                        }}
                        disabled={isProcessing === q.id}
                        style={{
                          padding: "6px 12px",
                          background: isProcessing === q.id ? "#666" : "#F87171",
                          border: "none",
                          borderRadius: "6px",
                          color: "#FFF",
                          fontSize: "11px",
                          fontWeight: "600",
                          cursor: isProcessing === q.id ? "default" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          transition: "all 0.2s"
                        }}
                      >
                        <RefreshCw size={10} className={isProcessing === q.id ? "animate-spin" : ""} />
                        {isProcessing === q.id ? "Reprocessando..." : "Reprocessar"}
                      </button>
                    )}

                    {q.itemPermalink && (
                      <a
                        href={q.itemPermalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          padding: "6px",
                          background: "transparent",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: "6px",
                          color: "#666",
                          display: "flex",
                          alignItems: "center",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "rgba(255, 230, 0, 0.2)"
                          e.currentTarget.style.color = "#FFE600"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"
                          e.currentTarget.style.color = "#666"
                        }}
                      >
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {mlQuestions.length > 3 && (
              <div style={{
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push("/agente")
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    background: "rgba(255, 230, 0, 0.1)",
                    border: "1px solid rgba(255, 230, 0, 0.2)",
                    borderRadius: "8px",
                    color: "#FFE600",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 230, 0, 0.2)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 230, 0, 0.1)"
                  }}
                >
                  Ver todas ({mlQuestions.length})
                  <ArrowRight size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {mlQuestions.length === 0 && !loading && (
          <div style={{
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: "12px",
            padding: "32px",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            textAlign: "center"
          }}>
            <CheckCircle size={40} style={{ color: "#10B981", margin: "0 auto 16px" }} />
            <p style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#10B981",
              marginBottom: "8px"
            }}>
              Tudo em dia!
            </p>
            <p style={{
              fontSize: "12px",
              color: "#666"
            }}>
              Nenhuma pergunta pendente no momento
            </p>
          </div>
        )}

        {/* Performance Summary - Real ML Metrics */}
        {mlMetrics && mlMetrics.answeredQuestions > 0 && (
          <div style={{
            marginTop: "16px",
            padding: "12px",
            background: "rgba(255, 230, 0, 0.03)",
            borderRadius: "8px",
            border: "1px solid rgba(255, 230, 0, 0.1)"
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px"
            }}>
              <div>
                <p style={{ fontSize: "10px", color: "#666", marginBottom: "4px" }}>
                  Receita Estimada
                </p>
                <p style={{ fontSize: "14px", fontWeight: "600", color: "#10B981" }}>
                  {revenueFromQuestions}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "10px", color: "#666", marginBottom: "4px" }}>
                  Taxa Auto-Aprovação
                </p>
                <p style={{ fontSize: "14px", fontWeight: "600", color: "#FFE600" }}>
                  {mlMetrics.totalQuestions > 0 
                    ? ((mlMetrics.autoApprovedCount / mlMetrics.totalQuestions) * 100).toFixed(0)
                    : '0'}%
                </p>
              </div>
              <div>
                <p style={{ fontSize: "10px", color: "#666", marginBottom: "4px" }}>
                  Revisadas
                </p>
                <p style={{ fontSize: "14px", fontWeight: "600", color: "#F87171" }}>
                  {mlMetrics.revisedCount || 0}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ML Agent Performance Badge */}
        <div style={{
          position: "absolute",
          bottom: "16px",
          right: "16px",
          padding: "6px 10px",
          background: "linear-gradient(135deg, #FFE600 0%, #FFC700 100%)",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          <img 
            src="/ml-agent-icon.png" 
            alt="ML Agent" 
            style={{ width: "16px", height: "16px", objectFit: "contain" }}
          />
          <span style={{
            fontSize: "10px",
            fontWeight: "700",
            color: "#000",
            textTransform: "uppercase"
          }}>
            ML Agent Ativo
          </span>
        </div>
      </div>
    </div>
  )
}