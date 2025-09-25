import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { extractAuthHeader } from "@/lib/auth-server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const auth = await extractAuthHeader(request)
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const { categoryId } = await params

    // Fetch category details from Mercado Livre API
    const response = await fetch(
      `https://api.mercadolibre.com/categories/${categoryId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch category" },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Build path from root to current category
    const path = []
    if (data.path_from_root) {
      for (const cat of data.path_from_root) {
        path.push(cat.name)
      }
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      path: path.join(" > "),
      path_from_root: data.path_from_root,
      total_items_in_this_category: data.total_items_in_this_category,
      settings: data.settings,
      channels_settings: data.channels_settings,
      attributes: data.attributes
    })
  } catch (error) {
    logger.error("Error fetching category:", { error })
    return NextResponse.json(
      { error: "Failed to fetch category" },
      { status: 500 }
    )
  }
}