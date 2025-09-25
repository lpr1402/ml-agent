import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { extractAuthHeader } from "@/lib/auth-server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await extractAuthHeader(request)
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const { itemId } = await params

    // Fetch price to win data from Mercado Livre API
    const response = await fetch(
      `https://api.mercadolibre.com/items/${itemId}/price_to_win?version=v2`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ 
          error: "Competition data not available for this item",
          status: null,
          suggestedPrice: null,
          currentPrice: null,
          priceToWin: null
        }, { status: 200 }) // Return 200 with null data
      }
      return NextResponse.json(
        { error: "Failed to fetch competition data" },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Transform the data according to ML API documentation
    const result = {
      status: data.status || "unknown",
      currentPrice: data.current_price || data.item_price || null,
      priceToWin: data.price_to_win || null,
      suggestedPrice: data.price_to_win || null, // price_to_win is the suggested price
      competitorsCount: data.competitors_sharing_first_place || 0,
      visitShare: data.visit_share || null,
      consistent: data.consistent || false,
      boosts: data.boosts || [],
      reason: data.reason || [],
      winner: data.winner || null,
      catalog: {
        productId: data.catalog_product_id || null,
        listing: data.catalog_listing || null
      },
      metadata: {
        version: data.version || null,
        lastUpdated: new Date().toISOString()
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    logger.error("Error fetching price to win:", { error })
    return NextResponse.json(
      { error: "Failed to fetch competition data" },
      { status: 500 }
    )
  }
}