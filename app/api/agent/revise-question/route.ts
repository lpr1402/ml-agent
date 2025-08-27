import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendRevisionNotification } from "@/lib/services/whatsapp-professional"
import { getAuthFromRequest } from "@/app/api/mercadolibre/base"

const N8N_REVISION_WEBHOOK = "https://dashboard.axnexlabs.com.br/webhook/revisao"

export async function POST(request: NextRequest) {
  try {
    // Get user authentication from request headers
    const auth = await getAuthFromRequest(request)
    
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { questionId, feedback, editedResponse } = await request.json()
    
    if (!questionId || (!feedback && !editedResponse)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    
    // Get question details
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    })
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }
    
    let revisedResponse = editedResponse
    
    // If edited response provided, use it directly
    if (editedResponse && editedResponse !== question.aiResponse) {
      console.log("📝 Using manually edited response")
      revisedResponse = editedResponse
    } else if (feedback) {
      // Update status to REVISING
      await prisma.question.update({
        where: { id: questionId },
        data: { status: "REVISING" }
      })
      
      // Prepare complete payload for N8N revision agent (same format as processamento)
      const revisionPayload = {
        // Basic question info
        questionid: question.mlQuestionId,
        question_text: question.text,
        seller_id: question.mlUserId,
        item_id: question.itemId,
        
        // Product details
        product_info: {
          title: question.itemTitle,
          price: question.itemPrice,
          permalink: question.itemPermalink,
          item_id: question.itemId
        },
        
        // Original AI response and revision request
        original_response: question.aiResponse,
        revision_feedback: feedback,
        
        // Context for better revision
        signature: `\n\nAtenciosamente,\nEquipe de Vendas`,
        response_instructions: `REVISE a resposta anterior com base no feedback do vendedor. Mantenha o tom profissional e objetivo. Máximo 500 caracteres. Responda em português brasileiro.`,
        
        // Memory key for context
        memory_key: `${question.itemId}_${question.mlUserId}`,
        
        // Metadata
        metadata: {
          question_id: question.mlQuestionId,
          item_id: question.itemId,
          seller_id: question.mlUserId,
          revision_requested_at: new Date().toISOString(),
          sequential_id: question.sequentialId
        }
      }
      
      console.log("📝 Sending revision request to N8N:", revisionPayload)
      
      // Send to N8N revision webhook
      const n8nResponse = await fetch(N8N_REVISION_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(revisionPayload)
      })
      
      if (!n8nResponse.ok) {
        console.error("N8N revision failed:", await n8nResponse.text())
        
        await prisma.question.update({
          where: { id: questionId },
          data: { status: "AWAITING_APPROVAL" } // Revert status
        })
        
        return NextResponse.json({ error: "Revision failed" }, { status: 500 })
      }
      
      // N8N will respond with revised answer
      const response = await n8nResponse.json()
      revisedResponse = response.output
    }
    
    // Create revision record
    await prisma.revision.create({
      data: {
        questionId,
        userFeedback: feedback || "Manual edit",
        aiRevision: revisedResponse
      }
    })
    
    // Update question with revised response
    await prisma.question.update({
      where: { id: questionId },
      data: {
        aiResponse: revisedResponse,
        status: "AWAITING_APPROVAL"
      }
    })
    
    // Send WhatsApp notification about revision
    await sendRevisionNotification({
      sequentialId: question.sequentialId,
      questionId,
      productTitle: question.itemTitle || "Produto",
      originalResponse: question.aiResponse || "",
      revisedResponse,
      approvalUrl: `https://arabic-breeding-greatly-citizens.trycloudflare.com/agente/aprovar/${questionId}`
    })
    
    // Update metrics
    await prisma.userMetrics.update({
      where: { mlUserId: question.mlUserId },
      data: {
        revisedCount: { increment: 1 },
        lastActiveAt: new Date()
      }
    })
    
    return NextResponse.json({
      success: true,
      message: "Response revised successfully",
      revisedResponse
    })
    
  } catch (error) {
    console.error("Revision error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Get revision history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get("questionId")
    
    if (!questionId) {
      return NextResponse.json({ error: "Missing question ID" }, { status: 400 })
    }
    
    const revisions = await prisma.revision.findMany({
      where: { questionId },
      orderBy: { createdAt: "desc" }
    })
    
    return NextResponse.json({ revisions })
    
  } catch (error) {
    console.error("Get revisions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}