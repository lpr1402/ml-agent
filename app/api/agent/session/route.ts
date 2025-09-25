import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"

// Mock session data
const agentSession = {
  id: "session-1",
  status: "INACTIVE" as string,
  startTime: null as Date | null,
  questionsProcessed: 0,
  errors: 0,
}

export async function GET(_request: Request) {
  try {
    const auth = await getAuthenticatedAccount()
    
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json(agentSession)
  } catch (error) {
    logger.error("Error fetching session:", { error })
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    )
  }
}