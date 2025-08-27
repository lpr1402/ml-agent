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
    
    // Get shipping options and costs
    const response = await fetch(
      `https://api.mercadolibre.com/items/${itemId}/shipping_options`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: "Shipping data not available" },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({ data })
  } catch (error) {
    console.error("Error fetching shipping data:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}