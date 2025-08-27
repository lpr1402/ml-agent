import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    try {
      // Get billing periods from Mercado Livre API
      const periodsResponse = await fetch(
        "https://api.mercadolibre.com/billing/integration/monthly/periods?group=ML&document_type=BILL&limit=6",
        {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }
      )

      if (!periodsResponse.ok) {
        // If billing API is not available or user doesn't have access
        return NextResponse.json({
          error: "Billing data not available",
          message: "Você não tem acesso aos dados de faturamento ou o serviço está temporariamente indisponível",
          summary: null,
          periods: []
        })
      }

      const periodsData = await periodsResponse.json()
      
      // Calculate summary
      const totalBilled = periodsData.results?.reduce((sum: number, period: any) => sum + (period.amount || 0), 0) || 0
      const totalUnpaid = periodsData.results?.reduce((sum: number, period: any) => sum + (period.unpaid_amount || 0), 0) || 0
      
      return NextResponse.json({
        summary: {
          total_billed_formatted: `R$ ${totalBilled.toFixed(2).replace('.', ',')}`,
          total_unpaid_formatted: `R$ ${totalUnpaid.toFixed(2).replace('.', ',')}`,
          periods_count: periodsData.total || 0
        },
        periods: periodsData.results || []
      })
    } catch (apiError) {
      console.error("Error fetching billing from ML API:", apiError)
      return NextResponse.json({
        error: "Billing data not available",
        message: "Não foi possível carregar os dados de faturamento. Tente novamente mais tarde.",
        summary: null,
        periods: []
      })
    }
  } catch (error) {
    console.error("Error fetching billing:", error)
    return NextResponse.json(
      { error: "Failed to fetch billing" },
      { status: 500 }
    )
  }
}