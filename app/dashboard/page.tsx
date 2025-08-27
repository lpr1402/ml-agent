"use client"

import "./dashboard-premium.css"
import "./dashboard-containers.css"
import { FinancialContainer } from "./financial-container"
import { ReputationContainer } from "./reputation-container"
import { AttendanceContainer } from "./attendance-container"
import { AnnouncementsContainer } from "./announcements-container"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { MetricCard } from "@/components/dashboard/metric-card"
import { SalesAnalyticsChart } from "@/components/dashboard/sales-analytics-chart"
import { RecentOrdersPremium } from "@/components/dashboard/recent-orders-premium"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PremiumLoader } from "@/components/ui/premium-loader"
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Eye,
  LogOut,
  ArrowRight,
  Package,
  MessageSquare,
  AlertCircle,
  Calendar,
  PackageSearch,
  Activity,
} from "lucide-react"
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/utils"
import { motion } from "framer-motion"

export default function DashboardPage() {
  const router = useRouter()
  const { logout, accessToken, isLoading: authLoading, isAuthenticated } = useAuth()

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ["user"],
    queryFn: () => apiClient.get("/api/mercadolibre/user"),
    enabled: !!accessToken,
  })

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => {
      const metricsData = await apiClient.get("/api/mercadolibre/metrics")
      
      // Fetch performance data for active items to show quality summary
      if (metricsData?.items?.active > 0) {
        try {
          const itemsResponse = await apiClient.get("/api/mercadolibre/items?status=active")
          if (itemsResponse?.items?.length > 0) {
            const performancePromises = itemsResponse.items.slice(0, 10).map((item: any) => 
              apiClient.get(`/api/mercadolibre/items/${item.id}/performance`).catch(() => null)
            )
            const performances = await Promise.all(performancePromises)
            
            // Calculate average quality score and issues
            const validPerformances = performances.filter(p => p?.data?.score !== undefined)
            const avgScore = validPerformances.length > 0 
              ? validPerformances.reduce((sum, p) => sum + p.data.score, 0) / validPerformances.length
              : 0
            const totalIssues = validPerformances.reduce((sum, p) => 
              sum + (p?.data?.pendingActions?.length || 0), 0
            )
            
            metricsData.quality = {
              averageScore: Math.round(avgScore),
              totalIssues,
              sampledItems: validPerformances.length
            }
          }
        } catch (error) {
          console.error("Error fetching quality metrics:", error)
        }
      }
      
      return metricsData
    },
    enabled: !!accessToken,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  })

  const { data: questions } = useQuery({
    queryKey: ["questions"],
    queryFn: () => apiClient.get("/api/mercadolibre/questions"),
    enabled: !!accessToken,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  })

  const { data: responseTime } = useQuery({
    queryKey: ["responseTime"],
    queryFn: () => apiClient.get("/api/mercadolibre/response-time"),
    enabled: !!accessToken,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  })

  const { data: billing } = useQuery({
    queryKey: ["billing"],
    queryFn: () => apiClient.get("/api/mercadolibre/billing"),
    enabled: !!accessToken,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  })

  const { data: highlights } = useQuery({
    queryKey: ["highlights"],
    queryFn: () => apiClient.get("/api/mercadolibre/highlights"),
    enabled: !!accessToken,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  })

  const { data: salesVelocity } = useQuery({
    queryKey: ["salesVelocity"],
    queryFn: () => apiClient.get("/api/mercadolibre/sales-velocity"),
    enabled: !!accessToken,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  })

  const { data: conversionMetrics } = useQuery({
    queryKey: ["conversionMetrics"],
    queryFn: () => apiClient.get("/api/mercadolibre/conversion-metrics"),
    enabled: !!accessToken,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const { data: advancedMetrics } = useQuery({
    queryKey: ["advancedMetrics"],
    queryFn: () => apiClient.get("/api/mercadolibre/advanced-metrics"),
    enabled: !!accessToken,
    refetchInterval: 60000, // Refresh every 60 seconds
  })

  const { data: attendanceMetrics } = useQuery({
    queryKey: ["attendanceMetrics"],
    queryFn: () => apiClient.get("/api/mercadolibre/attendance-metrics"),
    enabled: !!accessToken,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const { data: agentStats } = useQuery({
    queryKey: ["agentStats"],
    queryFn: () => apiClient.get("/api/agente/stats"),
    enabled: !!accessToken,
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  const { data: reputationMetrics } = useQuery({
    queryKey: ["reputationMetrics"],
    queryFn: () => apiClient.get("/api/mercadolibre/reputation-metrics"),
    enabled: !!accessToken,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const { data: financialSummary } = useQuery({
    queryKey: ["financialSummary"],
    queryFn: () => apiClient.get("/api/mercadolibre/financial-summary"),
    enabled: !!accessToken,
    refetchInterval: 60000, // Refresh every 60 seconds
  })

  const { data: salesAnalytics } = useQuery({
    queryKey: ["salesAnalytics"],
    queryFn: () => apiClient.get("/api/mercadolibre/sales-analytics"),
    enabled: !!accessToken,
    refetchInterval: 60000, // Refresh every 60 seconds
  })

  // Query para buscar visitas dos items (Métrica da API ML)
  const { data: itemsVisits } = useQuery({
    queryKey: ["itemsVisits"],
    queryFn: async () => {
      try {
        // Buscar visitas dos últimos 30 dias
        const endDate = new Date().toISOString()
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        return await apiClient.get(`/api/mercadolibre/users/${userData?.id}/items_visits?date_from=${startDate}&date_to=${endDate}`)
      } catch (error) {
        console.error("Error fetching visits:", error)
        return null
      }
    },
    enabled: !!accessToken && !!userData?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const isDataLoading = userLoading || metricsLoading

  // Generate chart data from recent orders
  const chartData = metrics?.recentOrders?.reduce((acc: any[], order: any) => {
    const date = new Date(order.date_created).toISOString().split("T")[0]
    const existing = acc.find((item) => item.date === date)
    
    if (existing) {
      existing.sales += 1
      existing.revenue += order.total_amount
    } else {
      acc.push({
        date,
        sales: 1,
        revenue: order.total_amount,
      })
    }
    
    return acc
  }, []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen" style={{backgroundColor: '#0A0A0A'}}>
        <PremiumLoader 
          fullScreen 
          text="Verificando autenticação" 
          size="md" 
        />
      </div>
    )
  }

  // Redirect if not authenticated
  if (!isAuthenticated && !authLoading) {
    return null // AuthContext will handle redirect
  }

  return (
    <div className="dashboard-page min-h-screen" style={{backgroundColor: '#0A0A0A'}}>
      
      {/* Header */}
      <header className="dashboard-header" style={{
        background: 'linear-gradient(90deg, #111111 0%, #0A0A0A 100%)',
        borderBottom: '1px solid rgba(255, 230, 0, 0.1)'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img 
                src="/mlagent-logo-3d.png" 
                alt="ML Agent" 
                className="h-14 w-auto dashboard-logo"
                style={{
                  background: 'transparent',
                  filter: 'none'
                }}
              />
              {userData && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs uppercase tracking-wider" style={{color: '#666666', letterSpacing: '0.1em'}}>Bem-vindo,</span>
                  <span className="text-sm font-bold uppercase tracking-wider" style={{color: '#FFE600'}}>{userData.nickname}</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                className="btn-logout flex items-center text-xs uppercase tracking-wider"
                onClick={logout}
              >
                <LogOut className="h-4 w-4 mr-2"/>
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Visão geral da sua conta</p>
        </div>
        
        {isDataLoading ? (
          <PremiumLoader 
            text="Sincronizando dados" 
            size="md" 
            fullScreen
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >

            {/* Metrics Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Receita Total"
                value={formatCurrency(metrics?.revenue?.total || 0)}
                description="Últimos 30 dias"
                icon={DollarSign}
                iconColor="text-gray-900"
                valueColor="text-gray-900"
                className="metric-card"
              />
              <MetricCard
                title="Total de Vendas"
                value={metrics?.sales?.total || 0}
                description={`${metrics?.sales?.pending || 0} pendentes`}
                icon={ShoppingCart}
                iconColor="text-gray-900"
                valueColor="text-gray-900"
                className="metric-card"
              />
              <MetricCard
                title="Visitas"
                value={formatNumber(metrics?.visits?.total || 0)}
                description="Nos seus anúncios"
                icon={Eye}
                iconColor="text-gray-900"
                valueColor="text-gray-900"
                className="metric-card"
              />
              <MetricCard
                title="Taxa de Conversão"
                value={formatPercentage(metrics?.visits?.conversionRate || 0)}
                description="Visitas para vendas"
                icon={TrendingUp}
                iconColor="text-gray-900"
                valueColor="text-gray-900"
                className="metric-card"
              />
            </div>

            {/* Premium Containers Grid - Anúncios e Atendimento */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Anúncios Container Premium */}
              <AnnouncementsContainer
                metrics={metrics}
                advancedMetrics={advancedMetrics}
                salesVelocity={salesVelocity}
                itemsVisits={itemsVisits}
              />
              
              {/* Central de Atendimento Premium */}
              <AttendanceContainer
                attendanceMetrics={attendanceMetrics}
                agentStats={agentStats}
                questions={questions}
                conversionMetrics={conversionMetrics}
              />
            </div>

            {/* Anúncios e Central de Atendimento (Old) - Hidden */}
            {false && (
            <div className="grid gap-4 lg:grid-cols-2 items-stretch">
              {/* Anúncios Container */}
              <div 
                onClick={() => router.push("/anuncios")}
                className="container-anuncios"
              >
                {/* Header */}
                <div className="container-header">
                  <div className="container-title-wrapper">
                    <h3 className="container-title">Meus Anúncios</h3>
                  </div>
                  <div className="container-action-hint">
                    Gerenciar
                  </div>
                </div>

                {/* Métricas Principais */}
                <div className="container-metrics-grid">
                  <div className="metric-box">
                    <p className="metric-box-label">Total</p>
                    <p className="metric-box-value">
                      {metrics?.items?.total || 0}
                    </p>
                  </div>
                  <div className="metric-box">
                    <p className="metric-box-label">Ativos</p>
                    <p className="metric-box-value">
                      {metrics?.items?.active || 0}
                    </p>
                  </div>
                  <div className="metric-box">
                    <p className="metric-box-label">Vendidos</p>
                    <p className="metric-box-value">
                      {metrics?.items?.sold_quantity || 0}
                    </p>
                  </div>
                </div>
                {/* Detalhes e Métricas */}
                <div className="container-details">
                  <div className="detail-section">
                    <p className="detail-section-title">Performance de Vendas</p>
                    
                    <div className="detail-row">
                      <span className="detail-label">Vendas Hoje</span>
                      <span className="detail-value highlight">
                        {advancedMetrics?.metrics?.salesVelocity?.today?.sales || salesVelocity?.todaySales || 0}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Receita Hoje</span>
                      <span className="detail-value highlight">
                        R$ {advancedMetrics?.metrics?.salesVelocity?.today?.revenue || '0,00'}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Últimos 7 dias</span>
                      <span className="detail-value">
                        {advancedMetrics?.metrics?.salesVelocity?.last7Days?.sales || salesVelocity?.lastWeekSales || 0}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Taxa de Conversão</span>
                      <span className="detail-value">
                        {formatPercentage(metrics?.visits?.conversionRate || 0)}
                      </span>
                    </div>
                    
                    {advancedMetrics?.metrics?.engagement?.visits && (
                      <div className="detail-row">
                        <span className="detail-label">Visitas Hoje</span>
                        <span className="detail-value highlight">
                          {formatNumber(advancedMetrics.metrics.engagement.visits.today)}
                        </span>
                      </div>
                    )}
                    
                    {advancedMetrics?.metrics?.engagement?.visits && (
                      <div className="detail-row">
                        <span className="detail-label">Visitas (30 dias)</span>
                        <span className="detail-value">
                          {formatNumber(advancedMetrics.metrics.engagement.visits.last30Days)}
                        </span>
                      </div>
                    )}
                    
                    <div className="detail-row">
                      <span className="detail-label">Crescimento Semanal</span>
                      <span className={`detail-value ${(advancedMetrics?.metrics?.salesVelocity?.patterns?.growthRate || salesVelocity?.growthRate || 0) >= 0 ? 'positive' : 'negative'}`}>
                        {advancedMetrics?.metrics?.salesVelocity?.patterns?.growthRate || (salesVelocity?.growthRate || 0).toFixed(1) + '%'}
                      </span>
                    </div>
                    
                    {advancedMetrics?.metrics?.salesVelocity?.patterns?.bestHour && (
                      <div className="detail-row">
                        <span className="detail-label">Melhor Horário</span>
                        <span className="detail-value">
                          {advancedMetrics.metrics.salesVelocity.patterns.bestHour}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status de Qualidade */}
                  {advancedMetrics?.metrics?.quality && (
                    <div className="detail-section">
                      <p className="detail-section-title">Qualidade dos Anúncios</p>
                      <div className="detail-row">
                        <span className="detail-label">Score de Qualidade</span>
                        <span className="detail-value highlight">
                          {advancedMetrics.metrics.quality.overallScore}/100
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Com Vídeo</span>
                        <span className="detail-value">
                          {advancedMetrics.metrics.quality.metrics.withVideo.percentage}%
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Anúncios Premium</span>
                        <span className="detail-value">
                          {advancedMetrics.metrics.quality.metrics.premiumListings.percentage}%
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Média de Fotos</span>
                        <span className="detail-value">
                          {advancedMetrics.metrics.quality.metrics.averagePictures}
                        </span>
                      </div>
                      {advancedMetrics.metrics.quality.recommendations?.length > 0 && (
                        <div className="detail-row">
                          <span className="detail-label">Recomendação</span>
                          <span className="detail-value" style={{fontSize: '12px'}}>
                            {advancedMetrics.metrics.quality.recommendations[0].action}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Central de Atendimento Container */}
              <div 
                onClick={() => router.push("/agente")}
                className="container-central"
              >
                {/* Header */}
                <div className="container-header">
                  <div className="container-title-wrapper">
                    <h3 className="container-title">Atendimento</h3>
                  </div>
                  <div className="container-action-hint">
                    Responder
                  </div>
                </div>

                {/* Métricas Principais */}
                <div className="container-metrics-grid">
                  <div className="metric-box">
                    <p className="metric-box-label">Pendentes</p>
                    <p className="metric-box-value">
                      {attendanceMetrics?.metrics?.priority?.total || questions?.stats?.unanswered || 0}
                    </p>
                    {(attendanceMetrics?.metrics?.priority?.questions?.[0]?.hoursWaiting > 0.083 || 
                      attendanceMetrics?.metrics?.priority?.critical > 0) && (
                      <p className="metric-box-sub" style={{color: '#F87171'}}>
                        ⚠ Responder urgente
                      </p>
                    )}
                  </div>
                  <div className="metric-box">
                    <p className="metric-box-label">Respondidas</p>
                    <p className="metric-box-value">
                      {agentStats?.answeredByAgent || 0}
                    </p>
                    <p className="metric-box-sub">
                      Pelo sistema IA
                    </p>
                  </div>
                  <div className="metric-box">
                    <p className="metric-box-label">Conversão</p>
                    <p className="metric-box-value">
                      {attendanceMetrics?.metrics?.effectiveness?.conversionRate || conversionMetrics?.summary?.conversion_rate?.toFixed(1) || '0'}%
                    </p>
                    <p className="metric-box-sub">
                      Perguntas → Vendas
                    </p>
                  </div>
                </div>
                {/* Detalhes e Perguntas Recentes */}
                <div className="container-details">
                  {/* Perguntas Prioritárias com Dados Reais */}
                  {attendanceMetrics?.metrics?.priority?.questions && 
                   attendanceMetrics.metrics.priority.questions.length > 0 ? (
                    <div className="detail-section">
                      <p className="detail-section-title">Perguntas Prioritárias</p>
                      <div className="questions-list">
                        {attendanceMetrics.metrics.priority.questions.slice(0, 3).map((q: any, index: number) => (
                          <div key={q.id || index} className="question-item">
                            <p className="question-text">
                              "{q.text && q.text.length > 50 ? q.text.substring(0, 50) + '...' : q.text}"
                            </p>
                            <div className="question-meta">
                              <span style={{
                                color: q.priority === 'critical' ? '#F87171' : 
                                       q.priority === 'high' ? '#FFE600' : '#999999',
                                fontSize: '11px',
                                fontWeight: '500'
                              }}>
                                {q.reason}
                              </span>
                              <span className="question-date">
                                {q.hoursWaiting}h atrás
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : questions?.recent && questions.recent.length > 0 ? (
                    <div className="detail-section">
                      <p className="detail-section-title">Perguntas Recentes</p>
                      <div className="questions-list">
                        {questions.recent.slice(0, 3).map((q: any, index: number) => (
                          <div key={q.id || index} className="question-item">
                            <p className="question-text">
                              "{q.text && q.text.length > 50 ? q.text.substring(0, 50) + '...' : q.text}"
                            </p>
                            <div className="question-meta">
                              <span>{q.item_title ? q.item_title.substring(0, 30) + '...' : 'Produto'}</span>
                              <span className="question-date">{new Date(q.date_created).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="detail-section">
                      <p className="detail-section-title">Status</p>
                      <p className="detail-label">Nenhuma pergunta pendente</p>
                    </div>
                  )}


                  {/* Análise de Padrões */}
                  {(attendanceMetrics?.metrics?.patterns || agentStats) && (
                    <div className="detail-section">
                      <p className="detail-section-title">Análise de Atendimento</p>
                      <div className="detail-row">
                        <span className="detail-label">Tempo Médio de Resposta</span>
                        <span className="detail-value highlight">
                          {agentStats?.avgResponseTime || 'N/A'}
                        </span>
                      </div>
                      {attendanceMetrics?.metrics?.patterns && (
                        <>
                          <div className="detail-row">
                            <span className="detail-label">Horário de Pico</span>
                            <span className="detail-value">
                              {attendanceMetrics.metrics.patterns.peakHour || 'N/A'}
                            </span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Volume Diário</span>
                            <span className="detail-value">
                              {attendanceMetrics.metrics.patterns.avgPerDay || '0'} perguntas
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Eficácia de Respostas */}
                  {attendanceMetrics?.metrics?.effectiveness && (
                    <div className="detail-section">
                      <p className="detail-section-title">Performance de Atendimento</p>
                      <div className="detail-row">
                        <span className="detail-label">Receita de Perguntas</span>
                        <span className="detail-value positive">
                          R$ {attendanceMetrics.metrics.effectiveness.revenueFromQuestions || '0,00'}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Taxa de Conversão</span>
                        <span className={`detail-value ${
                          parseFloat(attendanceMetrics.metrics.effectiveness.conversionRate) > 20 ? 'positive' :
                          parseFloat(attendanceMetrics.metrics.effectiveness.conversionRate) > 10 ? 'highlight' : 'negative'
                        }`}>
                          {attendanceMetrics.metrics.effectiveness.conversionRate}%
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Respostas Rápidas (&lt;1h)</span>
                        <span className={`detail-value ${
                          parseFloat(attendanceMetrics.metrics.effectiveness.fastResponseRate || '0') > 70 ? 'positive' :
                          parseFloat(attendanceMetrics.metrics.effectiveness.fastResponseRate || '0') > 40 ? 'highlight' : 'negative'
                        }`}>
                          {attendanceMetrics.metrics.effectiveness.fastResponseRate || '0'}%
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Vendas Perdidas</span>
                        <span className="detail-value negative">
                          {attendanceMetrics.metrics.effectiveness.potentialLost || 0}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Health Score do Atendimento */}
                  {attendanceMetrics?.metrics?.summary?.overallHealth && (
                    <div className="status-indicator">
                      <div className="status-info">
                        <div 
                          className="status-dot" 
                          style={{
                            background: attendanceMetrics.metrics.summary.overallHealth.color
                          }}
                        ></div>
                        <span className="status-text">
                          Score: {attendanceMetrics.metrics.summary.overallHealth.score}/100
                        </span>
                      </div>
                      <span className="status-badge">
                        {attendanceMetrics.metrics.summary.overallHealth.status === 'excellent' ? 'Excelente' :
                         attendanceMetrics.metrics.summary.overallHealth.status === 'good' ? 'Bom' :
                         attendanceMetrics.metrics.summary.overallHealth.status === 'attention' ? 'Atenção' :
                         'Crítico'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Financial Summary Container - Optimized Version */}
            <FinancialContainer financialSummary={financialSummary} />

            {/* Old Financial Container - Hidden */}
            {false && financialSummary && (
              <div className="container-financeiro">
                {/* Header */}
                <div className="container-header">
                  <div className="container-title-wrapper">
                    <h3 className="container-title">Resumo Financeiro</h3>
                  </div>
                  <div className="container-action-hint">
                    {financialSummary.revenue?.growthRate7Days > 0 ? '↑' : '↓'} {Math.abs(financialSummary.revenue?.growthRate7Days || 0).toFixed(1)}%
                  </div>
                </div>

                {/* Main Revenue Metrics */}
                <div className="container-metrics-grid">
                  <div className="metric-box">
                    <p className="metric-box-label">Receita 30D</p>
                    <p className="metric-box-value">
                      {financialSummary.revenue?.gross30Days ? 
                        financialSummary.revenue.gross30Days.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : 
                        'N/A'}
                    </p>
                    <p className="metric-box-sub">
                      Bruta
                    </p>
                  </div>

                  <div className="metric-box">
                    <p className="metric-box-label">Líquida 30D</p>
                    <p className="metric-box-value">
                      {financialSummary.revenue?.net30Days ? 
                        financialSummary.revenue.net30Days.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : 
                        'N/A'}
                    </p>
                    <p className="metric-box-sub">
                      {financialSummary.fees?.netMargin?.toFixed(0) || 'N/A'}% margem
                    </p>
                  </div>

                  <div className="metric-box">
                    <p className="metric-box-label">Hoje</p>
                    <p className="metric-box-value">
                      {financialSummary.revenue?.grossToday ? 
                        financialSummary.revenue.grossToday.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : 
                        'N/A'}
                    </p>
                    <p className="metric-box-sub">
                      {financialSummary.orders?.totalToday || 0} vendas
                    </p>
                  </div>

                  <div className="metric-box">
                    <p className="metric-box-label">Projeção</p>
                    <p className="metric-box-value">
                      {financialSummary.revenue?.projectedMonthly ? 
                        financialSummary.revenue.projectedMonthly.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : 
                        'N/A'}
                    </p>
                    <p className="metric-box-sub">
                      Mensal
                    </p>
                  </div>
                </div>

                {/* Fees and Taxes Breakdown */}
                <div className="container-details">
                  <div className="detail-section">
                    <p className="detail-section-title">Análise de Taxas e Impostos</p>
                    <div className="detail-row">
                      <span className="detail-label">Comissões ML</span>
                      <span className="detail-value negative">
                        R$ {financialSummary.fees?.totalFees30Days?.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Taxa Efetiva</span>
                      <span className="detail-value">
                        {financialSummary.fees?.effectiveRate?.toFixed(1) || 'N/A'}%
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Impostos Retidos</span>
                      <span className="detail-value negative">
                        R$ {financialSummary.fees?.totalPerceptions?.toFixed(2) || 'N/A'}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Bonificações</span>
                      <span className="detail-value positive">
                        R$ {financialSummary.fees?.totalBonuses?.toFixed(2) || 'N/A'}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">A Receber</span>
                      <span className="detail-value highlight">
                        R$ {financialSummary.payments?.totalPending?.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Tempo de Liberação</span>
                      <span className="detail-value">
                        ~{financialSummary.payments?.avgReleasedays || 'N/A'} dias
                      </span>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="detail-section">
                    <p className="detail-section-title">Métricas de Performance</p>
                    
                    <div className="detail-row">
                      <span className="detail-label">Velocidade de Vendas</span>
                      <span className="detail-value highlight">
                        {financialSummary.orders?.salesVelocity?.toFixed(1) || 'N/A'} vendas/dia
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Taxa de Conversão</span>
                      <span className={`detail-value ${financialSummary.orders?.conversionRate > 2 ? 'positive' : financialSummary.orders?.conversionRate > 1 ? 'highlight' : 'negative'}`}>
                        {financialSummary.orders?.conversionRate?.toFixed(2) || 'N/A'}%
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Visitas (30 dias)</span>
                      <span className="detail-value">
                        {financialSummary.visits?.total30Days?.toLocaleString('pt-BR') || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Ticket Médio</span>
                      <span className="detail-value highlight">
                        R$ {financialSummary.revenue?.avgTicket?.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Vendas (30 dias)</span>
                      <span className="detail-value">
                        {financialSummary.orders?.total30Days || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Vendas (7 dias)</span>
                      <span className="detail-value">
                        {financialSummary.orders?.total7Days || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Insights and Recommendations */}
                  {financialSummary.insights?.recommendations?.length > 0 && (
                    <div className="detail-section">
                      <p className="detail-section-title">Insights e Recomendações</p>
                      {financialSummary.insights.recommendations.map((rec: string, index: number) => (
                        <div key={index} className="detail-row">
                          <span className="detail-label" style={{fontSize: '13px'}}>→</span>
                          <span className="detail-value" style={{fontSize: '13px', color: '#FFE600'}}>
                            {rec}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Payment Methods Breakdown */}
                  {financialSummary.payments?.methodsBreakdown && Object.keys(financialSummary.payments.methodsBreakdown).length > 0 && (
                    <div className="detail-section">
                      <p className="detail-section-title">Mix de Pagamentos</p>
                      {Object.entries(financialSummary.payments.methodsBreakdown).map(([method, count]: [string, any]) => (
                        <div key={method} className="detail-row">
                          <span className="detail-label">{method}</span>
                          <span className="detail-value">
                            {count} transações
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Response Time Metrics */}
            {responseTime?.error ? (
              <Card className="premium-card">
                <CardHeader>
                  <CardTitle>Tempo de Resposta</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    {responseTime.message || "Dados de tempo de resposta não disponíveis"}
                  </p>
                </CardContent>
              </Card>
            ) : responseTime?.data ? (
              <Card className="premium-card">
                <CardHeader>
                  <CardTitle>Tempo de Resposta às Perguntas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Média Geral</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {responseTime.data.total_formatted || "0 min"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Dias Úteis (9h-18h)</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {responseTime.data.weekdays_working_formatted || "0 min"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Dias Úteis (18h-00h)</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {responseTime.data.weekdays_extra_formatted || "0 min"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Finais de Semana</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {responseTime.data.weekend_formatted || "0 min"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}


            {/* Charts and Tables - Premium Style */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="lg:col-span-1">
                <SalesAnalyticsChart data={salesAnalytics} />
              </div>
              <div className="lg:col-span-1">
                <RecentOrdersPremium orders={salesAnalytics?.recentOrders || []} />
              </div>
            </div>

            {/* Reputation Container - Redesigned with Real Metrics */}
            {reputationMetrics && (
              <ReputationContainer reputationMetrics={reputationMetrics} />
            )}

            {/* Old Reputation Container - Hidden */}
            {false && reputationMetrics && (
              <div className="container-reputation premium-card" style={{
                background: 'linear-gradient(135deg, #111111 0%, #0A0A0A 100%)',
                border: '1px solid rgba(255, 230, 0, 0.1)',
                borderRadius: '20px',
                padding: '32px',
                cursor: 'default',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Background Glow Effect */}
                <div style={{
                  position: 'absolute',
                  top: '-50%',
                  right: '-20%',
                  width: '400px',
                  height: '400px',
                  background: 'radial-gradient(circle, rgba(255, 230, 0, 0.03) 0%, transparent 70%)',
                  pointerEvents: 'none',
                  opacity: 0.8
                }}></div>

                {/* Header */}
                <div className="container-header" style={{ 
                  marginBottom: '28px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div className="container-title-wrapper">
                    <h3 className="container-title" style={{
                      fontSize: '24px',
                      fontWeight: '300',
                      letterSpacing: '0.1em',
                      textTransform: 'none',
                      color: '#FFE600',
                      margin: 0
                    }}>Reputação</h3>
                  </div>
                  {reputationMetrics.reputation?.powerSeller ? (
                    <div style={{
                      padding: '8px 16px',
                      background: reputationMetrics.reputation.powerSeller === 'platinum' ? 
                        'linear-gradient(135deg, #E5E7EB 0%, #9CA3AF 100%)' :
                        reputationMetrics.reputation.powerSeller === 'gold' ? 
                        'linear-gradient(135deg, #FFE600 0%, #FFC700 100%)' :
                        reputationMetrics.reputation.powerSeller === 'silver' ? 
                        'linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 100%)' :
                        'rgba(255, 230, 0, 0.1)',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#0A0A0A',
                        textTransform: 'none',
                        letterSpacing: '0.05em'
                      }}>
                        {reputationMetrics.reputation.powerSellerLabel || 'Vendedor Regular'}
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      padding: '8px 16px',
                      background: 'rgba(255, 230, 0, 0.03)',
                      border: '1px solid rgba(255, 230, 0, 0.1)',
                      borderRadius: '8px'
                    }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '500',
                        color: '#999999',
                        textTransform: 'none',
                        letterSpacing: '0.05em'
                      }}>
                        Vendedor Regular
                      </span>
                    </div>
                  )}
                </div>

                {/* Main Metrics Grid */}
                <div className="container-metrics-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '20px',
                  marginBottom: '28px'
                }}>
                  <div className="metric-box" style={{
                    background: 'rgba(255, 230, 0, 0.03)',
                    border: '1px solid rgba(255, 230, 0, 0.1)',
                    borderRadius: '12px',
                    padding: '20px',
                    transition: 'all 0.3s ease'
                  }}>
                    <p className="metric-box-label" style={{
                      fontSize: '10px',
                      color: '#666666',
                      textTransform: 'none',
                      letterSpacing: '0.05em',
                      marginBottom: '12px',
                      fontWeight: '500'
                    }}>Score Geral</p>
                    <p className="metric-box-value" style={{
                      fontSize: '32px',
                      fontWeight: '200',
                      letterSpacing: '-0.02em',
                      color: reputationMetrics.reputation?.score == null ? '#999999' :
                             reputationMetrics.reputation.score >= 80 ? '#10B981' :
                             reputationMetrics.reputation.score >= 60 ? '#FFE600' :
                             reputationMetrics.reputation.score >= 40 ? '#FFC700' : '#EF4444',
                      margin: '0 0 12px 0'
                    }}>
                      {reputationMetrics.reputation?.score != null ? reputationMetrics.reputation.score : 'N/A'}
                    </p>
                    {reputationMetrics.reputation?.score != null && (
                      <div style={{
                        height: '3px',
                        background: '#1A1A1A',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.max(0, Math.min(100, reputationMetrics.reputation.score))}%`,
                          height: '100%',
                          background: `linear-gradient(90deg, ${reputationMetrics.thermometer?.color || '#FFE600'} 0%, ${reputationMetrics.thermometer?.color || '#FFC700'} 100%)`,
                          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: `0 0 10px ${reputationMetrics.thermometer?.color || '#FFE600'}40`
                        }}></div>
                      </div>
                    )}
                  </div>
                  
                  <div className="metric-box" style={{
                    background: 'rgba(255, 230, 0, 0.03)',
                    border: '1px solid rgba(255, 230, 0, 0.1)',
                    borderRadius: '12px',
                    padding: '20px',
                    transition: 'all 0.3s ease'
                  }}>
                    <p className="metric-box-label" style={{
                      fontSize: '10px',
                      color: '#666666',
                      textTransform: 'none',
                      letterSpacing: '0.05em',
                      marginBottom: '12px',
                      fontWeight: '500'
                    }}>Vendas Completas</p>
                    <p className="metric-box-value" style={{
                      fontSize: '32px',
                      fontWeight: '200',
                      letterSpacing: '-0.02em',
                      color: '#FFFFFF',
                      margin: '0 0 8px 0'
                    }}>
                      {reputationMetrics.transactions?.completed ?? 'N/A'}
                    </p>
                    <p className="metric-box-sub" style={{
                      fontSize: '10px',
                      color: '#666666',
                      textTransform: 'none',
                      letterSpacing: '0.05em'
                    }}>
                      {reputationMetrics.transactions?.period === 'historic' ? 'Histórico total' : 
                       reputationMetrics.transactions?.period || 'N/A'}
                    </p>
                  </div>
                  
                  <div className="metric-box" style={{
                    background: 'rgba(255, 230, 0, 0.03)',
                    border: '1px solid rgba(255, 230, 0, 0.1)',
                    borderRadius: '12px',
                    padding: '20px',
                    transition: 'all 0.3s ease'
                  }}>
                    <p className="metric-box-label" style={{
                      fontSize: '10px',
                      color: '#666666',
                      textTransform: 'none',
                      letterSpacing: '0.05em',
                      marginBottom: '12px',
                      fontWeight: '500'
                    }}>Avaliações</p>
                    <p className="metric-box-value" style={{
                      fontSize: '32px',
                      fontWeight: '200',
                      letterSpacing: '-0.02em',
                      color: reputationMetrics.transactions?.ratings?.positive >= 95 ? '#10B981' :
                             reputationMetrics.transactions?.ratings?.positive >= 85 ? '#FFE600' :
                             reputationMetrics.transactions?.ratings?.positive ? '#FFC700' : '#999999',
                      margin: '0 0 8px 0'
                    }}>
                      {reputationMetrics.transactions?.ratings?.positive ? 
                        `${reputationMetrics.transactions.ratings.positive.toFixed(0)}%` : 'N/A'}
                    </p>
                    <p className="metric-box-sub" style={{
                      fontSize: '10px',
                      color: '#666666',
                      textTransform: 'none',
                      letterSpacing: '0.05em'
                    }}>
                      Positivas
                    </p>
                  </div>
                </div>

                {/* Performance Details */}
                <div className="container-details" style={{
                  borderTop: '1px solid rgba(255, 230, 0, 0.1)',
                  paddingTop: '24px'
                }}>
                  <div className="detail-section" style={{ marginBottom: '20px' }}>
                    <p className="detail-section-title" style={{
                      fontSize: '11px',
                      fontWeight: '300',
                      color: '#FFE600',
                      textTransform: 'none',
                      letterSpacing: '0.15em',
                      marginBottom: '16px'
                    }}>Métricas de Performance</p>
                    
                    <div className="detail-row" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: '1px solid rgba(255, 230, 0, 0.05)'
                    }}>
                      <span className="detail-label" style={{
                        fontSize: '12px',
                        color: '#999999',
                        textTransform: 'none',
                        letterSpacing: '0.05em'
                      }}>Vendas Canceladas</span>
                      <span className="detail-value" style={{
                        fontSize: '16px',
                        fontWeight: '300',
                        color: reputationMetrics.transactions?.canceled ? '#EF4444' : '#999999',
                        letterSpacing: '-0.02em'
                      }}>
                        {reputationMetrics.transactions?.canceled ?? 'N/A'}
                      </span>
                    </div>
                    
                    <div className="detail-row" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: '1px solid rgba(255, 230, 0, 0.05)'
                    }}>
                      <span className="detail-label" style={{
                        fontSize: '12px',
                        color: '#999999',
                        textTransform: 'none',
                        letterSpacing: '0.05em'
                      }}>Reclamações Concluídas</span>
                      <span className="detail-value" style={{
                        fontSize: '16px',
                        fontWeight: '300',
                        color: reputationMetrics.metrics?.claims?.closed ?? 0 > 0 ? '#F59E0B' : '#999999',
                        letterSpacing: '-0.02em'
                      }}>
                        {reputationMetrics.metrics?.claims?.closed ?? 'N/A'}
                      </span>
                    </div>
                    
                    <div className="detail-row" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: '1px solid rgba(255, 230, 0, 0.05)'
                    }}>
                      <span className="detail-label" style={{
                        fontSize: '12px',
                        color: '#999999',
                        textTransform: 'none',
                        letterSpacing: '0.05em'
                      }}>Entregas Atrasadas</span>
                      <span className="detail-value" style={{
                        fontSize: '16px',
                        fontWeight: '300',
                        color: reputationMetrics.metrics?.delayedHandlingTime?.late ?? 0 > 0 ? '#F59E0B' : '#999999',
                        letterSpacing: '-0.02em'
                      }}>
                        {reputationMetrics.metrics?.delayedHandlingTime?.late ?? 'N/A'}
                      </span>
                    </div>
                    
                    <div className="detail-row" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0'
                    }}>
                      <span className="detail-label" style={{
                        fontSize: '12px',
                        color: '#999999',
                        textTransform: 'none',
                        letterSpacing: '0.05em'
                      }}>Total de Vendas (histórico)</span>
                      <span className="detail-value" style={{
                        fontSize: '16px',
                        fontWeight: '300',
                        color: '#FFFFFF',
                        letterSpacing: '-0.02em'
                      }}>
                        {reputationMetrics.transactions?.total ?? 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  )
}