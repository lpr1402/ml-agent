import { logger } from '@/lib/logger'

import { getHighlights } from "../all-metrics-endpoints"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { NextResponse } from "next/server"

export async function GET(_request: Request) {
  try {
    const auth = await getAuthenticatedAccount()
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    const highlights = await getHighlights(auth.mlAccount.mlUserId)
    return NextResponse.json(highlights)
  } catch (error) {
    logger.error('[Highlights] Error:', { error })
    return NextResponse.json(
      { error: "Failed to fetch highlights" },
      { status: 500 }
    )
  }
}