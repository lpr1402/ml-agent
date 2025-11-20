import { NextRequest, NextResponse } from 'next/server'
import { approvalTokenService } from '@/lib/services/approval-token-service'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { token, questionId, response, action } = await request.json()

    if (!token || !questionId || !response) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validar token novamente
    const validation = await approvalTokenService.validateToken(token)

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Verificar se a pergunta corresponde ao token
    if (validation.question.id !== questionId) {
      return NextResponse.json({ error: 'Invalid question ID' }, { status: 400 })
    }

    // Buscar token completo
    const approvalToken = await prisma.approvalToken.findUnique({
      where: { token },
      include: {
        mlAccount: true,
        organization: true
      }
    })

    if (!approvalToken) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 })
    }

    // Descriptografar token ML
    const { decryptToken } = await import('@/lib/security/encryption')

    // Verificar dados de criptografia
    if (!approvalToken.mlAccount.accessTokenIV || !approvalToken.mlAccount.accessTokenTag) {
      return NextResponse.json({ error: 'Invalid token data' }, { status: 500 })
    }

    let mlToken: string
    try {
      mlToken = decryptToken({
        encrypted: approvalToken.mlAccount.accessToken!,
        iv: approvalToken.mlAccount.accessTokenIV,
        authTag: approvalToken.mlAccount.accessTokenTag
      })
    } catch (error) {
      logger.error('[ApproveAnswer] Failed to decrypt token', { error })
      return NextResponse.json({ error: 'Failed to decrypt ML token' }, { status: 500 })
    }

    // Enviar resposta ao ML
    const mlResponse = await fetch(
      'https://api.mercadolibre.com/answers',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mlToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question_id: parseInt(validation.question.mlQuestionId, 10),
          text: response.trim()
        })
      }
    )

    const mlData = await mlResponse.json()

    if (!mlResponse.ok) {
      // Verificar se já foi respondida
      if (mlData.message?.includes('already answered')) {
        // Marcar como sucesso mesmo se já respondida
      } else {
        logger.error('[ApproveAnswer] ML API error', { mlData })
        return NextResponse.json({ error: 'Failed to send to ML' }, { status: 500 })
      }
    }

    // Atualizar pergunta no banco
    await prisma.question.update({
      where: { id: questionId },
      data: {
        answer: response,
        answeredAt: new Date(),
        answeredBy: action === 'manual' ? 'MANUAL' : 'AI_AUTO',
        approvalType: action === 'manual' ? 'MANUAL' : 'AUTO',
        approvedAt: new Date(),
        status: 'COMPLETED',
        sentToMLAt: new Date(),
        mlResponseCode: mlResponse.status,
        mlResponseData: mlData
      }
    })

    // Marcar token como usado
    await approvalTokenService.markTokenAsUsed(token, action || 'approve')

    // Emitir evento WebSocket
    try {
      const { emitQuestionCompleted } = require('@/lib/websocket/emit-events.js')
      emitQuestionCompleted(
        validation.question.mlQuestionId,
        mlResponse.status,
        mlData,
        approvalToken.organizationId
      )
    } catch (wsError) {
      logger.warn('[ApproveAnswer] Failed to emit WebSocket event', { wsError })
    }

    // NOTIFICAÇÃO WhatsApp - Confirmação de envio ao ML
    try {
      const { evolutionWhatsAppService } = await import('@/lib/services/evolution-whatsapp')

      const confirmationResult = await evolutionWhatsAppService.sendApprovalConfirmation({
        sequentialId: validation.question.sequentialId || '00/0000', // Usar ID salvo no banco
        questionText: validation.question.text,
        finalAnswer: response,
        productTitle: validation.question.itemTitle || 'Produto',
        sellerName: approvalToken.mlAccount.nickname,
        approved: action !== 'manual'
      })

      if (confirmationResult) {
        logger.info('[✅ Evolution] WhatsApp confirmation sent - Answer delivered to ML', {
          questionId: validation.question.mlQuestionId,
          seller: approvalToken.mlAccount.nickname
        })
      }
    } catch (whatsappError) {
      logger.error('[Zapster] Error sending WhatsApp confirmation', { error: whatsappError })
      // Não falhar por causa do WhatsApp
    }

    logger.info('[ApproveAnswer] Question approved via unique link', {
      questionId,
      token,
      action
    })

    return NextResponse.json({
      success: true,
      message: 'Answer sent to Mercado Livre'
    })

  } catch (error) {
    logger.error('[ApproveAnswer] Error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}