import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest, createAuthHeaders } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    // Get user data with reputation details
    const userResponse = await fetch(
      "https://api.mercadolibre.com/users/me?attributes=seller_reputation,seller_experience,status",
      {
        headers: createAuthHeaders(auth.accessToken),
      }
    )

    if (!userResponse.ok) {
      throw new Error("Failed to fetch user reputation")
    }

    const userData = await userResponse.json()
    const reputation = userData.seller_reputation || {}
    const metrics = reputation.metrics || {}
    const transactions = reputation.transactions || {}

    // Calculate reputation score (0-100)
    let reputationScore = null
    const levelMap: { [key: string]: number } = {
      '5_green': 100,
      '4_light_green': 80,
      '3_yellow': 60,
      '2_orange': 40,
      '1_red': 20,
      'newbie': 50
    }
    
    if (reputation.level_id) {
      reputationScore = levelMap[reputation.level_id] || 50
    } else if (transactions.total === 0) {
      reputationScore = null // Sem vendas ainda
    } else {
      // Calcular baseado nas métricas reais
      const claimsRate = metrics.claims?.rate || 0
      const delaysRate = metrics.delayed_handling_time?.rate || 0
      const cancellationsRate = metrics.cancellations?.rate || 0
      
      // Score baseado nas taxas (invertido - quanto menor as taxas, maior o score)
      if (claimsRate > 0.5) {
        reputationScore = Math.max(0, 25 - (claimsRate * 25))
      } else if (claimsRate > 0.2) {
        reputationScore = Math.max(25, 50 - (claimsRate * 50))
      } else if (claimsRate > 0.08) {
        reputationScore = Math.max(50, 75 - (claimsRate * 100))
      } else {
        reputationScore = Math.max(75, 100 - (claimsRate * 200 + delaysRate * 100 + cancellationsRate * 100))
      }
      
      reputationScore = Math.round(reputationScore)
    }

    // Get health indicators
    const claimsRate = metrics.claims?.rate || 0
    const delayedRate = metrics.delayed_handling_time?.rate || 0
    const cancellationsRate = metrics.cancellations?.rate || 0

    // Calculate health status
    let healthStatus = null
    let healthColor = '#666666'
    let healthScore = null
    
    // Só calcular saúde se tiver transações
    if (transactions.total > 0) {
      if (claimsRate > 0.08 || delayedRate > 0.22 || cancellationsRate > 0.04) {
        healthStatus = 'critical'
        healthColor = '#EF4444' // red
      } else if (claimsRate > 0.045 || delayedRate > 0.18 || cancellationsRate > 0.035) {
        healthStatus = 'attention'
        healthColor = '#F59E0B' // orange
      } else if (claimsRate > 0.02 || delayedRate > 0.10 || cancellationsRate > 0.015) {
        healthStatus = 'good'
        healthColor = '#FFE600' // yellow ML
      } else {
        healthStatus = 'excellent'
        healthColor = '#10B981' // green
      }
      
      healthScore = Math.max(0, 100 - Math.round((claimsRate * 100 + delayedRate * 100 + cancellationsRate * 100) * 10))
    }

    // Get real values if seller is protected
    const realClaims = metrics.claims?.excluded?.real_value || metrics.claims?.value || 0
    const realClaimsRate = metrics.claims?.excluded?.real_rate || metrics.claims?.rate || 0
    const realDelayed = metrics.delayed_handling_time?.excluded?.real_value || metrics.delayed_handling_time?.value || 0
    const realDelayedRate = metrics.delayed_handling_time?.excluded?.real_rate || metrics.delayed_handling_time?.rate || 0
    const realCancellations = metrics.cancellations?.excluded?.real_value || metrics.cancellations?.value || 0
    const realCancellationsRate = metrics.cancellations?.excluded?.real_rate || metrics.cancellations?.rate || 0

    // Format power seller status
    const powerSellerLabels: { [key: string]: string } = {
      'platinum': 'MercadoLíder Platinum',
      'gold': 'MercadoLíder Gold', 
      'silver': 'MercadoLíder Silver',
      '': 'Vendedor Regular'
    }

    // Get orders for completion rate
    try {
      const ordersResponse = await fetch(
        "https://api.mercadolibre.com/orders/search?seller=" + userData.id + "&order.status=paid&limit=1",
        {
          headers: createAuthHeaders(auth.accessToken),
        }
      )
      
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json()
        const totalOrders = ordersData.paging?.total || 0
        
        // Add to response
        reputation.recent_orders = totalOrders
      }
    } catch (error) {
      console.error("Error fetching orders:", error)
    }

    return NextResponse.json({
      reputation: {
        level: reputation.level_id || null,
        realLevel: reputation.real_level || null,
        score: reputationScore,
        powerSeller: reputation.power_seller_status || null,
        powerSellerLabel: reputation.power_seller_status ? 
          powerSellerLabels[reputation.power_seller_status] : 'Vendedor Regular',
        protected: !!reputation.protection_end_date,
        protectionEndDate: reputation.protection_end_date || null
      },
      transactions: {
        total: transactions.total ?? null,
        completed: transactions.completed ?? null,
        canceled: transactions.canceled ?? null,
        period: transactions.period || null,
        ratings: {
          positive: transactions.ratings?.positive != null ? transactions.ratings.positive * 100 : null,
          neutral: transactions.ratings?.neutral != null ? transactions.ratings.neutral * 100 : null,
          negative: transactions.ratings?.negative != null ? transactions.ratings.negative * 100 : null
        },
        // Adicionar contexto sobre vendas vs cancelamentos
        salesAttempts: transactions.total || 0, // Total de tentativas de venda
        successfulSales: transactions.completed || 0, // Vendas concluídas com sucesso
        failedSales: transactions.canceled || 0 // Vendas canceladas/reembolsadas
      },
      metrics: {
        sales: {
          period: metrics.sales?.period || null,
          completed: metrics.sales?.completed ?? null
        },
        claims: {
          value: metrics.claims?.value ?? null,
          rate: metrics.claims?.rate != null ? metrics.claims.rate * 100 : null,
          period: metrics.claims?.period || null
        },
        delays: {
          value: metrics.delayed_handling_time?.value ?? null,
          rate: metrics.delayed_handling_time?.rate != null ? metrics.delayed_handling_time.rate * 100 : null,
          period: metrics.delayed_handling_time?.period || null
        },
        cancellations: {
          value: metrics.cancellations?.value ?? null,
          rate: metrics.cancellations?.rate != null ? metrics.cancellations.rate * 100 : null,
          period: metrics.cancellations?.period || null
        }
      },
      health: {
        status: healthStatus,
        color: healthColor,
        score: healthScore
      },
      thermometer: {
        level: reputation.level_id || null,
        color: reputation.level_id ? 
               (reputation.level_id.includes('green') ? '#10B981' :
                reputation.level_id.includes('yellow') ? '#FFE600' :
                reputation.level_id.includes('orange') ? '#F59E0B' :
                reputation.level_id.includes('red') ? '#EF4444' : '#9CA3AF') : '#666666'
      },
      experience: userData.seller_experience || null
    })

  } catch (error) {
    console.error("Error fetching reputation metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch reputation metrics" },
      { status: 500 }
    )
  }
}