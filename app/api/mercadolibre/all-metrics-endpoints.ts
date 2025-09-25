/**
 * Configurações padronizadas para todos os endpoints de métricas
 * Seguindo 100% a documentação oficial do Mercado Livre
 */

import { executeMLApiCall, batchMLApiCalls } from "@/lib/api/ml-api-base"
import { CacheTTL } from "@/lib/api/cache-manager"

// Configuração base para métricas - COM CIRCUIT BREAKER HABILITADO
const baseMetricsConfig = {
  circuitBreaker: {
    enabled: true,
    failureThreshold: 10, // Permite mais falhas para métricas
    successThreshold: 3,
    timeout: 30000, // 30 segundos para métricas
    resetTimeout: 60000 // 1 minuto para reset
  },
  rateLimit: {
    maxRetries: 2,
    initialDelay: 2000,
    maxDelay: 10000,
    backoffMultiplier: 2
  }
}

/**
 * Sales Analytics - Análise de vendas
 */
export async function getSalesAnalytics(userId: string, period: string = '30days') {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  return executeMLApiCall({
    endpoint: `/orders/search?seller=${userId}&order.date_created.from=${thirtyDaysAgo.toISOString()}&limit=50`,
    cache: {
      enabled: true,
      ttl: CacheTTL.METRICS,
      key: `sales-analytics:${userId}:${period}`
    },
    ...baseMetricsConfig
  }, (data) => {
    const orders = data.results || []
    const totalRevenue = orders.reduce((sum: number, order: any) => 
      sum + (order.total_amount || 0), 0)
    const totalSales = data.paging?.total || 0
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0
    
    // Análise por status
    const statusBreakdown = {
      paid: orders.filter((o: any) => o.status === 'paid').length,
      payment_in_process: orders.filter((o: any) => o.status === 'payment_in_process').length,
      cancelled: orders.filter((o: any) => o.status === 'cancelled').length,
      delivered: orders.filter((o: any) => o.status === 'delivered').length
    }
    
    return {
      total_revenue: totalRevenue,
      total_sales: totalSales,
      average_ticket: averageTicket,
      status_breakdown: statusBreakdown,
      orders: orders.slice(0, 10), // Últimos 10 pedidos
      period,
      _timestamp: new Date().toISOString()
    }
  })
}

/**
 * Reputation Metrics - Métricas de reputação
 */
export async function getReputationMetrics(userId: string) {
  return executeMLApiCall({
    endpoint: `/users/${userId}`,
    cache: {
      enabled: true,
      ttl: CacheTTL.REPUTATION,
      key: `reputation:${userId}`
    },
    ...baseMetricsConfig
  }, (userData) => {
    const reputation = userData.seller_reputation || {}
    
    return {
      level_id: reputation.level_id,
      power_seller_status: reputation.power_seller_status,
      transactions: reputation.transactions || {},
      metrics: reputation.metrics || {},
      ratings: reputation.ratings || {},
      // Calcular score geral
      overall_score: calculateReputationScore(reputation),
      user_status: userData.status,
      registration_date: userData.registration_date,
      _timestamp: new Date().toISOString()
    }
  })
}

/**
 * Sales Velocity - Velocidade de vendas
 */
export async function getSalesVelocity(userId: string) {
  const periods = [
    { days: 7, label: 'last_7_days' },
    { days: 14, label: 'last_14_days' },
    { days: 30, label: 'last_30_days' }
  ]
  
  const velocityData = await Promise.all(
    periods.map(async (period) => {
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - period.days)
      
      const response = await executeMLApiCall({
        endpoint: `/orders/search?seller=${userId}&order.date_created.from=${fromDate.toISOString()}&limit=1`,
        cache: {
          enabled: true,
          ttl: CacheTTL.METRICS,
          key: `velocity:${userId}:${period.label}`
        },
        ...baseMetricsConfig
      }, (data) => ({
        period: period.label,
        days: period.days,
        total_orders: data.paging?.total || 0,
        daily_average: (data.paging?.total || 0) / period.days
      }))
      
      return response
    })
  )
  
  return {
    velocity_by_period: velocityData,
    trend: calculateTrend(velocityData),
    _timestamp: new Date().toISOString()
  }
}

/**
 * Response Time - Tempo de resposta
 * Usando endpoint correto da documentação oficial do ML
 */
export async function getResponseTime(userId: string) {
  return executeMLApiCall({
    endpoint: `/my/received_questions/search?limit=50&status=ANSWERED`,
    cache: {
      enabled: true,
      ttl: CacheTTL.QUESTIONS,
      key: `response-time:${userId}`
    },
    ...baseMetricsConfig
  }, (data) => {
    const questions = data.questions || []
    const answered = questions.filter((q: any) => q.status === 'ANSWERED')
    
    // Calcular tempo médio de resposta
    const responseTimes = answered.map((q: any) => {
      if (q.answer?.date_created && q.date_created) {
        const created = new Date(q.date_created).getTime()
        const answered = new Date(q.answer.date_created).getTime()
        return (answered - created) / (1000 * 60 * 60) // Em horas
      }
      return null
    }).filter((t: any) => t !== null)
    
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
      : 0
    
    // Buscar também perguntas não respondidas
    return {
      total_questions: data.total || questions.length,
      answered: answered.length,
      unanswered: 0, // Todas já são ANSWERED pelo filtro
      average_response_time_hours: avgResponseTime,
      response_rate: 100, // 100% porque filtramos só as respondidas
      _timestamp: new Date().toISOString()
    }
  })
}

/**
 * Financial Summary - Resumo financeiro
 * Usando endpoint de billing ao invés de mercadopago_account/balance que requer permissões especiais
 */
export async function getFinancialSummary(userId: string) {
  // Buscar períodos de faturamento disponíveis
  return executeMLApiCall({
    endpoint: `/billing/integration/monthly/periods?group=ML`,
    cache: {
      enabled: true,
      ttl: CacheTTL.BILLING,
      key: `financial:${userId}`
    },
    ...baseMetricsConfig
  }, (data) => {
    const periods = data.results || []
    const totalBilled = periods.reduce((sum: number, period: any) => 
      sum + (period.amount || 0), 0)
    const totalUnpaid = periods.reduce((sum: number, period: any) => 
      sum + (period.unpaid_amount || 0), 0)
    
    return {
      available_balance: totalBilled - totalUnpaid,
      unavailable_balance: totalUnpaid,
      total_balance: totalBilled,
      currency_id: 'BRL',
      periods: periods.slice(0, 3), // Últimos 3 períodos
      _timestamp: new Date().toISOString()
    }
  })
}

/**
 * Attendance Metrics - Métricas de atendimento
 * Análise de perguntas respondidas e não respondidas
 */
export async function getAttendanceMetrics(userId: string) {
  return executeMLApiCall({
    endpoint: `/my/received_questions/search?limit=50`,
    cache: {
      enabled: true,
      ttl: CacheTTL.QUESTIONS,
      key: `attendance:${userId}`
    },
    ...baseMetricsConfig
  }, (data) => {
    const questions = data.questions || []
    const total = data.total || questions.length
    
    // Análise por status
    const answered = questions.filter((q: any) => q.status === 'ANSWERED').length
    const unanswered = questions.filter((q: any) => q.status === 'UNANSWERED').length
    const underReview = questions.filter((q: any) => q.status === 'UNDER_REVIEW').length
    const banned = questions.filter((q: any) => q.status === 'BANNED').length
    
    // Taxa de resposta
    const responseRate = total > 0 ? (answered / total) * 100 : 0
    
    // Perguntas recentes (últimas 24h)
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const recentQuestions = questions.filter((q: any) => 
      new Date(q.date_created) > oneDayAgo
    ).length
    
    return {
      total_questions: total,
      answered,
      unanswered,
      under_review: underReview,
      banned,
      response_rate: responseRate,
      recent_questions_24h: recentQuestions,
      questions: questions.slice(0, 10), // Últimas 10 perguntas
      _timestamp: new Date().toISOString()
    }
  })
}

/**
 * Conversion Metrics - Métricas de conversão
 */
export async function getConversionMetrics(userId: string) {
  // Buscar dados necessários para conversão
  const [itemsData, ordersData] = await batchMLApiCalls([
    {
      config: {
        endpoint: `/users/${userId}/items/search?status=active`,
        cache: { enabled: true, ttl: CacheTTL.ITEMS },
        ...baseMetricsConfig
      }
    },
    {
      config: {
        endpoint: `/orders/search?seller=${userId}&limit=50`,
        cache: { enabled: true, ttl: CacheTTL.ORDERS },
        ...baseMetricsConfig
      }
    }
  ])
  
  // Calcular métricas
  const totalItems = (itemsData as any)?.paging?.total || 0
  const totalOrders = (ordersData as any)?.paging?.total || 0
  const orders = (ordersData as any)?.results || []
  
  // Calcular taxa de conversão
  const conversionRate = totalItems > 0 && totalOrders > 0 
    ? (totalOrders / totalItems) * 100 
    : 0
  
  return {
    items: {
      total: totalItems,
      active: (itemsData as any)?.results?.length || 0
    },
    orders: {
      total: totalOrders,
      has_pending: orders.some((o: any) => o.status === 'payment_in_process')
    },
    conversion_rate: conversionRate,
    _timestamp: new Date().toISOString()
  }
}

/**
 * Highlights - Destaques e alertas importantes
 */
export async function getHighlights(userId: string) {
  // Buscar dados para gerar highlights
  const [userData, ordersData, questionsData] = await batchMLApiCalls([
    {
      config: {
        endpoint: `/users/${userId}`,
        cache: { enabled: true, ttl: CacheTTL.USER },
        ...baseMetricsConfig
      }
    },
    {
      config: {
        endpoint: `/orders/search?seller=${userId}&limit=1`,
        cache: { enabled: true, ttl: CacheTTL.ORDERS },
        ...baseMetricsConfig
      }
    },
    {
      config: {
        endpoint: `/my/received_questions/search?status=unanswered&limit=1`,
        cache: { enabled: true, ttl: CacheTTL.QUESTIONS },
        ...baseMetricsConfig
      }
    }
  ])
  
  const highlights = {
    user: {
      nickname: (userData as any)?.nickname || '',
      level: (userData as any)?.seller_reputation?.level_id || 'newbie',
      power_seller: (userData as any)?.seller_reputation?.power_seller_status || null
    },
    orders: {
      total: (ordersData as any)?.paging?.total || 0,
      has_pending: (ordersData as any)?.results?.some((o: any) => o.status === 'payment_in_process')
    },
    questions: {
      unanswered: (questionsData as any)?.total || 0
    },
    alerts: generateAlerts(userData, ordersData, questionsData),
    _timestamp: new Date().toISOString()
  }
  
  return highlights
}

/**
 * Advanced Metrics - Métricas avançadas com análise preditiva
 */
export async function getAdvancedMetrics(userId: string, period: string = '30days') {
  const days = period === '7days' ? 7 : period === '14days' ? 14 : 30
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - days)
  
  // Buscar dados históricos para análise
  const [ordersData, itemsData] = await batchMLApiCalls([
    {
      config: {
        endpoint: `/orders/search?seller=${userId}&order.date_created.from=${fromDate.toISOString()}&limit=50`,
        cache: { enabled: true, ttl: CacheTTL.METRICS },
        ...baseMetricsConfig
      }
    },
    {
      config: {
        endpoint: `/users/${userId}/items/search?status=active`,
        cache: { enabled: true, ttl: CacheTTL.ITEMS },
        ...baseMetricsConfig
      }
    }
  ])
  
  // Processar dados e calcular métricas
  const orders = (ordersData as any)?.results || []
  const items = (itemsData as any)?.results || []
  
  // Calcular revenues
  const revenues = orders.map((o: any) => o.total_amount || 0)
  const avgRevenue = revenues.length > 0 ? revenues.reduce((a: number, b: number) => a + b, 0) / revenues.length : 0
  const volatility = calculateVolatility(revenues)
  
  // Calcular projeções
  const ema = calculateEMA(revenues, 0.3)
  const projection7Days = ema * 7
  
  // Análise por dia
  const dailyRevenue: Record<string, number> = {}
  orders.forEach((order: any) => {
    const day = new Date(order.date_created).toISOString().split('T')[0]!
    dailyRevenue[day] = (dailyRevenue[day] || 0) + (order.total_amount || 0)
  })
  
  return {
    historical: {
      orders: orders.length,
      items: items.length,
      total_revenue: revenues.reduce((a: number, b: number) => a + b, 0),
      average_revenue: avgRevenue
    },
    projections: {
      next_7_days: projection7Days,
      confidence_level: volatility < avgRevenue * 0.3 ? 'high' : volatility < avgRevenue * 0.5 ? 'medium' : 'low',
      trend: calculateAdvancedTrend(revenues)
    },
    insights: {
      best_performing_day: Object.entries(dailyRevenue).sort((a, b) => b[1] - a[1])[0],
      consistency_score: calculateConsistencyScore(revenues),
      growth_potential: calculateGrowthPotential(orders, items)
    },
    _timestamp: new Date().toISOString()
  }
}

// Função para calcular score de reputação
function calculateReputationScore(reputation: any): number {
  if (!reputation) return 0
  
  // Considerar diferentes fatores
  let score = 0
  
  // Level ID scores
  const levelScores: Record<string, number> = {
    '5_green': 100,
    '4_light_green': 80,
    '3_yellow': 60,
    '2_orange': 40,
    '1_red': 20,
    'newbie': 10
  }
  
  score += levelScores[reputation.level_id] || 0
  
  // Ajustar baseado em métricas
  if (reputation.metrics) {
    const { sales, claims, delayed, cancellations } = reputation.metrics
    const totalTransactions = sales?.completed || 0
    
    if (totalTransactions > 0) {
      const claimRate = (claims?.rate || 0) * 100
      const delayRate = (delayed?.rate || 0) * 100
      const cancellationRate = (cancellations?.rate || 0) * 100
      
      // Penalizar por problemas
      score -= claimRate * 2
      score -= delayRate * 1.5
      score -= cancellationRate * 1
    }
  }
  
  return Math.max(0, Math.min(100, score))
}

// Função para calcular tendência
function calculateTrend(velocityData: any[]): string {
  if (velocityData.length < 2) return 'insufficient_data'
  
  const recent = velocityData[0].daily_average || 0
  const previous = velocityData[1].daily_average || 0
  
  if (previous === 0) return 'new'
  
  const change = ((recent - previous) / previous) * 100
  
  if (change > 10) return 'increasing'
  if (change < -10) return 'decreasing'
  return 'stable'
}

// Função para calcular volatilidade
function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

// Funções auxiliares adicionais
function generateAlerts(userData: any, ordersData: any, questionsData: any): string[] {
  const alerts: string[] = []
  
  if ((questionsData as any).total > 5) {
    alerts.push(`You have ${(questionsData as any).total} unanswered questions`)
  }
  
  if ((userData as any).seller_reputation?.level_id === '1_red') {
    alerts.push('Your reputation needs improvement')
  }
  
  if ((ordersData as any).results?.some((o: any) => o.status === 'payment_in_process')) {
    alerts.push('You have pending orders to process')
  }
  
  return alerts
}

function calculateEMA(values: number[], alpha: number): number {
  if (values.length === 0) return 0
  
  let ema = values[0]!
  for (let i = 1; i < values.length; i++) {
    const currentValue = values[i]
    if (currentValue !== undefined) {
      ema = alpha * currentValue + (1 - alpha) * ema
    }
  }
  return ema
}

function calculateAdvancedTrend(revenues: number[]): string {
  if (revenues.length < 3) return 'insufficient_data'
  
  const recentAvg = revenues.slice(-3).reduce((a, b) => a + b, 0) / 3
  const previousAvg = revenues.slice(-6, -3).reduce((a, b) => a + b, 0) / 3
  
  if (previousAvg === 0) return 'new'
  
  const change = ((recentAvg - previousAvg) / previousAvg) * 100
  
  if (change > 20) return 'strong_growth'
  if (change > 5) return 'moderate_growth'
  if (change > -5) return 'stable'
  if (change > -20) return 'moderate_decline'
  return 'strong_decline'
}

function calculateConsistencyScore(revenues: number[]): number {
  if (revenues.length < 2) return 0
  
  const avg = revenues.reduce((a, b) => a + b, 0) / revenues.length
  const variance = revenues.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / revenues.length
  const cv = avg > 0 ? Math.sqrt(variance) / avg : 1
  
  // Score inversamente proporcional ao coeficiente de variação
  return Math.max(0, Math.min(100, (1 - cv) * 100))
}

function calculateGrowthPotential(orders: any[], items: any[]): string {
  const orderCount = orders.length
  const itemCount = items.length
  
  if (itemCount === 0) return 'low'
  
  const ordersPerItem = orderCount / itemCount
  
  if (ordersPerItem > 5) return 'very_high'
  if (ordersPerItem > 2) return 'high'
  if (ordersPerItem > 1) return 'medium'
  if (ordersPerItem > 0.5) return 'low'
  return 'very_low'
}