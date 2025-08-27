import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "@/app/api/mercadolibre/base"

// Mock session data
const agentSession = {
  id: "session-1",
  status: "INACTIVE" as string,
  startTime: null as Date | null,
  questionsProcessed: 0,
  errors: 0,
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json(agentSession)
  } catch (error) {
    console.error("Error fetching session:", error)
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    )
  }
}