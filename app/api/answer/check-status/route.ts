import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 400 }
      )
    }

    // Buscar o approval token
    const approvalToken = await prisma.approvalToken.findUnique({
      where: { token },
      include: {
        question: {
          select: {
            id: true,
            status: true
          }
        }
      }
    })

    if (!approvalToken) {
      return NextResponse.json(
        { error: 'Token inválido', expired: true },
        { status: 410 }
      )
    }

    // Verificar se o token expirou
    const now = new Date()
    if (approvalToken.expiresAt < now) {
      // Compute sequentialId from question ID
      const day = String(now.getDate()).padStart(2, '0')
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const year = String(now.getFullYear()).slice(-2)
      const sequentialId = approvalToken.question ?
        `${day}/${month}${year}-${approvalToken.question.id.slice(-3)}` :
        undefined

      return NextResponse.json(
        {
          error: 'Token expirado',
          expired: true,
          sequentialId
        },
        { status: 410 }
      )
    }

    // Verificar se já foi usado
    if (approvalToken.used) {
      // Compute sequentialId from question ID
      const day = String(now.getDate()).padStart(2, '0')
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const year = String(now.getFullYear()).slice(-2)
      const sequentialId = approvalToken.question ?
        `${day}/${month}${year}-${approvalToken.question.id.slice(-3)}` :
        undefined

      return NextResponse.json(
        {
          error: 'Token já utilizado',
          expired: true,
          used: true,
          sequentialId
        },
        { status: 410 }
      )
    }

    // Verificar se a pergunta já foi respondida
    if (approvalToken.question?.status === 'RESPONDED' ||
        approvalToken.question?.status === 'SENT_TO_ML' ||
        approvalToken.question?.status === 'COMPLETED') {
      // Compute sequentialId from question ID
      const day = String(now.getDate()).padStart(2, '0')
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const year = String(now.getFullYear()).slice(-2)
      const sequentialId = `${day}/${month}${year}-${approvalToken.question.id.slice(-3)}`

      return NextResponse.json(
        {
          error: 'Pergunta já respondida',
          expired: true,
          used: true,
          sequentialId
        },
        { status: 410 }
      )
    }

    // Token válido e não usado
    return NextResponse.json({
      valid: true,
      expired: false,
      used: false
    })

  } catch (error) {
    logger.error('[CheckTokenStatus] Error checking token status:', { error })
    return NextResponse.json(
      { error: 'Erro ao verificar status do token' },
      { status: 500 }
    )
  }
}