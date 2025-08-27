import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    // Get user info first to get the user ID
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

    // Get recent orders from last 30 days for accurate metrics
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const ordersResponse = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${userId}&order.status=paid&order.date_created.from=${thirtyDaysAgo.toISOString()}&limit=50&sort=date_desc`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    let orders = { results: [], paging: { total: 0 } }
    if (ordersResponse.ok) {
      orders = await ordersResponse.json()
    }

    // Calculate metrics from orders
    const totalRevenue = orders.results?.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0
    const totalSales = orders.paging?.total || 0
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0

    // Get all items with details
    const allItemsResponse = await fetch(
      `https://api.mercadolibre.com/users/${userId}/items/search`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    let itemsList = []
    let activeItems = 0
    let totalItems = 0
    let soldQuantity = 0
    
    if (allItemsResponse.ok) {
      const itemsData = await allItemsResponse.json()
      const itemIds = itemsData.results || []
      totalItems = itemsData.paging?.total || 0
      
      // Get details for each item (limit to first 20 for performance)
      if (itemIds.length > 0) {
        const itemDetailsPromises = itemIds.slice(0, 20).map(async (itemId: string) => {
          try {
            const response = await fetch(
              `https://api.mercadolibre.com/items/${itemId}`,
              {
                headers: {
                  Authorization: `Bearer ${auth.accessToken}`,
                },
              }
            )
            if (response.ok) {
              return await response.json()
            }
            return null
          } catch (error) {
            return null
          }
        })
        
        const items = await Promise.all(itemDetailsPromises)
        itemsList = items.filter(item => item !== null)
        
        activeItems = itemsList.filter((item: any) => item.status === 'active').length
        soldQuantity = itemsList.reduce((sum: number, item: any) => sum + (item.sold_quantity || 0), 0)
      }
    }

    // Get visits for user's items in the last 30 days
    let totalVisits = 0
    try {
      const today = new Date()
      
      // Try multiple endpoints to get visits data
      // 1. Try user visits endpoint with time window
      const visitsResponse = await fetch(
        `https://api.mercadolibre.com/users/${userId}/items_visits/time_window?last=30&unit=day`,
        {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }
      )
      
      if (visitsResponse.ok) {
        const visitsData = await visitsResponse.json()
        totalVisits = visitsData.total_visits || visitsData.total || 0
      } 
      
      // 2. If first attempt fails, try individual items
      if (totalVisits === 0 && itemsList.length > 0) {
        // Get visits for active items
        const activeItemsList = itemsList.filter((item: any) => item.status === 'active')
        if (activeItemsList.length > 0) {
          const itemIds = activeItemsList.slice(0, 10).map((item: any) => item.id).join(',')
          const itemVisitsResponse = await fetch(
            `https://api.mercadolibre.com/items/visits?ids=${itemIds}`,
            {
              headers: {
                Authorization: `Bearer ${auth.accessToken}`,
              },
            }
          )
          
          if (itemVisitsResponse.ok) {
            const itemVisitsData = await itemVisitsResponse.json()
            if (Array.isArray(itemVisitsData)) {
              totalVisits = itemVisitsData.reduce((sum: number, item: any) => sum + (item.total_visits || 0), 0)
            } else if (typeof itemVisitsData === 'object') {
              totalVisits = itemVisitsData.total_visits || 0
            }
          }
        }
      }
      
      // 3. If still no visits, estimate from items data
      if (totalVisits === 0 && itemsList.length > 0) {
        // Sum visits from item details if available
        totalVisits = itemsList.reduce((sum: number, item: any) => {
          // Some items have visits_count or views field
          return sum + (item.visits || item.visits_count || item.views || 0)
        }, 0)
      }
    } catch (error) {
      console.error("Error fetching visits:", error)
      // Continue without visits data - will show 0
    }
    
    // Build response
    const metrics = {
      revenue: {
        total: totalRevenue,
        average: averageTicket,
      },
      sales: {
        total: totalSales,
        pending: orders.results?.filter((o: any) => o.status === "payment_in_process").length || 0,
      },
      visits: {
        total: totalVisits,
        conversionRate: totalSales > 0 && totalVisits > 0 ? (totalSales / totalVisits) * 100 : 0,
      },
      items: {
        active: activeItems,
        total: totalItems,
        sold_quantity: soldQuantity,
      },
      itemsList: itemsList,
      reputation: user.seller_reputation || {},
      recentOrders: orders.results?.slice(0, 10) || [],
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error("Error fetching metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    )
  }
}