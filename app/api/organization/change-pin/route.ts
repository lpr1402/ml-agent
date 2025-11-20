import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('ml-agent-session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar sessão
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { organization: true }
    })

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPin, newPin } = body

    // Validações
    if (!currentPin || !newPin) {
      return NextResponse.json(
        { error: 'PIN atual e novo PIN são obrigatórios' },
        { status: 400 }
      )
    }

    if (!/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        { error: 'O novo PIN deve conter exatamente 4 dígitos' },
        { status: 400 }
      )
    }

    // Verificar PIN atual
    const organization = session.organization
    if (!organization.pinHash) {
      return NextResponse.json(
        { error: 'PIN não configurado para esta organização' },
        { status: 400 }
      )
    }

    const isValidPin = await bcrypt.compare(currentPin, organization.pinHash)
    if (!isValidPin) {
      logger.warn('[Organization] Invalid current PIN attempt', {
        organizationId: session.organizationId
      })
      return NextResponse.json(
        { error: 'PIN atual incorreto' },
        { status: 401 }
      )
    }

    // Hash do novo PIN
    const newPinHash = await bcrypt.hash(newPin, 12)

    // Atualizar PIN
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: { pinHash: newPinHash }
    })

    logger.info('[Organization] PIN changed successfully', {
      organizationId: session.organizationId
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[Organization Change PIN] Error:', { error })
    return NextResponse.json(
      { error: 'Erro ao alterar PIN' },
      { status: 500 }
    )
  }
}
