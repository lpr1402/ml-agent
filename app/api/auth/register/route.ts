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

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Username deve ter pelo menos 3 caracteres' },
        { status: 400 }
      )
    }

    if (pin.length !== 3 || !/^\d{3}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN deve ter exatamente 3 dígitos' },
        { status: 400 }
      )
    }

    // Verificar se username já existe (sempre em UPPERCASE)
    const existingOrg = await prisma.organization.findUnique({
      where: { username: username.toUpperCase() }
    })

    if (existingOrg) {
      return NextResponse.json(
        { error: 'Nome de usuário já existe' },
        { status: 409 }
      )
    }

    // Hash do PIN
    const pinHash = await bcrypt.hash(pin, 10)

    // Criar nova organização com plano PRO grátis
    const organization = await prisma.organization.create({
      data: {
        username: username.toUpperCase(),
        pinHash,
        organizationName: username,
        plan: 'PRO',
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 ano grátis
      }
    })

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

    // Configurar cookie da sessão com nome padronizado para produção
    const cookieStore = await cookies()
    cookieStore.set('ml-agent-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: sessionExpiry
    })

    // Armazenar organizationId temporariamente para conectar conta ML
    cookieStore.set('pending-ml-connection', organization.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15 // 15 minutos
    })

    logger.info('[Register] Organization created successfully', {
      organizationId: organization.id,
      username: organization.username
    })

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        username: organization.username,
        plan: organization.plan
      },
      nextStep: 'connect_ml_account'
    })
  } catch (error) {
    logger.error('[Register] Error creating organization', { error })
    return NextResponse.json(
      { error: 'Erro ao criar conta' },
      { status: 500 }
    )
  }
}