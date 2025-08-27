import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../../../../base"

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

    // Get query parameters for time window
    const searchParams = request.nextUrl.searchParams
    const last = searchParams.get('last') || '30'
    const unit = searchParams.get('unit') || 'day'
    const ending = searchParams.get('ending') || new Date().toISOString()
    
    // Call the Mercado Libre time_window API
    const response = await fetch(
      `https://api.mercadolibre.com/items/${itemId}/visits/time_window?last=${last}&unit=${unit}&ending=${ending}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      console.error(`Failed to fetch time window visits: ${response.status}`)
      return NextResponse.json(
        { error: "Failed to fetch time window visits data" },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Return the data in the expected format
    return NextResponse.json({ 
      data: {
        item_id: data.item_id,
        date_from: data.date_from,
        date_to: data.date_to,
        total_visits: data.total_visits,
        last: data.last,
        unit: data.unit,
        results: data.results || []
      }
    })
  } catch (error) {
    console.error("Error fetching item time window visits:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}