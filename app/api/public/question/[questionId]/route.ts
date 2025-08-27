import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ questionId: string }> }
) {
  try {
    const params = await context.params
    const questionId = params.questionId
    
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        sequentialId: true,
        mlQuestionId: true,
        text: true,
        aiResponse: true,
        itemTitle: true,
        itemPrice: true,
        itemPermalink: true,
        itemId: true,
        status: true,
        approvedAt: true,
        receivedAt: true
      }
    })
    
    if (!question) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    
    // Check if link already used (question already processed)
    if (question.status === "COMPLETED" || question.status === "APPROVED") {
      return NextResponse.json({ error: "AlreadyUsed" }, { status: 410 })
    }
    
    return NextResponse.json(question)
    
  } catch (error) {
    console.error("Error fetching question:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}