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

    // Buscar organização pelo username
    const organization = await prisma.organization.findUnique({
      where: { username: username.toLowerCase() },
      include: { mlAccounts: true }
    })

    if (!organization) {
      logger.warn('[Login PIN] Organization not found', { username })
      return NextResponse.json(
        { error: 'Usuário ou PIN incorretos' },
        { status: 401 }
      )
    }

    // Verificar PIN
    if (!organization.pinHash) {
      logger.error('[Login PIN] Organization has no PIN', { organizationId: organization.id })
      return NextResponse.json(
        { error: 'Configuração de PIN não encontrada' },
        { status: 500 }
      )
    }

    const isPinValid = await bcrypt.compare(pin, organization.pinHash)
    if (!isPinValid) {
      logger.warn('[Login PIN] Invalid PIN', { username })
      return NextResponse.json(
        { error: 'Usuário ou PIN incorretos' },
        { status: 401 }
      )
    }

    // Criar sessão
    const sessionToken = uuidv4()
    const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias

    // Pegar primeira conta ML ativa, se existir
    const primaryAccount = organization.mlAccounts.find(acc => acc.isPrimary) || organization.mlAccounts[0]

    await prisma.session.create({
      data: {
        sessionToken,
        organizationId: organization.id,
        activeMLAccountId: primaryAccount?.id || null,
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

    logger.info('[Login PIN] Successful login', {
      username,
      organizationId: organization.id,
      mlAccountsCount: organization.mlAccounts.length
    })

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        username: organization.username,
        organizationName: organization.organizationName,
        plan: organization.plan,
        mlAccountsCount: organization.mlAccounts.length
      }
    })
  } catch (error) {
    logger.error('[Login PIN] Error', { error })
    return NextResponse.json(
      { error: 'Erro interno ao fazer login' },
      { status: 500 }
    )
  }
}