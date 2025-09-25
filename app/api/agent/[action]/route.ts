import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"

// Mock session state
const agentState = {
  status: "INACTIVE" as string,
  startTime: null as Date | null,
  questionsProcessed: 0,
  errors: 0,
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ action: string }> }
) {
  try {
    const auth = await getAuthenticatedAccount()
    
    if (!auth) {
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
    logger.error("Error controlling agent:", { error })
    return NextResponse.json(
      { error: "Failed to control agent" },
      { status: 500 }
    )
  }
}