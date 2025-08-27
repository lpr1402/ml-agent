import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "@/app/api/mercadolibre/base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "7")

    // Mock history data - replace with Prisma queries
    const history = []
    const now = new Date()
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      
      history.push({
        date: date.toISOString(),
        totalQuestions: Math.floor(Math.random() * 50) + 10,
        answered: Math.floor(Math.random() * 40) + 5,
        pending: Math.floor(Math.random() * 10),
        failed: Math.floor(Math.random() * 5),
        avgResponseTime: Math.floor(Math.random() * 300) + 60, // 1-6 minutes
        satisfaction: (Math.random() * 2 + 3).toFixed(1), // 3-5 rating
      })
    }

    return NextResponse.json(history)
  } catch (error) {
    console.error("Error fetching history:", error)
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    )
  }
}