import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

// Análise de perguntas com alto potencial de conversão
async function getHighValueQuestions(accessToken: string, userId: string) {
  try {
    // Buscar perguntas não respondidas
    const unansweredResponse = await fetch(
      `https://api.mercadolibre.com/questions/search?seller_id=${userId}&status=UNANSWERED&limit=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )
    
    if (!unansweredResponse.ok) return null
    const unansweredData = await unansweredResponse.json()
    const unansweredQuestions = unansweredData.questions || []
    
    // Buscar histórico de vendas dos últimos 90 dias
    const endDate = new Date()
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    
    const ordersResponse = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${userId}&order.date_created.from=${startDate.toISOString()}&order.date_created.to=${endDate.toISOString()}&limit=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )
    
    if (!ordersResponse.ok) return null
    const ordersData = await ordersResponse.json()
    const orders = ordersData.results || []
    
    // Identificar compradores recorrentes
    const buyerPurchaseHistory: Record<string, number> = {}
    const buyerSpentHistory: Record<string, number> = {}
    
    orders.forEach((order: any) => {
      const buyerId = order.buyer?.id
      if (buyerId) {
        buyerPurchaseHistory[buyerId] = (buyerPurchaseHistory[buyerId] || 0) + 1
        buyerSpentHistory[buyerId] = (buyerSpentHistory[buyerId] || 0) + (order.total_amount || 0)
      }
    })
    
    // Classificar perguntas por potencial de conversão
    const classifiedQuestions = unansweredQuestions.map((q: any) => {
      const askerId = q.from?.id
      const purchaseCount = buyerPurchaseHistory[askerId] || 0
      const totalSpent = buyerSpentHistory[askerId] || 0
      
      let priority = 'low'
      let reason = 'Novo cliente'
      
      if (purchaseCount > 2) {
        priority = 'critical'
        reason = `Cliente VIP - ${purchaseCount} compras anteriores`
      } else if (purchaseCount > 0) {
        priority = 'high'
        reason = `Cliente recorrente - R$ ${totalSpent.toFixed(2)} gasto`
      } else if (q.text?.toLowerCase().includes('hoje') || q.text?.toLowerCase().includes('urgente')) {
        priority = 'high'
        reason = 'Compra urgente detectada'
      } else if (q.text?.toLowerCase().includes('quantidade') || q.text?.toLowerCase().includes('atacado')) {
        priority = 'high'
        reason = 'Possível compra em volume'
      }
      
      // Calcular tempo sem resposta
      const hoursWaiting = Math.floor((Date.now() - new Date(q.date_created).getTime()) / (1000 * 60 * 60))
      
      return {
        id: q.id,
        text: q.text,
        itemId: q.item_id,
        dateCreated: q.date_created,
        hoursWaiting,
        buyer: {
          id: askerId,
          isRecurrent: purchaseCount > 0,
          purchaseCount,
          totalSpent: totalSpent.toFixed(2)
        },
        priority,
        reason,
        estimatedValue: purchaseCount > 0 ? (totalSpent / purchaseCount).toFixed(2) : '0'
      }
    })
    
    // Ordenar por prioridade
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    classifiedQuestions.sort((a: any, b: any) => 
      priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]
    )
    
    // Calcular valor potencial das perguntas não respondidas
    const totalPotentialValue = classifiedQuestions.reduce((sum: number, q: any) => 
      sum + parseFloat(q.estimatedValue || '0'), 0
    )
    
    return {
      total: classifiedQuestions.length,
      critical: classifiedQuestions.filter((q: any) => q.priority === 'critical').length,
      high: classifiedQuestions.filter((q: any) => q.priority === 'high').length,
      potentialRevenue: totalPotentialValue.toFixed(2),
      vipWaiting: classifiedQuestions.filter((q: any) => q.buyer.purchaseCount > 2).length,
      questions: classifiedQuestions.slice(0, 10)
    }
  } catch (error) {
    console.error('Error analyzing questions:', error)
    return null
  }
}

// Análise de eficácia de respostas
async function getResponseEffectiveness(accessToken: string, userId: string) {
  try {
    const endDate = new Date()
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    // Buscar perguntas respondidas
    const answeredResponse = await fetch(
      `https://api.mercadolibre.com/questions/search?seller_id=${userId}&status=ANSWERED&date_created_from=${startDate.toISOString()}&date_created_to=${endDate.toISOString()}&limit=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )
    
    if (!answeredResponse.ok) return null
    const answeredData = await answeredResponse.json()
    const answeredQuestions = answeredData.questions || []
    
    // Buscar vendas do mesmo período
    const ordersResponse = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${userId}&order.date_created.from=${startDate.toISOString()}&order.date_created.to=${endDate.toISOString()}&limit=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )
    
    if (!ordersResponse.ok) return null
    const ordersData = await ordersResponse.json()
    const orders = ordersData.results || []
    
    // Mapear quem perguntou e quem comprou
    const askerToItem: Record<string, Set<string>> = {}
    const buyerToItem: Record<string, Set<string>> = {}
    
    answeredQuestions.forEach((q: any) => {
      const askerId = q.from?.id
      const itemId = q.item_id
      if (askerId && itemId) {
        if (!askerToItem[askerId]) askerToItem[askerId] = new Set()
        askerToItem[askerId].add(itemId)
      }
    })
    
    orders.forEach((order: any) => {
      const buyerId = order.buyer?.id
      order.order_items?.forEach((item: any) => {
        const itemId = item.item?.id
        if (buyerId && itemId) {
          if (!buyerToItem[buyerId]) buyerToItem[buyerId] = new Set()
          buyerToItem[buyerId].add(itemId)
        }
      })
    })
    
    // Calcular conversões
    let questionsConverted = 0
    let totalResponseTime = 0
    let responseCount = 0
    
    answeredQuestions.forEach((q: any) => {
      const askerId = q.from?.id
      const itemId = q.item_id
      
      // Verificar se quem perguntou comprou
      if (askerId && itemId && buyerToItem[askerId]?.has(itemId)) {
        questionsConverted++
      }
      
      // Calcular tempo de resposta
      if (q.answer?.date_created && q.date_created) {
        const responseTime = new Date(q.answer.date_created).getTime() - new Date(q.date_created).getTime()
        totalResponseTime += responseTime
        responseCount++
      }
    })
    
    const conversionRate = answeredQuestions.length > 0 
      ? (questionsConverted / answeredQuestions.length) * 100 
      : 0
      
    const avgResponseHours = responseCount > 0 
      ? Math.floor(totalResponseTime / responseCount / (1000 * 60 * 60))
      : 0
    
    // Calcular taxa de resposta rápida (< 1 hora)
    let fastResponses = 0
    answeredQuestions.forEach((q: any) => {
      if (q.answer?.date_created && q.date_created) {
        const responseTime = new Date(q.answer.date_created).getTime() - new Date(q.date_created).getTime()
        if (responseTime < 60 * 60 * 1000) { // menos de 1 hora
          fastResponses++
        }
      }
    })
    
    const fastResponseRate = answeredQuestions.length > 0 
      ? (fastResponses / answeredQuestions.length) * 100
      : 0
    
    return {
      totalAnswered: answeredQuestions.length,
      converted: questionsConverted,
      conversionRate: conversionRate.toFixed(1),
      avgResponseTime: `${avgResponseHours}h`,
      fastResponseRate: fastResponseRate.toFixed(1),
      potentialLost: answeredQuestions.length - questionsConverted,
      revenueFromQuestions: orders.filter((o: any) => 
        [...askerToItem.keys()].includes(o.buyer?.id)
      ).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0).toFixed(2),
      effectiveness: conversionRate > 20 ? 'excellent' : conversionRate > 10 ? 'good' : 'needs_improvement'
    }
  } catch (error) {
    console.error('Error analyzing response effectiveness:', error)
    return null
  }
}

// Análise de padrões de perguntas
async function getQuestionPatterns(accessToken: string, userId: string) {
  try {
    // Buscar todas as perguntas dos últimos 30 dias
    const endDate = new Date()
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    const questionsResponse = await fetch(
      `https://api.mercadolibre.com/questions/search?seller_id=${userId}&date_created_from=${startDate.toISOString()}&date_created_to=${endDate.toISOString()}&limit=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )
    
    if (!questionsResponse.ok) return null
    const questionsData = await questionsResponse.json()
    const questions = questionsData.questions || []
    
    // Análise por hora do dia
    const questionsByHour: Record<number, number> = {}
    for (let i = 0; i < 24; i++) questionsByHour[i] = 0
    
    // Análise por item
    const questionsByItem: Record<string, { count: number, title?: string }> = {}
    
    // Palavras-chave mais comuns
    const keywords: Record<string, number> = {}
    const commonTerms = ['preço', 'frete', 'entrega', 'prazo', 'desconto', 'quantidade', 'cor', 'tamanho', 'garantia', 'original']
    
    questions.forEach((q: any) => {
      // Por hora
      const hour = new Date(q.date_created).getHours()
      questionsByHour[hour]++
      
      // Por item
      if (!questionsByItem[q.item_id]) {
        questionsByItem[q.item_id] = { count: 0 }
      }
      questionsByItem[q.item_id].count++
      
      // Análise de texto
      const text = q.text?.toLowerCase() || ''
      commonTerms.forEach(term => {
        if (text.includes(term)) {
          keywords[term] = (keywords[term] || 0) + 1
        }
      })
    })
    
    // Identificar picos
    const peakHour = Object.entries(questionsByHour).reduce((a, b) => b[1] > a[1] ? b : a)
    
    // Items problemáticos (muitas perguntas)
    const problematicItems = Object.entries(questionsByItem)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([itemId, data]) => ({
        itemId,
        questionCount: data.count,
        avgPerDay: (data.count / 30).toFixed(1)
      }))
    
    // Top keywords
    const topKeywords = Object.entries(keywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword, count]) => ({
        keyword,
        count,
        percentage: ((count / questions.length) * 100).toFixed(1)
      }))
    
    return {
      totalQuestions: questions.length,
      avgPerDay: (questions.length / 30).toFixed(1),
      peakHour: `${peakHour[0]}h (${peakHour[1]} perguntas)`,
      problematicItems,
      topConcerns: topKeywords,
      recommendation: generateAttendanceRecommendation(peakHour[0], topKeywords[0]?.keyword)
    }
  } catch (error) {
    console.error('Error analyzing patterns:', error)
    return null
  }
}

function generateAttendanceRecommendation(peakHour: string, topConcern?: string) {
  const recommendations = []
  
  recommendations.push({
    type: 'schedule',
    message: `Priorize atendimento às ${peakHour} - horário de pico`,
    impact: 'high'
  })
  
  if (topConcern === 'frete' || topConcern === 'entrega') {
    recommendations.push({
      type: 'description',
      message: 'Adicione informações de frete mais claras nas descrições',
      impact: 'medium'
    })
  } else if (topConcern === 'preço' || topConcern === 'desconto') {
    recommendations.push({
      type: 'pricing',
      message: 'Considere criar promoções ou mostrar comparativo de preços',
      impact: 'high'
    })
  }
  
  return recommendations
}

// Cálculo de perda por não responder
async function calculateLostRevenue(accessToken: string, userId: string) {
  try {
    // Buscar perguntas não respondidas que expiraram (mais de 3 dias)
    const expiredDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    
    const unansweredResponse = await fetch(
      `https://api.mercadolibre.com/questions/search?seller_id=${userId}&status=UNANSWERED&date_created_to=${expiredDate.toISOString()}&limit=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )
    
    if (!unansweredResponse.ok) return null
    const unansweredData = await unansweredResponse.json()
    const expiredQuestions = unansweredData.questions || []
    
    // Buscar preço médio dos items
    let totalPotentialRevenue = 0
    const itemPrices: Record<string, number> = {}
    
    for (const q of expiredQuestions.slice(0, 20)) {
      if (!itemPrices[q.item_id]) {
        try {
          const itemResponse = await fetch(
            `https://api.mercadolibre.com/items/${q.item_id}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` }
            }
          )
          if (itemResponse.ok) {
            const item = await itemResponse.json()
            itemPrices[q.item_id] = item.price || 0
          }
        } catch (e) {
          console.error(`Error fetching item ${q.item_id}:`, e)
        }
      }
      totalPotentialRevenue += itemPrices[q.item_id] || 0
    }
    
    // Estimativa baseada em taxa de conversão média de 15%
    const estimatedLoss = totalPotentialRevenue * 0.15
    
    return {
      expiredQuestions: expiredQuestions.length,
      potentialRevenue: totalPotentialRevenue.toFixed(2),
      estimatedLoss: estimatedLoss.toFixed(2),
      avgLossPerQuestion: expiredQuestions.length > 0 
        ? (estimatedLoss / expiredQuestions.length).toFixed(2)
        : '0'
    }
  } catch (error) {
    console.error('Error calculating lost revenue:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    // Get user info
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    })

    if (!userResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch user" }, { status: 401 })
    }

    const user = await userResponse.json()
    const userId = user.id

    // Executar todas as análises em paralelo
    const [highValueQuestions, effectiveness, patterns, lostRevenue] = await Promise.all([
      getHighValueQuestions(auth.accessToken, userId),
      getResponseEffectiveness(auth.accessToken, userId),
      getQuestionPatterns(auth.accessToken, userId),
      calculateLostRevenue(auth.accessToken, userId)
    ])
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        priority: highValueQuestions,
        effectiveness,
        patterns,
        lostRevenue,
        summary: {
          requiresUrgentAction: (highValueQuestions?.critical || 0) > 0,
          estimatedDailyLoss: lostRevenue?.estimatedLoss 
            ? (parseFloat(lostRevenue.estimatedLoss) / 30).toFixed(2)
            : '0',
          overallHealth: calculateHealthScore(highValueQuestions, effectiveness, lostRevenue)
        }
      }
    })
    
  } catch (error) {
    console.error('Error in attendance metrics endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch attendance metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function calculateHealthScore(questions: any, effectiveness: any, lostRevenue: any) {
  let score = 100
  
  // Penalizar por perguntas críticas não respondidas
  if (questions?.critical > 0) score -= questions.critical * 10
  if (questions?.high > 3) score -= questions.high * 3
  
  // Penalizar por baixa taxa de conversão
  const conversionRate = parseFloat(effectiveness?.conversionRate || '0')
  if (conversionRate < 10) score -= 20
  else if (conversionRate < 20) score -= 10
  
  // Penalizar por perda de receita
  const loss = parseFloat(lostRevenue?.estimatedLoss || '0')
  if (loss > 1000) score -= 15
  else if (loss > 500) score -= 10
  
  score = Math.max(0, Math.min(100, score))
  
  if (score >= 80) return { score, status: 'excellent', color: '#4ADE80' }
  if (score >= 60) return { score, status: 'good', color: '#FFE600' }
  if (score >= 40) return { score, status: 'attention', color: '#FB923C' }
  return { score, status: 'critical', color: '#F87171' }
}