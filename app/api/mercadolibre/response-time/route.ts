import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    // Mercado Livre doesn't have a direct response time API
    // Return empty data instead of error to avoid console pollution
    return NextResponse.json({
      data: null,
      message: "O Mercado Livre não fornece uma API pública para dados de tempo de resposta. Esta métrica é calculada internamente pela plataforma."
    })
  } catch (error) {
    console.error("Error fetching response time:", error)
    return NextResponse.json(
      { error: "Failed to fetch response time" },
      { status: 500 }
    )
  }
}