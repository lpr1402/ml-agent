import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    // Get user info to get the site ID
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    })

    if (!userResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch user" }, { status: 401 })
    }

    const user = await userResponse.json()
    const siteId = user.site_id || "MLB"

    // Get user's active items to find their categories
    const itemsResponse = await fetch(
      `https://api.mercadolibre.com/users/${user.id}/items/search?status=active&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    let bestSellerPosition = null
    let bestSellerCategory = null
    
    if (itemsResponse.ok) {
      const itemsData = await itemsResponse.json()
      const itemIds = itemsData.results || []
      
      // Get details for first few items to find categories
      if (itemIds.length > 0) {
        const itemDetailsPromises = itemIds.slice(0, 5).map(async (itemId: string) => {
          try {
            const response = await fetch(
              `https://api.mercadolibre.com/items/${itemId}`,
              {
                headers: {
                  Authorization: `Bearer ${auth.accessToken}`,
                },
              }
            )
            if (response.ok) {
              return await response.json()
            }
            return null
          } catch (error) {
            return null
          }
        })
        
        const items = await Promise.all(itemDetailsPromises)
        const validItems = items.filter(item => item !== null)
        
        // For each item, check if it's in the highlights
        for (const item of validItems) {
          if (item?.category_id) {
            try {
              // Check item position in highlights
              const highlightResponse = await fetch(
                `https://api.mercadolibre.com/highlights/${siteId}/item/${item.id}`,
                {
                  headers: {
                    Authorization: `Bearer ${auth.accessToken}`,
                  },
                }
              )
              
              if (highlightResponse.ok) {
                const highlightData = await highlightResponse.json()
                if (!bestSellerPosition || highlightData.position < bestSellerPosition) {
                  bestSellerPosition = highlightData.position
                  bestSellerCategory = highlightData.label
                }
              }
            } catch (error) {
              // Item not in highlights, continue
            }
          }
        }
      }
    }

    // Get trends for the site
    const trendsResponse = await fetch(
      `https://api.mercadolibre.com/trends/${siteId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    let trends = []
    if (trendsResponse.ok) {
      const trendsData = await trendsResponse.json()
      // Get top 5 trends (most growing searches)
      trends = trendsData.slice(0, 5).map((trend: any) => trend.keyword)
    }

    return NextResponse.json({
      bestSeller: {
        position: bestSellerPosition,
        category: bestSellerCategory,
      },
      trends: trends,
      siteId: siteId,
    })
  } catch (error) {
    console.error("Error fetching highlights:", error)
    return NextResponse.json(
      { error: "Failed to fetch highlights" },
      { status: 500 }
    )
  }
}