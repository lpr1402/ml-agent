import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
// import { tokenManager } from "@/lib/token-manager" // Reserved for future use
import { zapsterService } from "@/lib/services/zapster-whatsapp"
import { buildN8NPayload, fetchBuyerQuestionsHistory } from "@/lib/webhooks/n8n-payload-builder"
import { decryptToken } from "@/lib/security/encryption"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ questionId: string }> }
) {
  try {
    const params = await context.params
    const questionId = params.questionId
    const body = await request.json()
    const { action, feedback, editedResponse } = body
    
    // Get question WITH ML Account data for proper multi-tenant isolation
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        mlAccount: {
          select: {
            id: true,
            mlUserId: true,
            nickname: true,
            organizationId: true
          }
        }
      }
    })
    
    if (!question || !question.mlAccount) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    
    // Check if already processed (link used)
    if (question.status === "COMPLETED" || question.status === "APPROVED") {
      return NextResponse.json({ error: "Already processed" }, { status: 400 })
    }
    
    if (action === "approve") {
      // Import token manager for this specific ML Account
      const { getValidMLToken } = await import('@/lib/ml-api/token-manager')
      
      // Get access token for the SPECIFIC ML Account (not just by seller ID)
      const accessToken = await getValidMLToken(question.mlAccount.id)
      
      if (!accessToken) {
        return NextResponse.json({ error: "No access token" }, { status: 401 })
      }
      
      // Use edited response if provided, otherwise use AI response
      const finalResponse = editedResponse || question.aiSuggestion
      
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
        logger.error("ML API error:", { error: { error: errorText } })
        return NextResponse.json({ error: "Failed to send to ML" }, { status: 500 })
      }
      
      // Update question
      await prisma.question.update({
        where: { id: questionId },
        data: {
          status: "SENT_TO_ML", // Enviada ao ML, aguardando confirmação manual
          answer: finalResponse,
          answeredAt: new Date(),
          approvedAt: new Date(),
          approvalType: editedResponse ? "MANUAL" : "QUICK",
          sentToMLAt: new Date(),
          mlResponseCode: mlResponse.status
        }
      })
      
      // Update metrics - using mlAccount.mlUserId for consistency
      // Only update if metrics exist (upsert not used to avoid creating orphan records)
      const metricsExist = await prisma.userMetrics.findUnique({
        where: { mlUserId: question.mlAccount.mlUserId }
      })
      
      if (metricsExist) {
        await prisma.userMetrics.update({
          where: { mlUserId: question.mlAccount.mlUserId },
          data: {
            answeredQuestions: { increment: 1 },
            pendingQuestions: { decrement: 1 },
            autoApprovedCount: { increment: 1 }
          }
        })
      }
      
      // Send WhatsApp confirmation com parâmetros corretos
      await zapsterService.sendApprovalConfirmation({
        sequentialId: parseInt(question.id.slice(-6), 16) || 0,
        questionText: question.text,
        finalAnswer: finalResponse,
        productTitle: question.itemTitle || "Produto",
        sellerName: question.mlAccount.nickname || "Vendedor",
        approved: true
      })
      
      return NextResponse.json({ success: true })
      
    } else if (action === "revise") {
      // If edited response provided, update question directly
      if (editedResponse && editedResponse !== question.aiSuggestion) {
        await prisma.question.update({
          where: { id: questionId },
          data: { 
            status: "AWAITING_APPROVAL",
            aiSuggestion: editedResponse
          }
        })
      } else if (feedback) {
        // Send revision request to N8N
        await prisma.question.update({
          where: { id: questionId },
          data: { status: "REVISING" }
        })
        
        // Buscar dados do produto e histórico para revisão
        const { getValidMLToken } = await import('@/lib/ml-api/token-manager')
        const accessToken = await getValidMLToken(question.mlAccount.id)

        let itemData = null
        let descriptionData = null

        if (accessToken) {
          try {
            const itemResponse = await fetch(`https://api.mercadolibre.com/items/${question.itemId}`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            })
            if (itemResponse.ok) {
              itemData = await itemResponse.json()
            }

            const descResponse = await fetch(`https://api.mercadolibre.com/items/${question.itemId}/description`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            })
            if (descResponse.ok) {
              descriptionData = await descResponse.json()
            }
          } catch (err) {
            logger.warn('[Approve] Could not fetch item data:', { error: err })
          }
        }

        // Fallback para dados armazenados
        if (!itemData) {
          itemData = {
            id: question.itemId,
            title: question.itemTitle || 'Produto',
            price: question.itemPrice || 0,
            permalink: question.itemPermalink || ''
          }
        }

        // Buscar histórico de perguntas
        const buyerQuestions = await fetchBuyerQuestionsHistory(
          question.customerId || '',
          question.mlAccount.organizationId,
          question.mlQuestionId,
          prisma,
          decryptToken
        )

        // Construir payload unificado com feedback
        const revisionPayload = await buildN8NPayload(
          {
            mlQuestionId: question.mlQuestionId,
            text: question.text,
            item_id: question.itemId
          },
          itemData,
          descriptionData,
          buyerQuestions,
          {
            originalResponse: question.aiSuggestion || '',
            revisionFeedback: feedback
          }
        )
        
        const n8nRevisionUrl = process.env['N8N_WEBHOOK_EDIT_URL'] || "https://dashboard.axnexlabs.com.br/webhook/editar"
        const n8nResponse = await fetch(n8nRevisionUrl, {
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
                aiSuggestion: output,
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
      
      // Send WhatsApp notification com parâmetros corretos
      await zapsterService.sendApprovalConfirmation({
        sequentialId: parseInt(question.id.slice(-6), 16) || 0,
        questionText: question.text,
        finalAnswer: editedResponse || question.aiSuggestion!,
        productTitle: question.itemTitle || "Produto",
        sellerName: question.mlAccount.nickname || "Vendedor",
        approved: false
      })
      
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    
  } catch (error) {
    logger.error("Approval error:", { error })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}