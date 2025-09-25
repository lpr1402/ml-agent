import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendRevisionNotification } from "@/lib/services/whatsapp-professional"
import { buildN8NPayload, fetchBuyerQuestionsHistory } from "@/lib/webhooks/n8n-payload-builder"
import { decryptToken } from "@/lib/security/encryption"

const N8N_REVISION_WEBHOOK = process.env['N8N_WEBHOOK_EDIT_URL'] || "https://dashboard.axnexlabs.com.br/webhook/editar"

export async function POST(request: NextRequest) {
  try {
    // Verificar sessão
    const { getCurrentSession } = await import('@/lib/auth/ml-auth')
    const session = await getCurrentSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { questionId, feedback, editedResponse } = await request.json()
    
    if (!questionId || (!feedback && !editedResponse)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    
    // Buscar pergunta com informações completas da conta ML
    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        mlAccount: {
          organizationId: session.organizationId // Isolamento multi-tenant
        }
      },
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
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    if (!question.mlAccount) {
      return NextResponse.json({ error: "ML Account not found for this question" }, { status: 404 })
    }
    
    let revisedResponse = editedResponse
    
    // If edited response provided, use it directly
    if (editedResponse && editedResponse !== question.aiSuggestion) {
      logger.info("📝 Using manually edited response")
      revisedResponse = editedResponse
    } else if (feedback) {
      // Update status to REVISING
      await prisma.question.update({
        where: { id: questionId },
        data: { status: "REVISING" }
      })

      // Emitir evento WebSocket de revisão
      try {
        const { emitQuestionRevising } = require('@/lib/websocket/emit-events.js')
        emitQuestionRevising(
          question.mlQuestionId,
          feedback,
          question.mlAccount.organizationId
        )
      } catch (wsError) {
        logger.warn('[Revision] Failed to emit revising event', { error: wsError })
      }

      // Buscar dados completos do produto da API ML
      const { getValidMLToken } = await import('@/lib/ml-api/token-manager')
      const accessToken = await getValidMLToken(question.mlAccount.id)

      let itemData = null
      let descriptionData = null

      if (accessToken) {
        // Buscar dados do produto
        try {
          const itemResponse = await fetch(`https://api.mercadolibre.com/items/${question.itemId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          if (itemResponse.ok) {
            itemData = await itemResponse.json()
          }

          // Buscar descrição
          const descResponse = await fetch(`https://api.mercadolibre.com/items/${question.itemId}/description`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          if (descResponse.ok) {
            descriptionData = await descResponse.json()
          }
        } catch (err) {
          logger.warn('[Revision] Could not fetch item data:', { error: err })
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

      // Buscar histórico de perguntas do comprador
      const buyerQuestions = await fetchBuyerQuestionsHistory(
        question.customerId || '',
        question.mlAccount.organizationId,
        question.mlQuestionId,
        prisma,
        decryptToken
      )

      // Construir payload unificado com feedback de revisão
      const revisionPayload = await buildN8NPayload(
        {
          mlQuestionId: question.mlQuestionId,
          text: question.text,
          item_id: question.itemId,
          customerId: question.customerId // Adicionar customerId para histórico
        },
        itemData,
        descriptionData,
        buyerQuestions,
        {
          originalResponse: question.aiSuggestion || '',
          revisionFeedback: feedback
        }
      )
      
      logger.info("📝 Sending revision request to N8N:", { error: { error: revisionPayload } })
      
      // Send to N8N revision webhook with 2 minute timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minutes timeout

      let n8nResponse: Response
      try {
        n8nResponse = await fetch(N8N_REVISION_WEBHOOK, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(revisionPayload),
          signal: controller.signal
        })
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        logger.error("[Revision] N8N request failed:", {
          error: fetchError.name === 'AbortError' ? 'Request timeout after 2 minutes' : fetchError.message
        })

        // Update question status to FAILED with clear error
        await prisma.question.update({
          where: { id: questionId },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            failureReason: fetchError.name === 'AbortError'
              ? "IA demorou mais de 2 minutos para responder. Tente novamente."
              : "Erro ao conectar com o serviço de IA. Tente novamente."
          }
        })

        return NextResponse.json({
          error: fetchError.name === 'AbortError'
            ? "Timeout: A IA não respondeu em 2 minutos"
            : "Erro de conexão com serviço de IA"
        }, { status: 500 })
      } finally {
        clearTimeout(timeoutId)
      }
      
      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text()
        logger.error("N8N revision failed", { response: errorText })

        // Update to FAILED status with clear error message
        await prisma.question.update({
          where: { id: questionId },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            failureReason: `Erro na IA: ${errorText.substring(0, 200)}` // Limit error message size
          }
        })

        return NextResponse.json({
          error: "A IA retornou um erro. Tente novamente.",
          details: errorText
        }, { status: 500 })
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
        aiSuggestion: revisedResponse,
        status: "PENDING"
      }
    })
    
    // Send WhatsApp notification about revision
    await sendRevisionNotification({
      sequentialId: parseInt(question.id.slice(-6), 16) || 0,
      questionId,
      productTitle: question.itemTitle || "Produto",
      originalResponse: question.aiSuggestion || "",
      revisedResponse,
      approvalUrl: `https://gugaleo.axnexlabs.com.br/agente/aprovar/${questionId}`
    })
    
    // Update metrics if userMetrics table exists
    try {
      await prisma.userMetrics.update({
        where: { mlUserId: question.mlAccount.mlUserId },
        data: {
          revisedCount: { increment: 1 },
          lastActiveAt: new Date()
        }
      })
    } catch (metricsError) {
      logger.warn('Could not update metrics:', { error: { error: metricsError } })
    }
    
    return NextResponse.json({
      success: true,
      message: "Response revised successfully",
      revisedResponse
    })
    
  } catch (error) {
    logger.error("Revision error:", { error })
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
    logger.error("Get revisions error:", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}