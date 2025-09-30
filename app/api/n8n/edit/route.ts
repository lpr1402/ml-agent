import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/n8n/edit
 * Recebe resposta editada pela IA do N8N
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    console.log("🔥🔥🔥 [N8N EDIT] Response received from N8N:", {
      output: payload.output?.substring(0, 100),
      questionid: payload.questionid,
      internalId: payload.internalId,
      hasOutput: !!payload.output
    })
    logger.info("🤖 N8N Edit Response received:", { payload })
    
    const { 
      output,        // Nova resposta editada pela IA
      questionid,    // ML Question ID
      internalId,    // Nossa ID interna
      editInstruction // Instrução de edição original
    } = payload
    
    if (!output || (!questionid && !internalId)) {
      return NextResponse.json({ 
        error: "Missing output or question identifier" 
      }, { status: 400 })
    }
    
    // Buscar pergunta por ID interno ou ML ID
    let question = null
    
    if (internalId) {
      question = await prisma.question.findUnique({
        where: { id: internalId }
      })
    }
    
    if (!question && questionid) {
      question = await prisma.question.findUnique({
        where: { mlQuestionId: questionid }
      })
    }
    
    if (!question) {
      logger.error("Question not found for edit response:", { 
        internalId, 
        questionid 
      })
      return NextResponse.json({ 
        error: "Question not found" 
      }, { status: 404 })
    }
    
    // Atualizar pergunta com nova resposta editada
    await prisma.question.update({
      where: { id: question.id },
      data: {
        aiSuggestion: output,  // Atualizar sugestão da IA
        aiProcessedAt: new Date(),
        status: "AWAITING_APPROVAL", // Voltar para aprovação
        updatedAt: new Date()
      }
    })

    // Buscar dados completos da conta ML e organização primeiro
    const mlAccount = await prisma.mLAccount.findUnique({
      where: { id: question.mlAccountId },
      include: {
        organization: true
      }
    })

    // Emitir evento WebSocket de resposta revisada pronta
    try {
      const { emitQuestionEvent } = require('@/lib/websocket/emit-events.js')

      // Usar organizationId da conta já buscada
      const organizationId = mlAccount?.organizationId

      // Emitir evento de atualização com resposta revisada
      emitQuestionEvent(
        question.mlQuestionId,
        'updated',
        {
          mlQuestionId: question.mlQuestionId,
          questionId: question.id,
          status: 'AWAITING_APPROVAL',
          aiSuggestion: output,
          revisedAnswer: output,
          data: {
            aiSuggestion: output
          }
        },
        organizationId
      )

      logger.info('[Edit N8N] WebSocket event emitted for revised response', {
        questionId: question.mlQuestionId,
        status: 'AWAITING_APPROVAL',
        event: 'question:updated'
      })
    } catch (wsError) {
      logger.warn('[Edit N8N] Failed to emit WebSocket event', { error: wsError })
    }
    
    if (!mlAccount) {
      throw new Error("ML Account not found")
    }
    
    // Buscar imagem do produto
    let productImage: string | undefined
    try {
      const itemResponse = await fetch(`https://api.mercadolibre.com/items/${question.itemId}`)
      if (itemResponse.ok) {
        const itemData = await itemResponse.json()
        productImage = itemData.pictures?.[0]?.url || itemData.thumbnail
      }
    } catch (error) {
      logger.info("Could not fetch product image:", { error })
    }
    
    // Não precisa de URL de aprovação ao editar - já foi enviado o link único inicial
    
    logger.info("📱 Sending WhatsApp notification for edited response", {
      seller: mlAccount.nickname,
      questionId: question.id,
      mlQuestionId: question.mlQuestionId,
      editInstruction
    })
    
    // NÃO enviar notificação WhatsApp ao editar - apenas quando receber primeira vez e enviar ao ML
    // A notificação já foi enviada quando a resposta inicial chegou
    logger.info("📝 Response edited by AI - No WhatsApp notification needed", {
      seller: mlAccount.nickname,
      questionId: question.id,
      editInstruction
    })
    
    // Dados para notificação do browser
    const browserNotificationData = {
      type: 'edited_response',
      sequentialId: parseInt(question.id.slice(-6), 16) || 0,
      questionText: question.text,
      productTitle: question.itemTitle || "Produto",
      productImage: productImage,
      sellerName: mlAccount.nickname,
      approvalUrl: '', // Não usar link no browser,
      questionId: question.id,
      editInstruction,
      newResponse: output
    }
    
    logger.info("📱 Browser notification data prepared for edited response", browserNotificationData)
    
    return NextResponse.json({
      status: "success",
      message: "AI edited response received and stored",
      questionId: question.id,
      mlQuestionId: question.mlQuestionId,
      editedResponse: output
    })
    
  } catch (error) {
    logger.error("N8N edit response error:", { error })
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
}

/**
 * GET /api/n8n/edit
 * Verifica status de edição
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get("questionId")
    
    if (!questionId) {
      return NextResponse.json({ 
        error: "Missing questionId" 
      }, { status: 400 })
    }
    
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        mlQuestionId: true,
        status: true,
        text: true,
        aiSuggestion: true,
        answer: true,
        aiProcessedAt: true,
        approvedAt: true,
        updatedAt: true
      }
    })
    
    if (!question) {
      return NextResponse.json({ 
        error: "Question not found" 
      }, { status: 404 })
    }
    
    return NextResponse.json({
      ...question,
      isEditing: question.status === "EDITING_WITH_AI"
    })
    
  } catch (error) {
    logger.error("Edit status check error:", { error })
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
}