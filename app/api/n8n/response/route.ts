import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendQuestionNotification } from "@/lib/services/whatsapp-professional"

const NEW_TUNNEL_URL = "https://arabic-breeding-greatly-citizens.trycloudflare.com"

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    console.log("🤖 N8N Response received:", payload)
    
    const { output, questionid } = payload
    
    if (!output || !questionid) {
      return NextResponse.json({ error: "Missing output or questionid" }, { status: 400 })
    }
    
    // Update question with AI response
    const question = await prisma.question.update({
      where: { mlQuestionId: questionid },
      data: {
        aiResponse: output,
        aiProcessedAt: new Date(),
        status: "AWAITING_APPROVAL"
      },
      include: {
        user: true
      }
    })
    
    // Update user metrics
    await prisma.userMetrics.update({
      where: { mlUserId: question.mlUserId },
      data: {
        lastActiveAt: new Date()
      }
    })
    
    // Get product image
    let productImage: string | undefined
    try {
      const itemResponse = await fetch(`https://api.mercadolibre.com/items/${question.itemId}`)
      if (itemResponse.ok) {
        const itemData = await itemResponse.json()
        productImage = itemData.pictures?.[0]?.url || itemData.thumbnail
      }
    } catch (error) {
      console.log("Could not fetch product image:", error)
    }
    
    // Send WhatsApp notification with sequential ID
    try {
      await sendQuestionNotification({
        questionId: question.id,
        sequentialId: question.sequentialId,
        mlQuestionId: question.mlQuestionId,
        question: question.text,
        aiResponse: output,
        productTitle: question.itemTitle || "Produto",
        productPrice: question.itemPrice || 0,
        productImage,
        approvalUrl: `${NEW_TUNNEL_URL}/approve/${question.id}`
      })
      
      await prisma.question.update({
        where: { id: question.id },
        data: { whatsappSentAt: new Date() }
      })
      
      console.log("✅ WhatsApp notification sent")
    } catch (whatsappError) {
      console.error("WhatsApp error (non-critical):", whatsappError)
    }
    
    return NextResponse.json({
      status: "success",
      message: "AI response received and stored",
      questionId: question.id
    })
    
  } catch (error) {
    console.error("N8N response error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET endpoint to check status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get("questionId")
    
    if (!questionId) {
      return NextResponse.json({ error: "Missing questionId" }, { status: 400 })
    }
    
    const question = await prisma.question.findUnique({
      where: { mlQuestionId: questionId },
      select: {
        id: true,
        mlQuestionId: true,
        status: true,
        text: true,
        aiResponse: true,
        finalResponse: true,
        aiProcessedAt: true,
        approvedAt: true,
        sentToMLAt: true
      }
    })
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }
    
    return NextResponse.json(question)
    
  } catch (error) {
    console.error("Status check error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}