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

    // Fetch item description from Mercado Livre API
    const response = await fetch(
      `https://api.mercadolibre.com/items/${itemId}/description`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ plain_text: "", text: "" }, { status: 200 })
      }
      return NextResponse.json(
        { error: "Failed to fetch description" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    logger.error("Error fetching description:", { error })
    return NextResponse.json(
      { error: "Failed to fetch description" },
      { status: 500 }
    )
  }
}