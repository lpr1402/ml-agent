import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { executeMLApiCall, buildQueryString } from "@/lib/api/ml-api-base"
import { CacheTTL } from "@/lib/api/cache-manager"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/mercadolibre/questions
 * Busca perguntas recebidas seguindo documentação oficial ML
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const status = searchParams.get("status") || ""
  const limit = searchParams.get("limit") || "50"
  const offset = searchParams.get("offset") || "0"
  const sort = searchParams.get("sort") || "date_desc"
  const itemId = searchParams.get("item_id")
  
  // Construir query parameters
  const queryParams: Record<string, any> = {
    limit: parseInt(limit),
    offset: parseInt(offset),
    sort,
    api_version: 4
  }
  
  // Adicionar filtros conforme documentação ML
  if (status && status !== "all") {
    if (status === "UNANSWERED") {
      queryParams["status"] = "unanswered"
    } else if (status === "ANSWERED") {
      queryParams["status"] = "answered"
    }
  }
  
  if (itemId) {
    queryParams["item"] = itemId
  }
  
  const queryString = buildQueryString(queryParams)
  const endpoint = `/my/received_questions/search${queryString}`
  
  return executeMLApiCall({
    endpoint,
    cache: {
      enabled: true,
      ttl: CacheTTL.QUESTIONS, // 2 minutos - perguntas mudam frequentemente
      key: `questions:${status}:${limit}:${offset}:${itemId || 'all'}`
    },
    circuit: {
      name: 'ML-Questions',
      config: {
        failureThreshold: 4,
        resetTimeout: 30000, // 30 segundos
        monitoringPeriod: 60000,
        requestTimeout: 30000,
        volumeThreshold: 8,
        errorThreshold: 50
      }
    },
    rateLimit: {
      maxRetries: 3,
      initialDelay: 1000
    }
  }, (data) => {
    // Processar perguntas para formato padronizado
    const questions = data.questions || data.results || []
    
    return {
      questions: questions.map((q: any) => ({
        id: q.id,
        item_id: q.item_id,
        seller_id: q.seller_id,
        customer_id: q.from?.id,
        customer_nickname: q.from?.nickname,
        text: q.text,
        status: q.status,
        answer: q.answer ? {
          text: q.answer.text,
          date_created: q.answer.date_created,
          status: q.answer.status
        } : null,
        date_created: q.date_created,
        hold: q.hold,
        deleted_from_listing: q.deleted_from_listing,
        can_reply: q.status === 'UNANSWERED' || q.status === 'unanswered',
        // Adicionar informações do item se disponível
        item: q.item ? {
          id: q.item.id,
          title: q.item.title,
          price: q.item.price,
          thumbnail: q.item.thumbnail,
          permalink: q.item.permalink
        } : null
      })),
      paging: {
        total: data.total || questions.length,
        offset: data.paging?.offset || parseInt(offset),
        limit: data.paging?.limit || parseInt(limit)
      },
      filters: data.filters || {
        status: status || 'all',
        item_id: itemId || null
      },
      _timestamp: new Date().toISOString()
    }
  })
}

/**
 * POST /api/mercadolibre/questions/answer
 * Responder uma pergunta seguindo documentação oficial ML
 */
export async function POST(_request: Request) {
  try {
    const body = await _request.json()
    const { question_id, text } = body
    
    if (!question_id || !text) {
      return NextResponse.json(
        { error: "Missing question_id or text" },
        { status: 400 }
      )
    }
    
    // Obter autenticação
    const auth = await getAuthenticatedAccount()
    if (!auth) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }
    
    // Endpoint oficial para responder perguntas
    const endpoint = `/answers`
    const url = `https://api.mercadolibre.com${endpoint}?api_version=4`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        question_id,
        text
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[Questions API] Error answering question: ${response.status}`, { error: { error: errorText } })
      
      if (response.status === 429) {
        return NextResponse.json(
          { 
            error: "Rate limited",
            message: "Too many requests. Please wait before answering more questions."
          },
          { status: 429 }
        )
      }
      
      if (response.status === 400) {
        return NextResponse.json(
          { 
            error: "Invalid request",
            message: "The question may have already been answered or deleted."
          },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: "Failed to answer question" },
        { status: response.status }
      )
    }
    
    const result = await response.json()
    
    // CRÍTICO: Registrar resposta com isolamento por organization
    try {
      // Primeiro buscar a question para validar organizationId
      const question = await prisma.question.findFirst({
        where: { 
          mlQuestionId: question_id,
          mlAccount: {
            organizationId: auth.organizationId // ISOLAMENTO POR TENANT
          }
        },
        select: { id: true }
      })
      
      if (question) {
        await prisma.question.update({
          where: { id: question.id }, // Usar ID interno após validação
          data: {
            status: 'ANSWERED',
            answer: text,
            answeredAt: new Date(),
            answeredBy: 'MANUAL'
          }
        })
      }
    } catch (dbError) {
      logger.error('[Questions API] Failed to update database:', { error: { error: dbError } })
      // Não falhar a requisição se apenas o banco falhar
    }
    
    return NextResponse.json({
      success: true,
      answer: result,
      _timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error('[Questions API] Error answering question:', { error })
    return NextResponse.json(
      { 
        error: "Failed to answer question",
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}