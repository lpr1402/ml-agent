import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildN8NPayload, fetchBuyerQuestionsHistory } from "@/lib/webhooks/n8n-payload-builder"
import { fetchCompleteProductData } from "@/lib/ml-api/enhanced-product-fetcher"

const N8N_WEBHOOK_URL = process.env['N8N_WEBHOOK_URL'] || "https://dashboard.axnexlabs.com.br/webhook/processamento"

export async function POST(request: NextRequest) {
  try {
    // Log detalhado para debug
    logger.info('[Reprocess] Endpoint called', {
      method: request.method,
      url: request.url,
      headers: {
        contentType: request.headers.get('content-type'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer')
      }
    })

    // Parse do body com tratamento de erro
    let questionId: string
    try {
      const body = await request.json()
      questionId = body.questionId
      logger.info('[Reprocess] Body parsed successfully', { questionId })
    } catch (parseError) {
      logger.error('[Reprocess] Failed to parse request body', {
        error: parseError instanceof Error ? parseError.message : String(parseError)
      })
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    if (!questionId) {
      logger.warn('[Reprocess] Missing question ID in request')
      return NextResponse.json({ error: "Missing question ID" }, { status: 400 })
    }

    logger.info(`[Reprocess] Starting reprocess for question ${questionId}`)

    // Buscar a pergunta com informações completas da conta ML
    const question = await prisma.question.findUnique({
      where: {
        id: questionId
      },
      include: {
        mlAccount: {
          select: {
            id: true,
            mlUserId: true,
            nickname: true,
            organizationId: true,
            accessToken: true,
            accessTokenIV: true,
            accessTokenTag: true,
            isActive: true
          }
        }
      }
    })

    if (!question) {
      logger.warn(`[Reprocess] Question ${questionId} not found`)
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    if (!question.mlAccount) {
      return NextResponse.json({ error: "ML Account not found for this question" }, { status: 404 })
    }

    // 🎯 Permite reprocessar perguntas SEM resposta da IA que:
    // 1. Falharam (FAILED, TOKEN_ERROR, ERROR)
    // 2. Estão travadas (RECEIVED, PROCESSING há mais de 5 minutos sem dados)
    const allowedStatuses = ["FAILED", "TOKEN_ERROR", "ERROR", "RECEIVED", "PROCESSING"]

    // Se já tem resposta da IA, não deve reprocessar (usar revisão em vez disso)
    if (question.aiSuggestion) {
      return NextResponse.json({
        error: "Question already has AI response. Use revision instead.",
        currentStatus: question.status,
        hasAISuggestion: true
      }, { status: 400 })
    }

    if (!allowedStatuses.includes(question.status)) {
      return NextResponse.json({
        error: "Only failed or stuck questions can be reprocessed",
        currentStatus: question.status
      }, { status: 400 })
    }

    // 🎯 Para perguntas RECEIVED/PROCESSING, verificar se realmente está travada (>5min)
    if (question.status === 'RECEIVED' || question.status === 'PROCESSING') {
      const receivedDate = question.receivedAt || question.dateCreated || question.createdAt
      if (receivedDate) {
        const timeSinceReceived = Date.now() - new Date(receivedDate).getTime()
        const fiveMinutesInMs = 5 * 60 * 1000

        // Se ainda não passou 5 minutos E não tem texto genérico, não permite reprocessar
        const hasGenericText = question.text?.includes('Processando') ||
                               question.text?.includes('dados pendentes') ||
                               question.text?.includes('Clique em "Reprocessar"')

        if (timeSinceReceived < fiveMinutesInMs && !hasGenericText) {
          return NextResponse.json({
            error: "Question is still being processed. Please wait at least 5 minutes before reprocessing.",
            currentStatus: question.status,
            timeSinceReceived: Math.floor(timeSinceReceived / 1000 / 60) + ' minutes'
          }, { status: 400 })
        }

        logger.info('[Reprocess] Reprocessing stuck question', {
          questionId: question.mlQuestionId,
          timeSinceReceived: Math.floor(timeSinceReceived / 1000 / 60) + ' minutes',
          hasGenericText
        })
      }
    }

    // Verificar se a conta está ativa
    if (!question.mlAccount.isActive) {
      return NextResponse.json({ error: "ML Account is not active" }, { status: 400 })
    }

    // Verificar se tem token
    if (!question.mlAccount.accessToken) {
      return NextResponse.json({ error: "No access token available for this ML account" }, { status: 400 })
    }

    // Descriptografar o token da conta específica que recebeu a pergunta
    const { decryptToken } = await import('@/lib/security/encryption')

    let mlToken: string
    try {
      mlToken = decryptToken({
        encrypted: question.mlAccount.accessToken,
        iv: question.mlAccount.accessTokenIV!,
        authTag: question.mlAccount.accessTokenTag!
      })
    } catch (error) {
      logger.error("[Reprocess] Failed to decrypt token", { error })
      return NextResponse.json({ error: "Failed to decrypt ML token" }, { status: 500 })
    }

    const sellerId = question.mlAccount.mlUserId
    const nickname = question.mlAccount.nickname

    logger.info(`[Reprocess] Processing question ${question.mlQuestionId} for seller ${nickname} (${sellerId})`)

    // Atualizar status para PROCESSING
    await prisma.question.update({
      where: { id: questionId },
      data: {
        status: "PROCESSING",
        failureReason: null,
        failedAt: null,
        retryCount: {
          increment: 1
        }
      }
    })

    // Get user data from ML
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${mlToken}`,
      },
    })
    
    // Validate user authentication with ML API
    if (userResponse.ok) {
      await userResponse.json() // Validate token is working
    }
    
    // Fetch COMPLETE product data using Enhanced Product Fetcher
    logger.info(`[Reprocess] Fetching complete product data for item ${question.itemId}`)
    let completeProductData = await fetchCompleteProductData(question.itemId, mlToken)

    if (!completeProductData) {
      logger.warn(`[Reprocess] Could not fetch complete product data, using fallback`)
      // Use stored data as fallback
      completeProductData = {
        id: question.itemId,
        title: question.itemTitle || 'Produto',
        price: question.itemPrice || 0,
        permalink: question.itemPermalink || '',
        available_quantity: 1,
        sold_quantity: 0,
        condition: 'not_specified',
        status: '',
        category_id: '',
        listing_type_id: ''
      }
    } else {
      logger.info(`[Reprocess] Complete product data fetched:`, {
        hasDescription: !!completeProductData.description,
        variationsCount: completeProductData.variations?.length || 0,
        picturesCount: completeProductData.pictures?.length || 0
      })
    }
    
    // Get seller info (não utilizado atualmente)
    await fetch(`https://api.mercadolibre.com/users/${sellerId}`, {
      headers: {
        Authorization: `Bearer ${mlToken}`,
      },
    }).then(r => r.ok ? r.json() : null)
    
    // Buscar informações do COMPRADOR - SEMPRE tentar buscar
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
          logger.info(`[Reprocess] Buyer data found for ${question.customerId}:`, { nickname: buyerData.nickname })
        } else {
          // Tentar sem token
          const publicResponse = await fetch(`https://api.mercadolibre.com/users/${question.customerId}`)
          if (publicResponse.ok) {
            buyerData = await publicResponse.json()
            logger.info(`[Reprocess] Public buyer data found for ${question.customerId}:`, { nickname: buyerData.nickname })
          }
        }
      } catch (error) {
        logger.warn("Could not fetch buyer data:", { customerId: question.customerId, error })
      }
    }
    
    // Buscar histórico completo de perguntas do comprador usando o builder
    const previousQuestions = await fetchBuyerQuestionsHistory(
      question.customerId || '',
      question.mlAccount.organizationId,
      question.mlQuestionId,
      prisma,
      decryptToken
    )
    
    // Construir payload unificado com dados COMPLETOS
    const n8nPayload = await buildN8NPayload(
      {
        mlQuestionId: question.mlQuestionId,
        text: question.text,
        item_id: question.itemId,
        customerId: question.customerId
      },
      completeProductData, // Dados completos incluindo descrição e variações
      completeProductData?.description || null, // Descrição já está em completeProductData
      previousQuestions,
      {
        sellerNickname: question.mlAccount.nickname || 'Vendedor'
      }
    )
    
    // Send to N8N for reprocessing with 2 minute timeout
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minutes timeout

      let n8nResponse: Response
      try {
        n8nResponse = await fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(n8nPayload),
          signal: controller.signal
        })
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        const errorMessage = fetchError.name === 'AbortError'
          ? "IA demorou mais de 2 minutos para responder"
          : `Erro de conexão: ${fetchError.message}`

        logger.error("[Reprocess] N8N request failed:", { error: errorMessage })

        // Update status to FAILED
        await prisma.question.update({
          where: { id: questionId },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            failureReason: errorMessage
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
        logger.error("[Reprocess] N8N webhook failed:", { error: { error: errorText } })

        // Update status to FAILED with clear error message
        await prisma.question.update({
          where: { id: questionId },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            failureReason: `Erro na IA: ${errorText.substring(0, 200)}`
          }
        })

        return NextResponse.json({
          error: "A IA retornou um erro. Tente novamente.",
          details: errorText
        }, { status: 500 })
      }
      
      logger.info(`[Reprocess] Question ${question.mlQuestionId} sent to N8N for reprocessing`)

      // Set a timeout check after 2 minutes
      setTimeout(async () => {
        // Check if question is still PROCESSING after 2 minutes
        const checkQuestion = await prisma.question.findUnique({
          where: { id: questionId },
          select: { status: true }
        })

        if (checkQuestion && checkQuestion.status === 'PROCESSING') {
          logger.error("[Reprocess] Question still processing after 2 minutes", { questionId })

          await prisma.question.update({
            where: { id: questionId },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              failureReason: 'IA não respondeu em 2 minutos. Tente novamente.'
            }
          })
        }
      }, 120000) // 2 minutes

      // N8N will send response back to /api/n8n/response
      return NextResponse.json({
        success: true,
        message: "Question sent for reprocessing",
        questionId: question.id
      })
      
    } catch (n8nError) {
      logger.error("[Reprocess] N8N request error:", { error: { error: n8nError } })
      
      // Update status back to FAILED
      await prisma.question.update({
        where: { id: questionId },
        data: { 
          status: "FAILED"
        }
      })
      
      return NextResponse.json({ 
        error: "Failed to connect to processing service" 
      }, { status: 500 })
    }
    
  } catch (error) {
    logger.error("[Reprocess] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error
    })

    // Retornar erro mais específico em desenvolvimento
    const errorMessage = process.env.NODE_ENV === 'development'
      ? `Internal server error: ${error instanceof Error ? error.message : String(error)}`
      : "Internal server error"

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  })
}

// GET endpoint to check if question can be reprocessed
export async function GET(_request: NextRequest) {
  try {
    const { searchParams } = new URL(_request.url)
    const questionId = searchParams.get("questionId")
    
    if (!questionId) {
      return NextResponse.json({ error: "Missing question ID" }, { status: 400 })
    }
    
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        status: true
      }
    })
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }
    
    const canReprocess = question.status === "FAILED" || question.status === "TOKEN_ERROR" || question.status === "ERROR"
    
    return NextResponse.json({
      canReprocess,
      status: question.status
    })
    
  } catch (error) {
    logger.error("[Reprocess] Check error:", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}