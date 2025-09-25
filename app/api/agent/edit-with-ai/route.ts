import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { buildN8NPayload, fetchBuyerQuestionsHistory } from "@/lib/webhooks/n8n-payload-builder"
import { decryptToken } from "@/lib/security/encryption"
import { fetchCompleteProductData } from "@/lib/ml-api/enhanced-product-fetcher"

const N8N_EDIT_WEBHOOK_URL = process.env['N8N_WEBHOOK_EDIT_URL'] || "https://dashboard.axnexlabs.com.br/webhook/editar"

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const auth = await getAuthenticatedAccount()
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    const { 
      questionId, 
      editInstruction,
      previousAnswer 
    } = await request.json()
    
    if (!questionId || !editInstruction) {
      return NextResponse.json(
        { error: "Missing required fields: questionId, editInstruction" }, 
        { status: 400 }
      )
    }
    
    // Buscar a pergunta completa
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        mlAccount: {
          select: {
            id: true,
            nickname: true,
            organizationId: true,
            mlUserId: true,
            accessToken: true,
            accessTokenIV: true,
            accessTokenTag: true
          }
        }
      }
    })
    
    if (!question) {
      return NextResponse.json(
        { error: "Question not found" }, 
        { status: 404 }
      )
    }
    
    // Verificar se a pergunta pertence à organização do usuário
    if (question.mlAccount.organizationId !== auth.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" }, 
        { status: 403 }
      )
    }
    
    // Buscar informações COMPLETAS do produto usando Enhanced Product Fetcher
    let completeProductData = null

    // Descriptografar token para buscar dados completos
    const mlToken = decryptToken({
      encrypted: question.mlAccount.accessToken,
      iv: question.mlAccount.accessTokenIV!,
      authTag: question.mlAccount.accessTokenTag!
    })

    if (question.itemId) {
      logger.info(`[Edit AI] Fetching complete product data for item ${question.itemId}`)
      completeProductData = await fetchCompleteProductData(question.itemId, mlToken)

      if (!completeProductData) {
        logger.warn(`[Edit AI] Could not fetch complete product data, using basic info`)
        // Fallback para dados básicos da pergunta
        completeProductData = {
          id: question.itemId,
          title: question.itemTitle || 'Produto',
          price: question.itemPrice || 0,
          permalink: question.itemPermalink || '',
          condition: 'not_specified',
          available_quantity: 0,
          sold_quantity: 0,
          status: '',
          category_id: '',
          listing_type_id: ''
        }
      } else {
        logger.info(`[Edit AI] Complete product data fetched:`, {
          hasDescription: !!completeProductData.description,
          variationsCount: completeProductData.variations?.length || 0
        })
      }
    }
    
    // Buscar informações do vendedor (não utilizado atualmente, mas pode ser útil no futuro)
    try {
      const sellerResponse = await fetch(`https://api.mercadolibre.com/users/${question.mlAccount.mlUserId}`)
      if (sellerResponse.ok) {
        await sellerResponse.json() // Consumir resposta mesmo sem usar
      }
    } catch (error) {
      logger.warn("Could not fetch seller data:", { error })
    }
    
    // Buscar informações do COMPRADOR
    let buyerData = null
    if (question.customerId) {
      try {
        // Primeiro tentar com token
        const buyerResponse = await fetch(`https://api.mercadolibre.com/users/${question.customerId}`, {
          headers: {
            Authorization: `Bearer ${mlToken}`,
          },
        })
        if (buyerResponse.ok) {
          buyerData = await buyerResponse.json()
          logger.info(`[Edit AI] Buyer data found for ${question.customerId}:`, { nickname: buyerData.nickname })
        } else {
          // Tentar sem token
          const publicResponse = await fetch(`https://api.mercadolibre.com/users/${question.customerId}`)
          if (publicResponse.ok) {
            buyerData = await publicResponse.json()
            logger.info(`[Edit AI] Public buyer data found for ${question.customerId}:`, { nickname: buyerData.nickname })
          }
        }
      } catch (error) {
        logger.warn("Could not fetch buyer data:", { customerId: question.customerId, error })
      }
    }
    
    // Buscar histórico completo de perguntas do comprador em toda organização
    const previousQuestions = await fetchBuyerQuestionsHistory(
      question.customerId || '',
      question.mlAccount.organizationId,
      question.mlQuestionId,
      prisma,
      decryptToken
    )
    
    // Construir payload unificado para edição com IA com dados COMPLETOS
    const n8nPayload = await buildN8NPayload(
      {
        mlQuestionId: question.mlQuestionId,
        text: question.text,
        item_id: question.itemId,
        customerId: question.customerId
      },
      completeProductData, // Dados completos do produto incluindo descrição e variações
      completeProductData?.description || null, // Descrição já está em completeProductData
      previousQuestions,
      {
        originalResponse: previousAnswer || question.aiSuggestion || question.answer || "",
        revisionFeedback: editInstruction,  // Instrução de edição é o feedback para revisão
        sellerNickname: question.mlAccount.nickname || 'Vendedor'
      }
    )
    
    logger.info("🤖 Sending edit request to N8N:", { 
      questionId: question.id,
      mlQuestionId: question.mlQuestionId,
      instruction: editInstruction
    })
    
    // Atualizar status da pergunta
    await prisma.question.update({
      where: { id: questionId },
      data: {
        status: "EDITING_WITH_AI",
        updatedAt: new Date()
      }
    })
    
    // Enviar para N8N webhook de edição
    try {
      const n8nResponse = await fetch(N8N_EDIT_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ML-Agent/1.0"
        },
        body: JSON.stringify(n8nPayload)
      })
      
      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text()
        logger.error("N8N edit webhook error:", { 
          status: n8nResponse.status,
          error: errorText 
        })
        
        // Reverter status se falhar
        await prisma.question.update({
          where: { id: questionId },
          data: {
            status: "AWAITING_APPROVAL",
            updatedAt: new Date()
          }
        })
        
        return NextResponse.json(
          { error: "Failed to process edit request with AI" }, 
          { status: 500 }
        )
      }
      
      const n8nResult = await n8nResponse.json()
      logger.info("✅ Edit request sent to N8N successfully", { result: n8nResult })
      
      return NextResponse.json({
        success: true,
        message: "Edit request sent to AI. You will receive the updated response soon.",
        trackingId: n8nResult.executionId || question.id
      })
      
    } catch (error) {
      logger.error("Failed to send edit request to N8N:", { error })
      
      // Reverter status se falhar
      await prisma.question.update({
        where: { id: questionId },
        data: {
          status: "AWAITING_APPROVAL",
          updatedAt: new Date()
        }
      })
      
      return NextResponse.json(
        { error: "Failed to connect to AI service" }, 
        { status: 500 }
      )
    }
    
  } catch (error) {
    logger.error("Edit with AI error:", { error })
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    )
  }
}