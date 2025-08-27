import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

// Função para calcular métricas de engajamento avançadas
async function getEngagementMetrics(accessToken: string, userId: string) {
  const endDate = new Date()
  const startDate7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const startDate30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  try {
    // Buscar todos os items ativos
    const itemsResponse = await fetch(
      `https://api.mercadolibre.com/users/${userId}/items/search?status=active`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )
    
    if (!itemsResponse.ok) return null
    const itemsData = await itemsResponse.json()
    const itemIds = itemsData.results || []
    
    if (itemIds.length === 0) return null
    
    // Buscar visitas detalhadas por item (últimos 30 dias)
    const visitsPromises = itemIds.slice(0, 20).map(async (itemId: string) => {
      try {
        const response = await fetch(
          `https://api.mercadolibre.com/items/${itemId}/visits/time_window?last=30&unit=day`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        )
        if (response.ok) {
          const data = await response.json()
          return { itemId, data }
        }
      } catch (e) {
        console.error(`Error fetching visits for ${itemId}:`, e)
      }
      return null
    })
    
    const visitsResults = await Promise.all(visitsPromises)
    const validVisits = visitsResults.filter(v => v !== null)
    
    // Calcular métricas de visitas
    let totalVisits30Days = 0
    let totalVisits7Days = 0
    let todayVisits = 0
    let bestPerformingItem = { id: '', visits: 0, title: '' }
    let worstPerformingItem = { id: '', visits: Infinity, title: '' }
    
    for (const visit of validVisits) {
      if (visit?.data) {
        totalVisits30Days += visit.data.total_visits || 0
        
        // Calcular visitas dos últimos 7 dias
        const last7Days = visit.data.results?.slice(-7) || []
        const visits7Days = last7Days.reduce((sum: number, day: any) => sum + (day.total || 0), 0)
        totalVisits7Days += visits7Days
        
        // Visitas de hoje
        const todayData = visit.data.results?.[visit.data.results.length - 1]
        todayVisits += todayData?.total || 0
        
        // Identificar melhor e pior item
        if (visit.data.total_visits > bestPerformingItem.visits) {
          bestPerformingItem = {
            id: visit.itemId,
            visits: visit.data.total_visits,
            title: ''
          }
        }
        if (visit.data.total_visits < worstPerformingItem.visits) {
          worstPerformingItem = {
            id: visit.itemId,
            visits: visit.data.total_visits,
            title: ''
          }
        }
      }
    }
    
    // Taxa de crescimento semanal
    const previousWeekVisits = totalVisits30Days - totalVisits7Days
    const growthRate = previousWeekVisits > 0 
      ? ((totalVisits7Days - previousWeekVisits) / previousWeekVisits) * 100
      : 0
    
    return {
      visits: {
        today: todayVisits,
        last7Days: totalVisits7Days,
        last30Days: totalVisits30Days,
        dailyAverage: Math.round(totalVisits30Days / 30),
        weeklyGrowthRate: growthRate.toFixed(1),
        bestPerformingItem,
        worstPerformingItem,
        itemsAnalyzed: validVisits.length
      }
    }
  } catch (error) {
    console.error('Error calculating engagement metrics:', error)
    return null
  }
}

// Função para calcular métricas de qualidade dos anúncios
async function getListingQualityMetrics(accessToken: string, userId: string) {
  try {
    const itemsResponse = await fetch(
      `https://api.mercadolibre.com/users/${userId}/items/search?status=active&limit=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )
    
    if (!itemsResponse.ok) return null
    const itemsData = await itemsResponse.json()
    const itemIds = itemsData.results || []
    
    if (itemIds.length === 0) return null
    
    // Buscar detalhes de cada item
    const itemDetailsPromises = itemIds.slice(0, 20).map(async (itemId: string) => {
      try {
        const response = await fetch(
          `https://api.mercadolibre.com/items/${itemId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        )
        if (response.ok) {
          return await response.json()
        }
      } catch (e) {
        console.error(`Error fetching item ${itemId}:`, e)
      }
      return null
    })
    
    const items = await Promise.all(itemDetailsPromises)
    const validItems = items.filter(item => item !== null)
    
    // Analisar qualidade dos anúncios
    let totalWithVideo = 0
    let totalPremiumListings = 0
    let totalWithShipping = 0
    let totalWithWarranty = 0
    let avgPicturesCount = 0
    let totalDescriptionLength = 0
    let catalogProducts = 0
    let itemsWithoutDescription = 0
    
    for (const item of validItems) {
      // Verificar vídeo
      if (item.video_id) totalWithVideo++
      
      // Verificar tipo de anúncio premium
      if (['gold_special', 'gold_pro', 'gold_premium'].includes(item.listing_type_id)) {
        totalPremiumListings++
      }
      
      // Verificar frete
      if (item.shipping?.free_shipping || item.shipping?.mode) totalWithShipping++
      
      // Verificar garantia
      if (item.warranty && item.warranty !== 'Sem garantia') totalWithWarranty++
      
      // Contar fotos
      avgPicturesCount += item.pictures?.length || 0
      
      // Tamanho da descrição
      if (item.descriptions?.length > 0) {
        totalDescriptionLength += item.descriptions[0].plain_text?.length || 0
      } else {
        itemsWithoutDescription++
      }
      
      // Produto de catálogo
      if (item.catalog_product_id) catalogProducts++
    }
    
    const avgPictures = validItems.length > 0 ? (avgPicturesCount / validItems.length).toFixed(1) : 0
    const avgDescriptionLength = validItems.length > 0 
      ? Math.round(totalDescriptionLength / (validItems.length - itemsWithoutDescription))
      : 0
    
    // Calcular score de qualidade (0-100)
    let qualityScore = 0
    const scoreFactors = {
      hasVideo: (totalWithVideo / validItems.length) * 15,
      isPremium: (totalPremiumListings / validItems.length) * 20,
      hasShipping: (totalWithShipping / validItems.length) * 15,
      hasWarranty: (totalWithWarranty / validItems.length) * 10,
      goodPictures: Math.min((avgPicturesCount / validItems.length) / 6 * 20, 20),
      hasDescription: ((validItems.length - itemsWithoutDescription) / validItems.length) * 10,
      isCatalog: (catalogProducts / validItems.length) * 10
    }
    
    qualityScore = Object.values(scoreFactors).reduce((sum, score) => sum + score, 0)
    
    return {
      quality: {
        overallScore: Math.round(qualityScore),
        metrics: {
          withVideo: { count: totalWithVideo, percentage: ((totalWithVideo / validItems.length) * 100).toFixed(1) },
          premiumListings: { count: totalPremiumListings, percentage: ((totalPremiumListings / validItems.length) * 100).toFixed(1) },
          withShipping: { count: totalWithShipping, percentage: ((totalWithShipping / validItems.length) * 100).toFixed(1) },
          withWarranty: { count: totalWithWarranty, percentage: ((totalWithWarranty / validItems.length) * 100).toFixed(1) },
          catalogProducts: { count: catalogProducts, percentage: ((catalogProducts / validItems.length) * 100).toFixed(1) },
          averagePictures: avgPictures,
          averageDescriptionLength: avgDescriptionLength,
          withoutDescription: itemsWithoutDescription
        },
        recommendations: generateRecommendations(scoreFactors, validItems.length, itemsWithoutDescription, avgPictures)
      }
    }
  } catch (error) {
    console.error('Error calculating quality metrics:', error)
    return null
  }
}

// Gerar recomendações baseadas nas métricas
function generateRecommendations(scoreFactors: any, totalItems: number, itemsWithoutDescription: number, avgPictures: any) {
  const recommendations = []
  
  if (scoreFactors.hasVideo < 5) {
    recommendations.push({
      priority: 'high',
      action: 'Adicione vídeos aos seus anúncios',
      impact: 'Anúncios com vídeo vendem 23% mais rápido'
    })
  }
  
  if (scoreFactors.isPremium < 10) {
    recommendations.push({
      priority: 'high', 
      action: 'Migre para anúncios Premium (Gold)',
      impact: 'Aumente sua visibilidade em até 5x'
    })
  }
  
  if (itemsWithoutDescription > totalItems * 0.2) {
    recommendations.push({
      priority: 'medium',
      action: 'Adicione descrições detalhadas',
      impact: 'Melhore a conversão em até 15%'
    })
  }
  
  if (parseFloat(avgPictures) < 4) {
    recommendations.push({
      priority: 'medium',
      action: 'Adicione mais fotos (mínimo 6)',
      impact: 'Anúncios com 6+ fotos vendem 40% mais'
    })
  }
  
  if (scoreFactors.hasShipping < 10) {
    recommendations.push({
      priority: 'low',
      action: 'Ofereça opções de envio',
      impact: 'Alcance compradores de todo o país'
    })
  }
  
  return recommendations
}

// Função para calcular métricas de competitividade
async function getCompetitiveMetrics(accessToken: string, userId: string) {
  try {
    // Buscar items ativos do vendedor
    const itemsResponse = await fetch(
      `https://api.mercadolibre.com/users/${userId}/items/search?status=active&limit=10`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )
    
    if (!itemsResponse.ok) return null
    const itemsData = await itemsResponse.json()
    const itemIds = itemsData.results || []
    
    if (itemIds.length === 0) return null
    
    // Analisar competitividade de cada item
    const competitiveAnalysis = []
    
    for (const itemId of itemIds.slice(0, 5)) {
      try {
        // Buscar detalhes do item
        const itemResponse = await fetch(
          `https://api.mercadolibre.com/items/${itemId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        )
        
        if (!itemResponse.ok) continue
        const item = await itemResponse.json()
        
        // Buscar items similares na categoria
        const searchResponse = await fetch(
          `https://api.mercadolibre.com/sites/MLB/search?category=${item.category_id}&limit=20`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        )
        
        if (!searchResponse.ok) continue
        const searchData = await searchResponse.json()
        const competitors = searchData.results || []
        
        // Calcular métricas competitivas
        const prices = competitors.map((c: any) => c.price).filter((p: number) => p > 0)
        const avgPrice = prices.length > 0 ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0
        
        const pricePosition = item.price < avgPrice ? 'below_average' : item.price > avgPrice ? 'above_average' : 'average'
        const priceCompetitiveness = avgPrice > 0 ? ((avgPrice - item.price) / avgPrice * 100).toFixed(1) : 0
        
        // Calcular posição no ranking
        const betterPricedCompetitors = competitors.filter((c: any) => c.price < item.price && c.price > 0).length
        const rankingPosition = betterPricedCompetitors + 1
        
        competitiveAnalysis.push({
          itemId: item.id,
          title: item.title.substring(0, 50) + '...',
          price: item.price,
          marketAnalysis: {
            avgPrice: avgPrice.toFixed(2),
            minPrice: minPrice.toFixed(2),
            maxPrice: maxPrice.toFixed(2),
            pricePosition,
            priceCompetitiveness: `${priceCompetitiveness}%`,
            rankingPosition,
            totalCompetitors: competitors.length,
            recommendation: generatePriceRecommendation(item.price, avgPrice, minPrice, pricePosition)
          }
        })
      } catch (e) {
        console.error(`Error analyzing competition for ${itemId}:`, e)
      }
    }
    
    return {
      competitive: {
        analyzedItems: competitiveAnalysis.length,
        items: competitiveAnalysis
      }
    }
  } catch (error) {
    console.error('Error calculating competitive metrics:', error)
    return null
  }
}

function generatePriceRecommendation(price: number, avgPrice: number, minPrice: number, position: string) {
  if (position === 'above_average' && price > avgPrice * 1.2) {
    return 'Preço muito acima da média - considere reduzir para aumentar vendas'
  } else if (position === 'below_average' && price < avgPrice * 0.8) {
    return 'Preço competitivo - destaque outros diferenciais'
  } else if (position === 'average') {
    return 'Preço na média do mercado - adicione valor com frete grátis ou garantia'
  }
  return 'Preço adequado ao mercado'
}

// Função para calcular métricas de velocidade de vendas
async function getSalesVelocityMetrics(accessToken: string, userId: string) {
  try {
    const endDate = new Date()
    const startDate30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const startDate7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const startDateToday = new Date()
    startDateToday.setHours(0, 0, 0, 0)
    
    // Buscar vendas dos últimos 30 dias
    const ordersResponse = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${userId}&order.date_created.from=${startDate30Days.toISOString()}&order.date_created.to=${endDate.toISOString()}&order.status=paid`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )
    
    if (!ordersResponse.ok) return null
    const ordersData = await ordersResponse.json()
    const orders = ordersData.results || []
    
    // Calcular métricas por período
    let salesToday = 0
    let salesLast7Days = 0
    let salesLast30Days = orders.length
    let revenueToday = 0
    let revenueLast7Days = 0
    let revenueLast30Days = 0
    
    // Análise por hora do dia
    const salesByHour: Record<number, number> = {}
    for (let i = 0; i < 24; i++) salesByHour[i] = 0
    
    // Análise por dia da semana
    const salesByDayOfWeek: Record<number, number> = {}
    for (let i = 0; i < 7; i++) salesByDayOfWeek[i] = 0
    
    // Items mais vendidos
    const itemSales: Record<string, any> = {}
    
    for (const order of orders) {
      const orderDate = new Date(order.date_created)
      const orderAmount = order.total_amount || 0
      
      // Vendas hoje
      if (orderDate >= startDateToday) {
        salesToday++
        revenueToday += orderAmount
      }
      
      // Vendas últimos 7 dias
      if (orderDate >= startDate7Days) {
        salesLast7Days++
        revenueLast7Days += orderAmount
      }
      
      // Receita total
      revenueLast30Days += orderAmount
      
      // Análise por hora
      const hour = orderDate.getHours()
      salesByHour[hour]++
      
      // Análise por dia da semana
      const dayOfWeek = orderDate.getDay()
      salesByDayOfWeek[dayOfWeek]++
      
      // Análise por item
      for (const orderItem of order.order_items || []) {
        const itemId = orderItem.item.id
        if (!itemSales[itemId]) {
          itemSales[itemId] = {
            id: itemId,
            title: orderItem.item.title,
            quantity: 0,
            revenue: 0
          }
        }
        itemSales[itemId].quantity += orderItem.quantity
        itemSales[itemId].revenue += orderItem.unit_price * orderItem.quantity
      }
    }
    
    // Identificar melhor horário e dia
    const bestHour = Object.entries(salesByHour).reduce((a, b) => b[1] > a[1] ? b : a)
    const bestDayOfWeek = Object.entries(salesByDayOfWeek).reduce((a, b) => b[1] > a[1] ? b : a)
    
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    
    // Top 5 produtos mais vendidos
    const topProducts = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(p => ({
        title: p.title.substring(0, 40) + '...',
        quantity: p.quantity,
        revenue: p.revenue.toFixed(2)
      }))
    
    // Calcular velocidade média
    const avgDailySales = salesLast30Days / 30
    const avgWeeklySales = salesLast30Days / 4.3
    
    // Taxa de crescimento
    const previousWeekSales = salesLast30Days - salesLast7Days
    const growthRate = previousWeekSales > 0 
      ? ((salesLast7Days - (previousWeekSales / 3)) / (previousWeekSales / 3)) * 100
      : 0
    
    return {
      salesVelocity: {
        today: {
          sales: salesToday,
          revenue: revenueToday.toFixed(2)
        },
        last7Days: {
          sales: salesLast7Days,
          revenue: revenueLast7Days.toFixed(2)
        },
        last30Days: {
          sales: salesLast30Days,
          revenue: revenueLast30Days.toFixed(2)
        },
        averages: {
          dailySales: avgDailySales.toFixed(1),
          weeklySales: avgWeeklySales.toFixed(1),
          ticketSize: salesLast30Days > 0 ? (revenueLast30Days / salesLast30Days).toFixed(2) : '0'
        },
        patterns: {
          bestHour: `${bestHour[0]}h (${bestHour[1]} vendas)`,
          bestDayOfWeek: `${dayNames[parseInt(bestDayOfWeek[0])]} (${bestDayOfWeek[1]} vendas)`,
          growthRate: growthRate.toFixed(1) + '%'
        },
        topProducts
      }
    }
  } catch (error) {
    console.error('Error calculating sales velocity:', error)
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
    const [engagement, quality, competitive, salesVelocity] = await Promise.all([
      getEngagementMetrics(auth.accessToken, userId),
      getListingQualityMetrics(auth.accessToken, userId),
      getCompetitiveMetrics(auth.accessToken, userId),
      getSalesVelocityMetrics(auth.accessToken, userId)
    ])
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        engagement: engagement?.visits || null,
        quality: quality?.quality || null,
        competitive: competitive?.competitive || null,
        salesVelocity: salesVelocity?.salesVelocity || null
      }
    })
    
  } catch (error) {
    console.error('Error in advanced metrics endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch advanced metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}