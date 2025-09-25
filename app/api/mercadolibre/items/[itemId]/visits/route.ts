import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../../../base"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request)
    const { itemId } = await params
    
    if (!auth?.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    
    // Get total visits for the item (last 2 years)
    const response = await fetch(
      `https://api.mercadolibre.com/visits/items?ids=${itemId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch visits data" },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Format the response to be consistent
    const formattedData = {
      item_id: itemId,
      total_visits: data[itemId] || 0
    }
    
    return NextResponse.json({ data: formattedData })
  } catch (error) {
    logger.error("Error fetching item visits:", { error })
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}