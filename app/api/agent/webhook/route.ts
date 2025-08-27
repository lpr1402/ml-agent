import { NextRequest, NextResponse } from "next/server"

// Webhook endpoint for external AI agents (N8N, etc)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.mlQuestionId || !body.answer) {
      return NextResponse.json(
        { error: "Missing required fields: mlQuestionId, answer" },
        { status: 400 }
      )
    }

    // TODO: Process the answer
    // 1. Store in database
    // 2. Send to Mercado Livre API
    // 3. Update metrics

    // Mock response for now
    const response = {
      success: true,
      mlQuestionId: body.mlQuestionId,
      processed: true,
      sentToML: true,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    )
  }
}