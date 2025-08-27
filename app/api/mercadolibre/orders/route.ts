import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const limit = searchParams.get("limit") || "50"
    const offset = searchParams.get("offset") || "0"
    const days = searchParams.get("days")

    // Get user ID
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    })

    if (!userResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: 401 })
    }

    const userData = await userResponse.json()
    const userId = userData.id

    // Build query params
    const params = new URLSearchParams({
      seller: userId,
      limit,
      offset,
      sort: "date_desc",
    })

    // Add date filter if days parameter is provided
    if (days) {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - parseInt(days))
      
      params.append("order.date_created.from", startDate.toISOString())
      params.append("order.date_created.to", endDate.toISOString())
    }

    if (status) {
      params.append("order.status", status)
    } else {
      // Default to paid orders for revenue calculation
      params.append("order.status", "paid")
    }

    const response = await fetch(
      `https://api.mercadolibre.com/orders/search?${params}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      console.error("Orders API error:", response.status, response.statusText)
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Calculate total amount for revenue if days parameter is provided
    if (days) {
      let totalAmount = 0
      if (data.results && data.results.length > 0) {
        data.results.forEach((order: any) => {
          totalAmount += order.total_amount || 0
        })
      }
      
      return NextResponse.json({
        total_amount: totalAmount,
        orders: data.results || [],
        paging: data.paging,
      })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching orders:", error)
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    )
  }
}