import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest, createAuthHeaders } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    // Get user data first
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: createAuthHeaders(auth.accessToken),
    })

    if (!userResponse.ok) {
      throw new Error("Failed to fetch user data")
    }

    const userData = await userResponse.json()
    const userId = String(userData.id)
    const siteId = userData.site_id

    // Get current billing period
    const currentDate = new Date()
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const periodKey = `${firstDayOfMonth.getFullYear()}-${String(firstDayOfMonth.getMonth() + 1).padStart(2, '0')}-01`

    // Fetch multiple data sources in parallel
    const [
      billingPeriods,
      billingSummary,
      orders30Days,
      orders7Days,
      ordersToday,
      visitsData
    ] = await Promise.all([
      // 1. Billing periods (last 3 months)
      fetch(`https://api.mercadolibre.com/billing/integration/monthly/periods?group=ML&document_type=BILL&limit=3`, {
        headers: createAuthHeaders(auth.accessToken),
      }).then(res => res.ok ? res.json() : null).catch(() => null),

      // 2. Current period billing summary
      fetch(`https://api.mercadolibre.com/billing/integration/periods/key/${periodKey}/summary/details`, {
        headers: createAuthHeaders(auth.accessToken),
      }).then(res => res.ok ? res.json() : null).catch(() => null),

      // 3. Orders last 30 days
      fetch(`https://api.mercadolibre.com/orders/search?seller=${userId}&order.status=paid&order.date_created.from=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}&limit=50`, {
        headers: createAuthHeaders(auth.accessToken),
      }).then(res => res.ok ? res.json() : null).catch(() => null),

      // 4. Orders last 7 days
      fetch(`https://api.mercadolibre.com/orders/search?seller=${userId}&order.status=paid&order.date_created.from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}&limit=50`, {
        headers: createAuthHeaders(auth.accessToken),
      }).then(res => res.ok ? res.json() : null).catch(() => null),

      // 5. Orders today
      fetch(`https://api.mercadolibre.com/orders/search?seller=${userId}&order.status=paid&order.date_created.from=${new Date().toISOString().split('T')[0]}T00:00:00.000-00:00&limit=50`, {
        headers: createAuthHeaders(auth.accessToken),
      }).then(res => res.ok ? res.json() : null).catch(() => null),

      // 6. Visits data for conversion metrics
      fetch(`https://api.mercadolibre.com/users/${userId}/items_visits?date_from=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&date_to=${new Date().toISOString().split('T')[0]}`, {
        headers: createAuthHeaders(auth.accessToken),
      }).then(res => res.ok ? res.json() : null).catch(() => null)
    ])

    // Process financial metrics
    const processOrders = (orders: any) => {
      if (!orders?.results) return {
        revenue: 0,
        count: 0,
        fees: 0,
        shipping: 0,
        avgTicket: 0,
        paymentMethods: {}
      }

      let totalRevenue = 0
      let totalFees = 0
      let totalShipping = 0
      const paymentMethods: Record<string, number> = {}

      orders.results.forEach((order: any) => {
        totalRevenue += order.total_amount || 0
        
        // Calculate fees from order items
        order.order_items?.forEach((item: any) => {
          totalFees += item.sale_fee || 0
        })

        // Track payment methods
        order.payments?.forEach((payment: any) => {
          if (payment.payment_method_id) {
            paymentMethods[payment.payment_method_id] = (paymentMethods[payment.payment_method_id] || 0) + 1
          }
          totalShipping += payment.shipping_cost || 0
        })
      })

      return {
        revenue: totalRevenue,
        count: orders.results.length,
        fees: totalFees,
        shipping: totalShipping,
        avgTicket: orders.results.length > 0 ? totalRevenue / orders.results.length : 0,
        paymentMethods
      }
    }

    const metrics30Days = processOrders(orders30Days)
    const metrics7Days = processOrders(orders7Days)
    const metricsToday = processOrders(ordersToday)

    // Calculate growth rates
    const dailyAvg30Days = metrics30Days.revenue / 30
    const dailyAvg7Days = metrics7Days.revenue / 7
    const growthRate7Days = dailyAvg30Days > 0 ? ((dailyAvg7Days - dailyAvg30Days) / dailyAvg30Days) * 100 : 0

    // Process billing summary for taxes and fees breakdown
    let totalCharges = 0
    let totalBonuses = 0
    let totalPerceptions = 0
    const chargesBreakdown: Record<string, number> = {}
    const bonusesBreakdown: Record<string, number> = {}

    if (billingSummary?.bill_includes) {
      totalCharges = billingSummary.bill_includes.total_amount || 0
      totalPerceptions = billingSummary.bill_includes.total_perceptions || 0
      
      billingSummary.bill_includes.charges?.forEach((charge: any) => {
        chargesBreakdown[charge.type || 'other'] = (chargesBreakdown[charge.type || 'other'] || 0) + (charge.amount || 0)
      })
      
      billingSummary.bill_includes.bonuses?.forEach((bonus: any) => {
        totalBonuses += bonus.amount || 0
        bonusesBreakdown[bonus.type || 'other'] = (bonusesBreakdown[bonus.type || 'other'] || 0) + (bonus.amount || 0)
      })
    }

    // Calculate net revenue and margins using REAL data
    // Use actual perceptions (taxes) from billing summary instead of estimates
    const actualTaxes = totalPerceptions > 0 ? totalPerceptions : 0
    const netRevenue30Days = metrics30Days.revenue - metrics30Days.fees - actualTaxes
    const netMargin = metrics30Days.revenue > 0 ? (netRevenue30Days / metrics30Days.revenue) * 100 : 0
    const effectiveFeeRate = metrics30Days.revenue > 0 ? (metrics30Days.fees / metrics30Days.revenue) * 100 : 0

    // Conversion metrics
    const conversionRate = visitsData?.total_visits > 0 ? (metrics30Days.count / visitsData.total_visits) * 100 : 0

    // Payment release metrics (from recent orders)
    let totalPending = 0
    let totalApproved = 0
    let avgReleasedays = 0
    let releaseDaysCount = 0

    orders30Days?.results?.forEach((order: any) => {
      order.payments?.forEach((payment: any) => {
        if (payment.status === 'approved') {
          totalApproved += payment.transaction_amount || 0
          
          if (payment.money_release_date && payment.date_approved) {
            const releaseDate = new Date(payment.money_release_date)
            const approvedDate = new Date(payment.date_approved)
            const days = Math.floor((releaseDate.getTime() - approvedDate.getTime()) / (1000 * 60 * 60 * 24))
            if (days > 0 && days < 60) {
              avgReleasedays += days
              releaseDaysCount++
            }
          }
        } else if (payment.status === 'pending') {
          totalPending += payment.transaction_amount || 0
        }
      })
    })

    if (releaseDaysCount > 0) {
      avgReleasedays = Math.round(avgReleasedays / releaseDaysCount)
    }

    // Sales velocity and projections
    const salesVelocity = metrics7Days.count / 7 // sales per day
    const projectedMonthlyRevenue = dailyAvg7Days * 30
    const projectedMonthlyOrders = Math.round(salesVelocity * 30)

    // Category performance (would need items API for detailed breakdown)
    // This is simplified for now
    const categoryPerformance = {
      topCategory: null,
      categoryBreakdown: {}
    }

    return NextResponse.json({
      period: {
        current: periodKey,
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
      },
      revenue: {
        gross30Days: metrics30Days.revenue,
        gross7Days: metrics7Days.revenue,
        grossToday: metricsToday.revenue,
        net30Days: netRevenue30Days,
        growthRate7Days: growthRate7Days,
        avgTicket: metrics30Days.avgTicket,
        projectedMonthly: projectedMonthlyRevenue
      },
      orders: {
        total30Days: metrics30Days.count,
        total7Days: metrics7Days.count,
        totalToday: metricsToday.count,
        salesVelocity: salesVelocity,
        projectedMonthly: projectedMonthlyOrders,
        conversionRate: conversionRate
      },
      fees: {
        totalFees30Days: metrics30Days.fees,
        totalPerceptions: totalPerceptions,
        totalBonuses: totalBonuses,
        effectiveRate: effectiveFeeRate,
        netMargin: netMargin,
        chargesBreakdown: chargesBreakdown,
        bonusesBreakdown: bonusesBreakdown
      },
      payments: {
        totalApproved: totalApproved,
        totalPending: totalPending,
        avgReleasedays: avgReleasedays,
        methodsBreakdown: metrics30Days.paymentMethods
      },
      billing: {
        currentPeriodTotal: billingPeriods?.results?.[0]?.amount || null,
        currentPeriodUnpaid: billingPeriods?.results?.[0]?.unpaid_amount || null,
        periodsHistory: billingPeriods?.results || []
      },
      visits: {
        total30Days: visitsData?.total_visits || null,
        conversionRate: conversionRate
      },
      insights: {
        bestSellingDay: null, // Would need to process daily data
        peakHours: null, // Would need hourly data
        seasonalityIndex: null, // Would need historical data
        recommendations: generateRecommendations(metrics30Days, metrics7Days, effectiveFeeRate, conversionRate)
      }
    })

  } catch (error) {
    console.error("Error fetching financial summary:", error)
    return NextResponse.json(
      { error: "Failed to fetch financial summary" },
      { status: 500 }
    )
  }
}

function generateRecommendations(metrics30Days: any, metrics7Days: any, effectiveFeeRate: number, conversionRate: number): string[] {
  const recommendations = []
  
  // Growth analysis
  if (metrics7Days.revenue < metrics30Days.revenue / 4) {
    recommendations.push("Vendas abaixo da média - considere promoções ou anúncios")
  }
  
  // Fee optimization
  if (effectiveFeeRate > 15) {
    recommendations.push("Taxa efetiva alta - revise categorias e tipo de anúncio")
  }
  
  // Conversion optimization
  if (conversionRate < 1) {
    recommendations.push("Taxa de conversão baixa - otimize títulos e fotos")
  }
  
  // Ticket optimization
  if (metrics30Days.avgTicket < 100) {
    recommendations.push("Ticket médio baixo - considere venda casada ou frete grátis")
  }
  
  return recommendations
}