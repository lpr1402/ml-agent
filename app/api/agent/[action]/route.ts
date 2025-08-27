import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "@/app/api/mercadolibre/base"

// Mock session state
const agentState = {
  status: "INACTIVE" as string,
  startTime: null as Date | null,
  questionsProcessed: 0,
  errors: 0,
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await context.params
    const { action } = params

    switch (action) {
      case "start":
        agentState.status = "ACTIVE"
        agentState.startTime = new Date()
        agentState.questionsProcessed = 0
        agentState.errors = 0
        break
      
      case "stop":
        agentState.status = "INACTIVE"
        agentState.startTime = null
        break
      
      case "pause":
        agentState.status = "PAUSED"
        break
      
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      action,
      newStatus: agentState.status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error controlling agent:", error)
    return NextResponse.json(
      { error: "Failed to control agent" },
      { status: 500 }
    )
  }
}