import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, pin } = body

    if (!username || !pin) {
      return NextResponse.json(
        { error: 'Username e PIN são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se organização já existe
    let organization = await prisma.organization.findUnique({
      where: { username: username.toLowerCase() }
    })

    if (organization) {
      // Se já existe, verificar o PIN
      const isPinValid = await bcrypt.compare(pin, organization.pinHash || '')
      if (!isPinValid) {
        return NextResponse.json(
          { error: 'PIN incorreto' },
          { status: 401 }
        )
      }

      // Atualizar para plano PRO
      organization = await prisma.organization.update({
        where: { id: organization.id },
        data: {
          plan: 'PRO',
          subscriptionStatus: 'ACTIVE',
          subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano grátis
        }
      })
    } else {
      // Criar nova organização com plano PRO
      const pinHash = await bcrypt.hash(pin, 10)

      organization = await prisma.organization.create({
        data: {
          username: username.toLowerCase(),
          pinHash,
          organizationName: username,
          plan: 'PRO',
          subscriptionStatus: 'ACTIVE',
          subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 ano grátis
        }
      })
    }

    // Criar sessão
    const sessionToken = uuidv4()
    const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias

    await prisma.session.create({
      data: {
        sessionToken,
        organizationId: organization.id,
        expiresAt: sessionExpiry
      }
    })

    // Configurar cookie da sessão padronizado
    const cookieStore = await cookies()
    cookieStore.set('ml-agent-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: sessionExpiry
    })

    // Armazenar organizationId para conectar conta ML
    cookieStore.set('pending-ml-connection', organization.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15 // 15 minutos
    })

    logger.info('[Activate PRO] PRO plan activated', {
      organizationId: organization.id,
      username: organization.username,
      plan: 'PRO'
    })

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        username: organization.username,
        plan: 'PRO'
      },
      message: 'Plano PRO ativado com sucesso! Agora conecte sua conta do Mercado Livre.',
      nextStep: 'connect_ml_account'
    })
  } catch (error) {
    logger.error('[Activate PRO] Error', { error })
    return NextResponse.json(
      { error: 'Erro ao ativar plano PRO' },
      { status: 500 }
    )
  }
}