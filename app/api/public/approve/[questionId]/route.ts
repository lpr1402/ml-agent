import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { tokenManager } from "@/lib/token-manager"
import { sendApprovalConfirmation } from "@/lib/services/whatsapp-professional"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ questionId: string }> }
) {
  try {
    const params = await context.params
    const questionId = params.questionId
    const body = await request.json()
    const { action, feedback, editedResponse } = body
    
    // Get question
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    })
    
    if (!question) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    
    // Check if already processed (link used)
    if (question.status === "COMPLETED" || question.status === "APPROVED") {
      return NextResponse.json({ error: "Already processed" }, { status: 400 })
    }
    
    if (action === "approve") {
      // Get access token
      const accessToken = await tokenManager.getAccessToken(question.mlUserId)
      
      if (!accessToken) {
        return NextResponse.json({ error: "No access token" }, { status: 401 })
      }
      
      // Use edited response if provided, otherwise use AI response
      const finalResponse = editedResponse || question.aiResponse
      
      // Send to Mercado Livre
      const mlResponse = await fetch(
        `https://api.mercadolibre.com/answers?api_version=4`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            question_id: question.mlQuestionId,
            text: finalResponse
          })
        }
      )
      
      if (!mlResponse.ok) {
        const errorText = await mlResponse.text()
        console.error("ML API error:", errorText)
        return NextResponse.json({ error: "Failed to send to ML" }, { status: 500 })
      }
      
      // Update question
      await prisma.question.update({
        where: { id: questionId },
        data: {
          status: "COMPLETED",
          finalResponse: finalResponse,
          approvedAt: new Date(),
          approvalType: editedResponse ? "MANUAL" : "QUICK",
          sentToMLAt: new Date(),
          mlResponseCode: mlResponse.status
        }
      })
      
      // Update metrics
      await prisma.userMetrics.update({
        where: { mlUserId: question.mlUserId },
        data: {
          answeredQuestions: { increment: 1 },
          pendingQuestions: { decrement: 1 },
          autoApprovedCount: { increment: 1 }
        }
      })
      
      // Send WhatsApp confirmation
      await sendApprovalConfirmation({
        sequentialId: question.sequentialId,
        questionText: question.text,
        finalAnswer: finalResponse,
        productTitle: question.itemTitle || "Produto",
        approved: true
      })
      
      return NextResponse.json({ success: true })
      
    } else if (action === "revise") {
      // If edited response provided, update question directly
      if (editedResponse && editedResponse !== question.aiResponse) {
        await prisma.question.update({
          where: { id: questionId },
          data: { 
            status: "AWAITING_APPROVAL",
            aiResponse: editedResponse
          }
        })
      } else if (feedback) {
        // Send revision request to N8N
        await prisma.question.update({
          where: { id: questionId },
          data: { status: "REVISING" }
        })
        
        // Send to N8N for revision with complete context
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
        
        const n8nResponse = await fetch("https://dashboard.axnexlabs.com.br/webhook/revisao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(revisionPayload)
        })
        
        if (n8nResponse.ok) {
          const { output } = await n8nResponse.json()
          if (output) {
            await prisma.question.update({
              where: { id: questionId },
              data: { 
                aiResponse: output,
                status: "AWAITING_APPROVAL"
              }
            })
          }
        }
      }
      
      // Create revision record
      await prisma.revision.create({
        data: {
          questionId: questionId,
          userFeedback: feedback || "Manual edit",
          aiRevision: editedResponse || "" // Will be filled by N8N if not edited manually
        }
      })
      
      // Send WhatsApp notification
      await sendApprovalConfirmation({
        sequentialId: question.sequentialId,
        questionText: question.text,
        finalAnswer: editedResponse || question.aiResponse!,
        productTitle: question.itemTitle || "Produto",
        approved: false
      })
      
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    
  } catch (error) {
    console.error("Approval error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}