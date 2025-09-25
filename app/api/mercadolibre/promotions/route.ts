import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    // Get user info first
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

    // Try to get seller promotions
    try {
      const promotionsResponse = await fetch(
        `https://api.mercadolibre.com/seller-promotions/list?seller_id=${userId}&app_version=v2`,
        {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }
      )

      if (promotionsResponse.ok) {
        const promotionsData = await promotionsResponse.json()
        
        // Get details for each promotion
        const promotionsWithDetails = await Promise.all(
          (promotionsData.results || []).slice(0, 10).map(async (promo: any) => {
            try {
              const detailResponse = await fetch(
                `https://api.mercadolibre.com/seller-promotions/promotions/${promo.id}?promotion_type=${promo.type}&app_version=v2`,
                {
                  headers: {
                    Authorization: `Bearer ${auth.accessToken}`,
                  },
                }
              )
              if (detailResponse.ok) {
                const detail = await detailResponse.json()
                
                // Get items in promotion
                const itemsResponse = await fetch(
                  `https://api.mercadolibre.com/seller-promotions/promotions/${promo.id}/items?promotion_type=${promo.type}&app_version=v2`,
                  {
                    headers: {
                      Authorization: `Bearer ${auth.accessToken}`,
                    },
                  }
                )
                
                let items = []
                if (itemsResponse.ok) {
                  const itemsData = await itemsResponse.json()
                  items = itemsData.results || []
                }
                
                return {
                  ...detail,
                  items_count: items.length,
                  items: items.slice(0, 5) // Return first 5 items as preview
                }
              }
              return promo
            } catch (error) {
              logger.error(`Error fetching promotion details for ${promo.id}:`, { error })
              return promo
            }
          })
        )
        
        return NextResponse.json({
          promotions: promotionsWithDetails,
          total: promotionsData.paging?.total || 0,
        })
      }
    } catch (error) {
      logger.error("Error fetching promotions:", { error })
    }

    // If no promotions or error, return empty list
    return NextResponse.json({
      promotions: [],
      total: 0,
      message: "No active promotions found"
    })
    
  } catch (error) {
    logger.error("Error fetching promotions:", { error })
    return NextResponse.json(
      { error: "Failed to fetch promotions" },
      { status: 500 }
    )
  }
}