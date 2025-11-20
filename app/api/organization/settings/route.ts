import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('ml-agent-session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar sessão
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        organization: {
          include: {
            mlAccounts: {
              where: { isActive: true }
            }
          }
        }
      }
    })

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    // Retornar dados da organização
    return NextResponse.json({
      id: session.organization.id,
      name: session.organization.organizationName || session.organization.primaryNickname,
      email: session.organization.primaryEmail,
      whatsappNumber: session.organization.whatsappNumber || '',
      plan: session.organization.plan,
      accountsCount: session.organization.mlAccounts.length,
      createdAt: session.organization.createdAt,
      emailNotifications: session.organization.emailNotifications ?? true,
      whatsappNotifications: session.organization.whatsappNotifications ?? true
    })
  } catch (error) {
    logger.error('[Organization Settings] Error:', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
