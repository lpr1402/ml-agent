import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

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
    const { emailNotifications, whatsappNotifications } = body

    // Atualizar preferências de notificação
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        emailNotifications: emailNotifications ?? undefined,
        whatsappNotifications: whatsappNotifications ?? undefined
      }
    })

    logger.info('[Organization] Notification preferences updated', {
      organizationId: session.organizationId,
      emailNotifications,
      whatsappNotifications
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[Organization Notifications] Error:', { error })
    return NextResponse.json(
      { error: 'Erro ao atualizar preferências de notificação' },
      { status: 500 }
    )
  }
}
