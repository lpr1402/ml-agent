import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Endpoint de recuperação de perguntas
 * Busca webhooks de perguntas que não foram processados
 * e tenta processar novamente
 */
export async function GET(_request: NextRequest) {
  try {
    // Verificar sessão
    const { getCurrentSession } = await import('@/lib/auth/ml-auth')
    const session = await getCurrentSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Buscar webhooks de perguntas não processados nas últimas 24 horas
    const unprocessedWebhooks = await prisma.webhookEvent.findMany({
      where: {
        eventType: 'questions',
        processed: false,
        organizationId: session.organizationId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
        }
      },
      include: {
        mlAccount: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    logger.info('[Recover] Found unprocessed question webhooks:', { count: unprocessedWebhooks.length })

    // Buscar perguntas com status FAILED ou RECEIVED
    const failedQuestions = await prisma.question.findMany({
      where: {
        OR: [
          { status: 'FAILED' },
          { status: 'RECEIVED' },
          { status: 'ERROR' },
          { status: 'TOKEN_ERROR' }
        ],
        mlAccount: {
          organizationId: session.organizationId
        }
      },
      include: {
        mlAccount: true
      },
      orderBy: {
        receivedAt: 'desc'
      },
      take: 50 // Limitar para não sobrecarregar
    })

    logger.info('[Recover] Found failed questions:', { count: failedQuestions.length })

    const results = {
      unprocessedWebhooks: unprocessedWebhooks.length,
      failedQuestions: failedQuestions.length,
      webhooks: unprocessedWebhooks.map(w => ({
        id: w.id,
        questionId: w.eventId,
        resource: w.resourceUrl,
        receivedAt: w.receivedAt,
        error: w.processingError
      })),
      questions: failedQuestions.map(q => ({
        id: q.id,
        mlQuestionId: q.mlQuestionId,
        text: q.text,
        status: q.status,
        failureReason: q.failureReason,
        receivedAt: q.receivedAt,
        accountNickname: q.mlAccount?.nickname
      }))
    }

    return NextResponse.json(results)

  } catch (error) {
    logger.error("[Recover] Error:", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST - Reprocessar perguntas não processadas
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar sessão
    const { getCurrentSession } = await import('@/lib/auth/ml-auth')
    const session = await getCurrentSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { questionIds } = await request.json()

    if (!questionIds || !Array.isArray(questionIds)) {
      return NextResponse.json({ error: "Invalid request - questionIds must be an array" }, { status: 400 })
    }

    logger.info('[Recover] Reprocessing questions:', { count: questionIds.length })

    const results = []

    for (const questionId of questionIds) {
      try {
        // Buscar pergunta
        const question = await prisma.question.findUnique({
          where: { id: questionId },
          include: { mlAccount: true }
        })

        if (!question) {
          results.push({ questionId, success: false, error: 'Question not found' })
          continue
        }

        // Tentar reprocessar via endpoint de reprocessamento
        const appUrl = process.env['NODE_ENV'] === 'production'
          ? 'https://gugaleo.axnexlabs.com.br'
          : (process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3007')

        const response = await fetch(`${appUrl}/api/agent/reprocess-question`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || ''
          },
          body: JSON.stringify({ questionId })
        })

        if (response.ok) {
          results.push({ questionId, success: true })
        } else {
          const error = await response.text()
          results.push({ questionId, success: false, error })
        }

      } catch (error) {
        logger.error('[Recover] Error reprocessing question:', { questionId, error })
        results.push({ questionId, success: false, error: 'Internal error' })
      }
    }

    return NextResponse.json({
      message: 'Recovery process completed',
      total: questionIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    })

  } catch (error) {
    logger.error("[Recover] Error:", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}