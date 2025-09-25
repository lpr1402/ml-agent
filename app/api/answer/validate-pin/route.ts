import { NextRequest, NextResponse } from 'next/server'
import { approvalTokenService } from '@/lib/services/approval-token-service'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { token, pin } = await request.json()

    if (!token || !pin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validar PIN (sempre 911)
    if (!approvalTokenService.validatePin(pin)) {
      logger.warn('[ValidatePin] Invalid PIN attempt', { token })
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    // Validar token
    const validation = await approvalTokenService.validateToken(token)

    if (!validation.valid) {
      if (validation.error === 'Token expirado') {
        return NextResponse.json({ expired: true }, { status: 410 })
      }
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Verificar se a pergunta já foi respondida
    if (validation.question.status === 'COMPLETED' || validation.question.answeredAt) {
      return NextResponse.json({
        error: 'Esta pergunta já foi respondida pela plataforma',
        alreadyAnswered: true,
        sequentialId: validation.question.sequentialId
      }, { status: 410 })
    }

    // Usar o ID sequencial SALVO no banco (não gerar novo)
    const sequentialId = validation.question.sequentialId || 'N/A'

    logger.info('[ValidatePin] PIN validated successfully', {
      token,
      questionId: validation.question.id
    })

    return NextResponse.json({
      success: true,
      question: validation.question,
      sequentialId: sequentialId // Usar o ID salvo
    })

  } catch (error) {
    logger.error('[ValidatePin] Error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}