import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // First get the user ID
    const userResponse = await fetch(
      "https://api.mercadolibre.com/users/me",
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 401 }
      )
    }

    const userData = await userResponse.json()
    const userId = userData.id

    // Get detailed reputation metrics
    const reputationResponse = await fetch(
      `https://api.mercadolibre.com/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!reputationResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch reputation data" },
        { status: reputationResponse.status }
      )
    }

    const reputationData = await reputationResponse.json()
    
    // Extract detailed reputation metrics
    const reputation = {
      level_id: reputationData.seller_reputation?.level_id,
      power_seller_status: reputationData.seller_reputation?.power_seller_status,
      transactions: {
        completed: reputationData.seller_reputation?.transactions?.completed || 0,
        canceled: reputationData.seller_reputation?.transactions?.canceled || 0,
        ratings: {
          positive: reputationData.seller_reputation?.transactions?.ratings?.positive || 0,
          neutral: reputationData.seller_reputation?.transactions?.ratings?.neutral || 0,
          negative: reputationData.seller_reputation?.transactions?.ratings?.negative || 0
        }
      },
      metrics: {
        sales: {
          completed: reputationData.seller_reputation?.metrics?.sales?.completed || 0
        },
        claims: {
          rate: reputationData.seller_reputation?.metrics?.claims?.rate || 0,
          value: reputationData.seller_reputation?.metrics?.claims?.value || 0
        },
        delayed_handling_time: {
          rate: reputationData.seller_reputation?.metrics?.delayed_handling_time?.rate || 0,
          value: reputationData.seller_reputation?.metrics?.delayed_handling_time?.value || 0
        },
        cancellations: {
          rate: reputationData.seller_reputation?.metrics?.cancellations?.rate || 0,
          value: reputationData.seller_reputation?.metrics?.cancellations?.value || 0
        }
      },
      protection_end_date: reputationData.seller_reputation?.protection_end_date
    }
    
    return NextResponse.json({ data: reputation })
  } catch (error) {
    console.error("Error fetching reputation:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}