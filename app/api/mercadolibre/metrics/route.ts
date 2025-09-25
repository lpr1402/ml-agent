import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { mlApiQueue } from "@/lib/api/sequential-queue"

export async function GET() {
  try {
    // Get authenticated account
    const auth = await getAuthenticatedAccount()
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    // Get user info using sequential queue
    const userData = await mlApiQueue.add(async () => {
      const response = await fetch("https://api.mercadolibre.com/users/me", {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          Accept: "application/json"
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.status}`)
      }
      
      return response.json()
    })
    
    const userId = userData.id
    
    // Get recent orders from last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const ordersData = await mlApiQueue.add(async () => {
      const response = await fetch(
        `https://api.mercadolibre.com/orders/search?seller=${userId}&order.status=paid&order.date_created.from=${thirtyDaysAgo.toISOString()}&limit=50&sort=date_desc&api_version=4`,
        {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            Accept: "application/json"
          }
        }
      )
      
      if (!response.ok) {
        logger.info(`Orders fetch failed: ${response.status}`)
        return { results: [], paging: { total: 0 } }
      }
      
      return response.json()
    })
    
    // Get items
    const itemsData = await mlApiQueue.add(async () => {
      const response = await fetch(
        `https://api.mercadolibre.com/users/${userId}/items/search?status=active&api_version=4`,
        {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            Accept: "application/json"
          }
        }
      )
      
      if (!response.ok) {
        logger.info(`Items fetch failed: ${response.status}`)
        return { results: [], paging: { total: 0 } }
      }
      
      return response.json()
    })
    
    // Calculate metrics
    const orders = ordersData.results || []
    const totalRevenue = orders.reduce((sum: number, order: any) => 
      sum + (order.total_amount || 0), 0
    )
    const totalSales = ordersData.paging?.total || 0
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0
    
    // Get details for some items (limit to 5 for performance)
    const itemsList = []
    let activeItems = 0
    let soldQuantity = 0
    const totalItems = itemsData.paging?.total || 0
    
    if (itemsData.results && itemsData.results.length > 0) {
      const itemIds = itemsData.results.slice(0, 5)
      
      // Fetch item details sequentially
      for (const itemId of itemIds) {
        try {
          const item = await mlApiQueue.add(async () => {
            const response = await fetch(
              `https://api.mercadolibre.com/items/${itemId}?api_version=4`,
              {
                headers: {
                  Authorization: `Bearer ${auth.accessToken}`,
                  Accept: "application/json"
                }
              }
            )
            
            if (!response.ok) {
              return null
            }
            
            return response.json()
          })
          
          if (item) {
            itemsList.push(item)
            if (item.status === 'active') activeItems++
            soldQuantity += item.sold_quantity || 0
          }
        } catch (_error) {
          logger.info(`Error fetching item ${itemId}:`, { error: _error })
        }
      }
    }
    
    // Try to get visits data
    let totalVisits = 0
    try {
      const visitsData = await mlApiQueue.add(async () => {
        const response = await fetch(
          `https://api.mercadolibre.com/users/${userId}/items_visits/time_window?last=30&unit=day&api_version=4`,
          {
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
              Accept: "application/json"
            }
          }
        )
        
        if (!response.ok) {
          return null
        }
        
        return response.json()
      })
      
      if (visitsData) {
        totalVisits = visitsData.total_visits || visitsData.total || 0
      }
    } catch (_error) {
      logger.info("Could not fetch visits data")
    }
    
    // Build response
    const metrics = {
      revenue: {
        total: totalRevenue,
        average: averageTicket,
      },
      sales: {
        total: totalSales,
        pending: orders.filter((o: any) => o.status === "payment_in_process").length,
      },
      visits: {
        total: totalVisits,
        conversionRate: totalSales > 0 && totalVisits > 0 
          ? (totalSales / totalVisits) * 100 
          : 0,
      },
      items: {
        active: activeItems,
        total: totalItems,
        sold_quantity: soldQuantity,
      },
      itemsList: itemsList,
      reputation: userData.seller_reputation || {},
      recentOrders: orders.slice(0, 10),
      user: {
        id: userData.id,
        nickname: userData.nickname,
        site_id: userData.site_id
      }
    }
    
    return NextResponse.json(metrics)
    
  } catch (_error) {
    logger.error("[Metrics] Error:", { error: _error })
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    )
  }
}