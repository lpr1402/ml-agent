import { subscriptionValidator } from '@/lib/subscription/plan-validator'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { zapsterService } from "@/lib/services/zapster-whatsapp"
import { sanitizeAnswerText } from "@/lib/security/input-validator"
import { logger } from "@/lib/logger"

// Function to post answer to ML following official documentation
async function postAnswerToML(
  questionId: string,
  answer: string,
  accessToken: string,
  maxRetries: number = 3
): Promise<{success: boolean; status: number; data: any; error?: string; isRateLimit?: boolean}> {
  let lastError: string = ""
  let isRateLimitError = false

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Converter question_id para número conforme documentação oficial
      const numericQuestionId = parseInt(questionId, 10)

      if (isNaN(numericQuestionId)) {
        logger.error(`[ML API] Invalid question_id: ${questionId} is not a valid number`)
        return {
          success: false,
          status: 400,
          data: null,
          error: `Invalid question_id format: ${questionId}`,
          isRateLimit: false
        }
      }

      // Formato EXATO da documentação oficial do ML
      const requestBody = {
        question_id: numericQuestionId,
        text: answer.trim()
      }

      logger.info(`[ML API] 🚀 Attempt ${attempt}/${maxRetries} - Posting answer`, {
        attempt,
        maxRetries,
        questionId: numericQuestionId,
        textLength: requestBody.text.length
      })

      // Fazer POST direto conforme documentação oficial
      const response = await fetch(
        "https://api.mercadolibre.com/answers",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        }
      )

      const responseText = await response.text()
      let data = null

      try {
        data = responseText ? JSON.parse(responseText) : null
      } catch {
        logger.error("Failed to parse ML response", { responseText })
      }

      if (response.ok || response.status === 201) {
        logger.info(`[ML API] ✅ SUCCESS! Answer posted to ML`, {
          questionId,
          status: response.status
        })
        return {
          success: true,
          status: response.status,
          data,
          isRateLimit: false
        }
      }

      // 🎯 TRATAMENTO ESPECIAL PARA 429 (Rate Limit)
      if (response.status === 429) {
        isRateLimitError = true
        const retryAfter = response.headers.get('retry-after')
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 60000 // Default 60s

        logger.warn(`[ML API] 🚫 Rate Limit 429 - attempt ${attempt}/${maxRetries}`, {
          questionId,
          retryAfter,
          delayMs: delay,
          willRetry: attempt < maxRetries
        })

        lastError = `Rate limit excedido. Aguardando ${delay/1000}s...`

        if (attempt < maxRetries) {
          logger.info(`[ML API] ⏳ Waiting ${delay}ms due to rate limit`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        } else {
          // Último retry falhou por rate limit
          lastError = "Rate limit do Mercado Livre. Tente novamente em alguns minutos."
          break
        }
      }

      // Check for "already answered"
      if (response.status === 400) {
        const errorMessage = data?.message || data?.error || responseText || ""
        if (errorMessage.includes("already answered") ||
            errorMessage.includes("is not unanswered")) {
          logger.info(`[ML API] Question ${questionId} already answered on ML`)
          return {
            success: true,
            status: 200,
            data: { message: "Question already answered on ML", original: data },
            isRateLimit: false
          }
        }

        logger.error(`[ML API] Bad Request (400)`, {
          questionId,
          errorMessage,
          sentPayload: requestBody
        })
      }

      // Don't retry on client errors (4xx) except 401/403/429
      if (response.status >= 400 && response.status < 500 &&
          response.status !== 401 && response.status !== 403 && response.status !== 429) {
        lastError = data?.message || data?.error || responseText || `Erro ${response.status}`
        logger.error(`[ML API] Client error (no retry)`, {
          status: response.status,
          error: lastError
        })
        break
      }

      lastError = data?.message || responseText || `HTTP ${response.status}`
      logger.error(`[ML API] Attempt ${attempt} failed`, { attempt, error: lastError })

      // Exponential backoff before retry
      if (attempt < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000) // Max 30 seconds
        logger.info(`[ML API] Waiting ${delay}ms before retry...`, { delay })
        await new Promise(resolve => setTimeout(resolve, delay))
      }

    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      logger.error(`[ML API] Network error on attempt ${attempt}`, { attempt, error: lastError })

      if (attempt < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  return {
    success: false,
    status: 0,
    data: null,
    error: lastError,
    isRateLimit: isRateLimitError
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar sessão
    const { getCurrentSession } = await import('@/lib/auth/ml-auth')
    const session = await getCurrentSession()

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Validate subscription limits
    const validation = await subscriptionValidator.validateAction(
      session.organizationId,
      'question'
    )

    if (!validation.allowed) {
      return NextResponse.json({
        error: validation.reason,
        upgradeRequired: validation.upgradeRequired
      }, { status: 403 })
    }
    
    const { questionId, action, response: userResponse } = await request.json()
    
    if (!questionId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    
    // Validar e sanitizar entrada - OBRIGATÓRIO para ML API
    let finalUserResponse = userResponse
    if (userResponse && typeof userResponse === 'string') {
      finalUserResponse = sanitizeAnswerText(userResponse)
      
      // Validar tamanho da resposta (ML limita a 2000 caracteres)
      if (!finalUserResponse || finalUserResponse.length === 0) {
        return NextResponse.json({ error: "Response cannot be empty" }, { status: 400 })
      }
      
      if (finalUserResponse.length > 2000) {
        return NextResponse.json({ 
          error: `Response too long: ${finalUserResponse.length}/2000 characters. ML API limit is 2000.` 
        }, { status: 400 })
      }
    }
    
    // Validar action
    if (!['approve', 'manual', 'revise'].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
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
      logger.warn(`[Approve] Unauthorized access attempt - Question ${questionId} not found for org ${session.organizationId}`)
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    if (!question.mlAccount) {
      return NextResponse.json({ error: "ML Account not found for this question" }, { status: 404 })
    }

    // Verificar se a conta está ativa
    if (!question.mlAccount.isActive) {
      return NextResponse.json({ error: "ML Account is not active" }, { status: 400 })
    }

    // Verificar se tem token
    if (!question.mlAccount.accessToken) {
      logger.error("[Approve] No token available", {
        accountId: question.mlAccount.id,
        nickname: question.mlAccount.nickname
      })
      return NextResponse.json({ error: "No access token available for this ML account" }, { status: 400 })
    }

    // Descriptografar o token da conta específica
    const { decryptToken } = await import('@/lib/security/encryption')

    // Verificar se temos todos os dados necessários para descriptografar
    if (!question.mlAccount.accessTokenIV || !question.mlAccount.accessTokenTag) {
      logger.error("[Approve] Missing token encryption data", {
        accountId: question.mlAccount.id,
        hasIV: !!question.mlAccount.accessTokenIV,
        hasTag: !!question.mlAccount.accessTokenTag
      })
      return NextResponse.json({ error: "Invalid token encryption data" }, { status: 500 })
    }

    let mlToken: string
    try {
      mlToken = decryptToken({
        encrypted: question.mlAccount.accessToken,
        iv: question.mlAccount.accessTokenIV,
        authTag: question.mlAccount.accessTokenTag
      })
    } catch (error) {
      logger.error("[Approve] Failed to decrypt token", { error })
      return NextResponse.json({ error: "Failed to decrypt ML token" }, { status: 500 })
    }
    
    // Determinar resposta final
    const finalResponse = userResponse || question.aiSuggestion // Usar aiSuggestion ao invés de aiResponse

    if (!finalResponse) {
      logger.error("[Approve] No response available", {
        questionId,
        hasUserResponse: !!userResponse,
        hasAiSuggestion: !!question.aiSuggestion,
        questionData: {
          id: question.id,
          mlQuestionId: question.mlQuestionId,
          status: question.status
        }
      })
      return NextResponse.json({ error: "No response available" }, { status: 400 })
    }

    logger.info("[Approve] Final response determined", {
      questionId,
      mlQuestionId: question.mlQuestionId,
      responseLength: finalResponse.length,
      responsePreview: finalResponse.substring(0, 100) + '...'
    })
    
    // Atualizar status da pergunta com campos corretos do schema
    await prisma.question.update({
      where: { id: questionId },
      data: {
        answer: finalResponse,
        answeredAt: new Date(),
        answeredBy: action === "approve" ? "AI_AUTO" : action === "manual" ? "MANUAL" : "AI_REVISED",
        approvalType: action === "approve" ? "AUTO" : action === "manual" ? "MANUAL" : "REVISED",
        approvedAt: new Date(),
        status: "APPROVED" // Status antes de enviar ao ML
      }
    })

    // Emitir evento WebSocket de aprovação
    try {
      const { emitQuestionApproved } = require('@/lib/websocket/emit-events.js')
      emitQuestionApproved(
        question.mlQuestionId,
        finalResponse,
        action === "approve" ? "AUTO" : action === "manual" ? "MANUAL" : "REVISED",
        question.mlAccount.organizationId
      )
    } catch (wsError) {
      logger.warn('[Approve] Failed to emit approval event', { error: wsError })
    }
    
    // Log for tracking
    logger.info(`[Approve] 📝 Processing approval request`, {
      questionId,
      mlQuestionId: question.mlQuestionId,
      action,
      account: question.mlAccount.nickname,
      hasAiSuggestion: !!question.aiSuggestion,
      hasUserResponse: !!userResponse,
      finalResponseLength: finalResponse.length,
      finalResponsePreview: finalResponse.substring(0, 50) + '...'
    })
    
    // Enviar resposta ao Mercado Livre com retry logic e rate limit protection
    logger.info(`[Approve] 🎯 Starting ML API call to post answer`, {
      mlQuestionId: question.mlQuestionId,
      accountId: question.mlAccount.id,
      seller: question.mlAccount.nickname,
      responseLength: finalResponse.length,
      tokenLength: mlToken.length,
      tokenPrefix: mlToken.substring(0, 15) + '...',
      timestamp: new Date().toISOString()
    })

    const mlResult = await postAnswerToML(question.mlQuestionId, finalResponse, mlToken, 3)

    logger.info(`[Approve] ML API call completed`, {
      success: mlResult.success,
      status: mlResult.status,
      error: mlResult.error,
      mlQuestionId: question.mlQuestionId
    })
    
    if (mlResult.success) {
      // Mark as SENT_TO_ML after successful ML response
      try {
        // Capturar answer_id do ML (pode vir como answer_id ou id na resposta)
        const mlAnswerId = mlResult.data?.answer_id || mlResult.data?.id || null

        await prisma.question.update({
          where: { id: questionId },
          data: {
            status: "RESPONDED", // Pergunta respondida com sucesso
            sentToMLAt: new Date(),
            mlResponseCode: mlResult.status || 200,
            mlResponseData: mlResult.data || {},
            retryCount: 0 // Reset retry count on success
          }
        })

        logger.info('[Approve] ✅ ML Answer posted successfully', {
          mlQuestionId: question.mlQuestionId,
          mlAnswerId: mlAnswerId,
          status: mlResult.status
        })

        // Emitir evento WebSocket de pergunta respondida com answer_id
        const { emitQuestionUpdated } = require('@/lib/websocket/emit-events.js')
        emitQuestionUpdated(
          question.mlQuestionId,
          'RESPONDED',
          {
            answeredAt: new Date(),
            mlResponseCode: mlResult.status || 200,
            mlAnswerId: mlAnswerId, // ID da resposta no ML
            sentToMLAt: new Date()
          },
          question.mlAccount.organizationId
        )
      } catch (prismaError) {
        logger.error("[Approve] Prisma update error after ML success", {
          questionId,
          error: prismaError
        })
        // Don't throw - the ML API call was successful
        // Return success but log the database error
      }
      
      logger.info(`[Approve] Successfully posted answer for question ${question.mlQuestionId}`, {
        mlQuestionId: question.mlQuestionId
      })
      
      // NOTIFICAÇÃO WhatsApp via Zapster - Confirmação de envio ao ML
      try {
        logger.info('[✅ Zapster] Iniciando envio de confirmação ao WhatsApp', {
          questionId: question.mlQuestionId,
          seller: question.mlAccount.nickname,
          action
        })

        // Gerar ID sequencial correto no formato XX/DDMM
        const now = new Date()
        const day = String(now.getDate()).padStart(2, '0')
        const month = String(now.getMonth() + 1).padStart(2, '0')

        // Buscar número sequencial da pergunta no dia
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

        const dailyCount = await prisma.question.count({
          where: {
            mlAccount: {
              organizationId: session.organizationId
            },
            receivedAt: {
              gte: startOfDay,
              lt: question.receivedAt || new Date()
            }
          }
        })

        const sequenceNumber = String(dailyCount + 1).padStart(2, '0')
        const sequentialId = `${sequenceNumber}/${day}${month}`

        const zapsterConfirmResult = await zapsterService.sendApprovalConfirmation({
          sequentialId: sequentialId,
          questionText: question.text,
          finalAnswer: finalResponse,
          productTitle: question.itemTitle || "Produto",
          sellerName: question.mlAccount.nickname,
          approved: action === "approve"
        })

        if (zapsterConfirmResult) {
          logger.info('[✅ Zapster] 📢 WhatsApp confirmation ENVIADA - ML confirmou recebimento!', {
            questionId: question.mlQuestionId,
            seller: question.mlAccount.nickname,
            sequentialId,
            success: true
          })

          // Não enviar segunda notificação duplicada
        } else {
          logger.error('[✅ Zapster] ❌ FALHA ao enviar confirmação WhatsApp', {
            questionId: question.mlQuestionId,
            seller: question.mlAccount.nickname
          })
        }
      } catch (whatsappError) {
        logger.error('[Zapster] ERRO ao enviar WhatsApp notification', {
          error: whatsappError,
          stack: whatsappError instanceof Error ? whatsappError.stack : undefined,
          questionId: question.mlQuestionId
        })
        // Não falhar por causa do WhatsApp
      }

      // NOTIFICAÇÃO 2: Browser - Confirmação para usuários logados
      try {
        const { emitToMLAccount } = require('@/lib/websocket/emit-events.js')

        const confirmationEvent = {
          title: `✅ Resposta Enviada - ${question.mlAccount.nickname}`,
          body: `Cliente recebeu resposta no ML!\n\n${finalResponse.substring(0, 100)}...`,
          icon: '/mlagent-logo-3d.png',
          badge: '/success-badge.png',
          tag: `confirmed-${question.mlQuestionId}`,
          requireInteraction: false,
          data: {
            questionId: question.id,
            mlQuestionId: question.mlQuestionId,
            productTitle: question.itemTitle || 'Produto',
            status: 'RESPONDED',
            approvalType: action
          }
        }

        await emitToMLAccount(
          question.mlAccount.id,
          'answer:confirmed',
          confirmationEvent
        )

        logger.info('[🔔 Browser] Confirmation notification sent via WebSocket', {
          questionId: question.mlQuestionId,
          organizationId: question.mlAccount.organizationId
        })
      } catch (browserError) {
        logger.warn('[Browser] Notification failed', { error: browserError })
      }
      
      return NextResponse.json({
        success: true,
        message: "Answer posted to Mercado Livre",
        mlResponse: mlResult.data,
        mlAnswerId: mlResult.data?.answer_id || mlResult.data?.id || null
      })
    } else {
      // 🎯 TRATAMENTO DE ERRO MELHORADO
      // Se é rate limit (429), manter como APPROVED para retry automático
      // Se é outro erro, marcar como FAILED para análise manual

      const newStatus = mlResult.isRateLimit ? 'APPROVED' : 'FAILED'
      const failedAt = mlResult.isRateLimit ? null : new Date()

      await prisma.question.update({
        where: { id: questionId },
        data: {
          status: newStatus,
          mlResponseCode: mlResult.status || 500,
          mlResponseData: { error: mlResult.error || "Unknown error" },
          retryCount: { increment: 1 },
          failedAt: failedAt,
          failureReason: mlResult.error || "Erro ao enviar para o Mercado Livre"
        }
      })

      logger.error('[Approve] Failed to send to ML', {
        questionId,
        mlQuestionId: question.mlQuestionId,
        error: mlResult.error,
        status: mlResult.status,
        isRateLimit: mlResult.isRateLimit,
        newStatus
      })

      // 🎯 Emitir evento WebSocket de erro em tempo real
      try {
        const { emitQuestionFailed } = require('@/lib/websocket/emit-events.js')

        emitQuestionFailed(
          question.mlQuestionId,
          mlResult.error || "Erro ao enviar resposta ao Mercado Livre",
          true, // retryable
          question.mlAccount.organizationId,
          {
            type: mlResult.isRateLimit ? 'RATE_LIMIT' : 'ML_API_ERROR',
            code: mlResult.status?.toString() || '500',
            hasResponse: true, // Tem resposta pronta, só falhou o envio
            isRateLimit: mlResult.isRateLimit,
            canRetryNow: !mlResult.isRateLimit, // Se não é rate limit, pode retry imediato
            retryDelay: mlResult.isRateLimit ? 60 : 0 // Segundos para aguardar
          }
        )

        logger.info('[Approve] ✅ Error event emitted via WebSocket', {
          questionId: question.mlQuestionId,
          errorType: mlResult.isRateLimit ? 'RATE_LIMIT' : 'ML_API_ERROR'
        })
      } catch (wsError) {
        logger.warn('[Approve] Failed to emit error event', { error: wsError })
      }

      return NextResponse.json({
        success: false,
        message: mlResult.isRateLimit
          ? "Rate limit do Mercado Livre. A pergunta será reenviada automaticamente."
          : "Falha ao enviar para o Mercado Livre após 3 tentativas",
        error: mlResult.error,
        status: mlResult.status || 500,
        canRetry: true,
        isRateLimit: mlResult.isRateLimit,
        retryDelay: mlResult.isRateLimit ? 60 : 0
      }, { status: mlResult.isRateLimit ? 429 : 500 })
    }
    
  } catch (error) {
    logger.error("[Approve] Unexpected error in approval endpoint", { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Try to provide more context in the error response
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}

// Quick approve endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get("id")
    
    if (!questionId) {
      return NextResponse.json({ error: "Missing question ID" }, { status: 400 })
    }
    
    // Auto-approve with AI response - call POST directly
    const postRequest = new NextRequest(new URL('/api/agent/approve-question', request.url), {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        questionId,
        action: "approve",
        response: null // Use AI response
      })
    })

    const response = await POST(postRequest)
    
    if (response.ok) {
      return new Response(`
        <html>
          <body style="font-family: sans-serif; padding: 20px; text-align: center;">
            <h1>✅ Resposta Aprovada!</h1>
            <p>A resposta foi enviada ao cliente no Mercado Livre.</p>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px;">Fechar</button>
          </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      })
    } else {
      return new Response(`
        <html>
          <body style="font-family: sans-serif; padding: 20px; text-align: center;">
            <h1>❌ Erro</h1>
            <p>Não foi possível aprovar a resposta.</p>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px;">Fechar</button>
          </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      })
    }
    
  } catch (error) {
    logger.error("Quick approve error", { error })
    return new Response("Error", { status: 500 })
  }
}