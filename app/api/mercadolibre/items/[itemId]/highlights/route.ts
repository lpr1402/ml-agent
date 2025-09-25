import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../../../base"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const params = await context.params
    const itemId = params.itemId

    // Get item highlights/position in search results
    try {
      const highlightsResponse = await fetch(
        `https://api.mercadolibre.com/highlights/MLB/item/${itemId}`,
        {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }
      )

      if (highlightsResponse.ok) {
        const highlightsData = await highlightsResponse.json()
        
        return NextResponse.json({
          item_id: itemId,
          position: highlightsData.position || null,
          highlights: highlightsData.highlights || [],
          best_position: highlightsData.best_position || null,
          total_results: highlightsData.total_results || 0,
        })
      }
    } catch (error) {
      logger.error("Error fetching highlights:", { error })
    }

    // If no highlights or error, return empty structure
    return NextResponse.json({
      item_id: itemId,
      position: null,
      highlights: [],
      best_position: null,
      total_results: 0,
      message: "No highlights found for this item"
    })
    
  } catch (error) {
    logger.error("Error fetching highlights:", { error })
    return NextResponse.json(
      { 
        position: null,
        highlights: [],
        error: "Failed to fetch highlights" 
      },
      { status: 500 }
    )
  }
}