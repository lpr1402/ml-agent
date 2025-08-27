import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

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

    // Get orders from last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const lastWeekOrdersResponse = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${userId}&order.status=paid&order.date_created.from=${sevenDaysAgo.toISOString()}&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    // Get orders from previous 7 days (for comparison)
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    
    const previousWeekOrdersResponse = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${userId}&order.status=paid&order.date_created.from=${fourteenDaysAgo.toISOString()}&order.date_created.to=${sevenDaysAgo.toISOString()}&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    let lastWeekSales = 0
    let previousWeekSales = 0
    let todaySales = 0
    let growthRate = 0
    
    const today = new Date().toISOString().split('T')[0]
    
    let lastWeekData: any = null
    let previousWeekData: any = null
    
    if (lastWeekOrdersResponse.ok) {
      lastWeekData = await lastWeekOrdersResponse.json()
      lastWeekSales = lastWeekData.paging?.total || 0
      
      // Count today's sales
      todaySales = lastWeekData.results?.filter((order: any) => 
        order.date_created.startsWith(today)
      ).length || 0
    }
    
    if (previousWeekOrdersResponse.ok) {
      previousWeekData = await previousWeekOrdersResponse.json()
      previousWeekSales = previousWeekData.paging?.total || 0
    }
    
    // Calculate growth rate
    if (previousWeekSales > 0) {
      growthRate = ((lastWeekSales - previousWeekSales) / previousWeekSales) * 100
    }

    // Get best performing items (by recent sales)
    const itemSales: { [key: string]: number } = {}
    
    if (lastWeekData) {
      lastWeekData.results?.forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
          itemSales[item.item.id] = (itemSales[item.item.id] || 0) + item.quantity
        })
      })
    }
    
    // Sort items by sales and get top 3
    const topItems = Object.entries(itemSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([itemId, quantity]) => ({ itemId, quantity }))

    return NextResponse.json({
      lastWeekSales,
      previousWeekSales,
      todaySales,
      growthRate,
      salesPerDay: lastWeekSales / 7,
      topSellingItems: topItems,
    })
  } catch (error) {
    console.error("Error fetching sales velocity:", error)
    return NextResponse.json(
      { error: "Failed to fetch sales velocity" },
      { status: 500 }
    )
  }
}