"use client"

import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import {
  Package,
  TrendingUp,
  Eye,
  Activity,
  ChevronRight,
  BarChart3,
  Sparkles,
  AlertCircle,
  Video,
  Image as ImageIcon,
  Award
} from "lucide-react"
import { formatNumber, formatPercentage } from "@/lib/utils"

interface AnnouncementsContainerProps {
  metrics?: any
  advancedMetrics?: any
  salesVelocity?: any
  itemsVisits?: any
}

export function AnnouncementsContainer({
  metrics,
  advancedMetrics,
  salesVelocity,
  itemsVisits
}: AnnouncementsContainerProps) {
  const router = useRouter()

  // Calculate key metrics
  const totalItems = metrics?.items?.total || 0
  const activeItems = metrics?.items?.active || 0
  const soldQuantity = metrics?.items?.sold_quantity || 0
  const conversionRate = metrics?.visits?.conversionRate || 0
  
  const todaySales = advancedMetrics?.metrics?.salesVelocity?.today?.sales || salesVelocity?.todaySales || 0
  const todayRevenue = advancedMetrics?.metrics?.salesVelocity?.today?.revenue || '0,00'
  const weekSales = advancedMetrics?.metrics?.salesVelocity?.last7Days?.sales || salesVelocity?.lastWeekSales || 0
  const growthRate = advancedMetrics?.metrics?.salesVelocity?.patterns?.growthRate || salesVelocity?.growthRate || 0
  
  const qualityScore = advancedMetrics?.metrics?.quality?.overallScore || metrics?.quality?.averageScore || 0
  const withVideo = advancedMetrics?.metrics?.quality?.metrics?.withVideo?.percentage || 0
  const premiumListings = advancedMetrics?.metrics?.quality?.metrics?.premiumListings?.percentage || 0
  const avgPictures = advancedMetrics?.metrics?.quality?.metrics?.averagePictures || 0
  
  const visitsToday = advancedMetrics?.metrics?.engagement?.visits?.today || 0
  const visits30Days = advancedMetrics?.metrics?.engagement?.visits?.last30Days || metrics?.visits?.total || 0

  const getQualityColor = (score: number) => {
    if (score >= 80) return '#10B981'
    if (score >= 60) return '#FFE600'
    if (score >= 40) return '#FFC700'
    return '#F87171'
  }

  return (
    <div 
      className="announcements-container-premium"
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
      onClick={() => router.push("/anuncios")}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(255, 230, 0, 0.3)"
        e.currentTarget.style.transform = "translateY(-2px)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255, 230, 0, 0.15)"
        e.currentTarget.style.transform = "translateY(0)"
      }}
    >
      {/* Animated Background */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "radial-gradient(circle at 20% 80%, rgba(255, 230, 0, 0.08) 0%, transparent 50%)",
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
              background: "linear-gradient(135deg, rgba(255, 230, 0, 0.2) 0%, rgba(255, 200, 0, 0.1) 100%)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Package size={20} style={{ color: "#FFE600" }} />
            </div>
            <div>
              <h3 style={{
                fontSize: "18px",
                fontWeight: "700",
                color: "#FFE600",
                marginBottom: "2px"
              }}>
                Meus Anúncios
              </h3>
              <p style={{ 
                fontSize: "12px", 
                color: "#666",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <BarChart3 size={12} />
                {activeItems} ativos de {totalItems} total
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

        {/* Main Metrics Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "20px"
        }}>
          {/* Vendas Hoje */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            style={{
              background: todaySales > 0 ? "rgba(255, 230, 0, 0.05)" : "rgba(255, 255, 255, 0.02)",
              borderRadius: "10px",
              padding: "12px",
              border: todaySales > 0 ? "1px solid rgba(255, 230, 0, 0.2)" : "1px solid rgba(255, 255, 255, 0.05)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <TrendingUp size={14} style={{ color: todaySales > 0 ? "#FFE600" : "#666" }} />
              {todaySales > 0 && (
                <Sparkles size={10} style={{ color: "#FFE600" }} />
              )}
            </div>
            <p style={{
              fontSize: "24px",
              fontWeight: "700",
              color: todaySales > 0 ? "#FFE600" : "#666",
              marginBottom: "4px"
            }}>
              {todaySales}
            </p>
            <p style={{ fontSize: "10px", color: "#666" }}>
              Vendas Hoje
            </p>
            {todayRevenue !== '0,00' && (
              <p style={{ fontSize: "9px", color: "#10B981", marginTop: "2px" }}>
                R$ {todayRevenue}
              </p>
            )}
          </motion.div>

          {/* Visitas */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "10px",
              padding: "12px",
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <Eye size={14} style={{ color: "#FFE600" }} />
            </div>
            <p style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#FFE600",
              marginBottom: "4px"
            }}>
              {formatNumber(visitsToday || visits30Days)}
            </p>
            <p style={{ fontSize: "10px", color: "#666" }}>
              {visitsToday ? 'Visitas Hoje' : 'Visitas (30d)'}
            </p>
          </motion.div>

          {/* Conversão */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "10px",
              padding: "12px",
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <Activity size={14} style={{ color: conversionRate > 2 ? "#10B981" : "#666" }} />
            </div>
            <p style={{
              fontSize: "24px",
              fontWeight: "700",
              color: conversionRate > 2 ? "#10B981" : conversionRate > 1 ? "#FFE600" : "#666",
              marginBottom: "4px"
            }}>
              {formatPercentage(conversionRate)}
            </p>
            <p style={{ fontSize: "10px", color: "#666" }}>
              Conversão
            </p>
          </motion.div>

          {/* Qualidade */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "10px",
              padding: "12px",
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <Award size={14} style={{ color: getQualityColor(qualityScore) }} />
            </div>
            <p style={{
              fontSize: "24px",
              fontWeight: "700",
              color: getQualityColor(qualityScore),
              marginBottom: "4px"
            }}>
              {qualityScore}/100
            </p>
            <p style={{ fontSize: "10px", color: "#666" }}>
              Qualidade
            </p>
          </motion.div>
        </div>

        {/* Performance Details */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px"
        }}>
          {/* Sales Performance */}
          <div style={{
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: "12px",
            padding: "16px",
            border: "1px solid rgba(255, 255, 255, 0.05)"
          }}>
            <h4 style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#FFE600",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <TrendingUp size={12} />
              Performance de Vendas
            </h4>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: "11px", color: "#999" }}>Últimos 7 dias</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFE600" }}>
                  {weekSales} vendas
                </span>
              </div>
              
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: "11px", color: "#999" }}>Crescimento</span>
                <span style={{ 
                  fontSize: "13px", 
                  fontWeight: "600", 
                  color: growthRate >= 0 ? "#10B981" : "#F87171" 
                }}>
                  {growthRate >= 0 ? '+' : ''}{growthRate}%
                </span>
              </div>
              
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: "11px", color: "#999" }}>Total Vendido</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFE600" }}>
                  {soldQuantity} unidades
                </span>
              </div>

              {advancedMetrics?.metrics?.salesVelocity?.patterns?.bestHour && (
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "8px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.05)"
                }}>
                  <span style={{ fontSize: "11px", color: "#999" }}>Melhor Horário</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFE600" }}>
                    {advancedMetrics.metrics.salesVelocity.patterns.bestHour}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quality Metrics */}
          <div style={{
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: "12px",
            padding: "16px",
            border: "1px solid rgba(255, 255, 255, 0.05)"
          }}>
            <h4 style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#FFE600",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <Award size={12} />
              Qualidade dos Anúncios
            </h4>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: "11px", color: "#999", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Video size={10} />
                  Com Vídeo
                </span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: withVideo > 30 ? "#10B981" : "#666" }}>
                  {withVideo}%
                </span>
              </div>
              
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: "11px", color: "#999", display: "flex", alignItems: "center", gap: "4px" }}>
                  <ImageIcon size={10} />
                  Média de Fotos
                </span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: avgPictures >= 6 ? "#FFE600" : "#666" }}>
                  {avgPictures || 'N/A'}
                </span>
              </div>
              
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: "11px", color: "#999", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Sparkles size={10} />
                  Premium
                </span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: premiumListings > 50 ? "#FFE600" : "#666" }}>
                  {premiumListings}%
                </span>
              </div>

              {metrics?.quality?.totalIssues > 0 && (
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "8px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.05)"
                }}>
                  <span style={{ fontSize: "11px", color: "#F87171", display: "flex", alignItems: "center", gap: "4px" }}>
                    <AlertCircle size={10} />
                    Melhorias Pendentes
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#F87171" }}>
                    {metrics.quality.totalIssues}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {advancedMetrics?.metrics?.quality?.recommendations?.length > 0 && (
          <div style={{
            marginTop: "16px",
            padding: "12px",
            background: "rgba(255, 230, 0, 0.03)",
            borderRadius: "8px",
            border: "1px solid rgba(255, 230, 0, 0.1)"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <AlertCircle size={12} style={{ color: "#FFE600" }} />
              <span style={{
                fontSize: "11px",
                color: "#FFE600",
                fontWeight: "600"
              }}>
                RECOMENDAÇÃO:
              </span>
              <span style={{
                fontSize: "11px",
                color: "#999"
              }}>
                {advancedMetrics.metrics.quality.recommendations[0].action}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}