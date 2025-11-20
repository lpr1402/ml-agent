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
    const { name, email, whatsappNumber } = body

    // Validações
    if (name && name.trim().length < 3) {
      return NextResponse.json(
        { error: 'Nome deve ter pelo menos 3 caracteres' },
        { status: 400 }
      )
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'E-mail inválido' },
        { status: 400 }
      )
    }

    if (whatsappNumber && whatsappNumber.trim() && !/^\+?[\d\s()-]+$/.test(whatsappNumber)) {
      return NextResponse.json(
        { error: 'Número de WhatsApp inválido' },
        { status: 400 }
      )
    }

    // Atualizar organização
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        ...(name && { organizationName: name.trim() }),
        ...(email && { primaryEmail: email.trim() }),
        ...(whatsappNumber !== undefined && { whatsappNumber: whatsappNumber.trim() || null })
      }
    })

    logger.info('[Organization] Data updated', {
      organizationId: session.organizationId,
      fields: { name: !!name, email: !!email, whatsappNumber: !!whatsappNumber }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[Organization Update] Error:', { error })
    return NextResponse.json(
      { error: 'Erro ao atualizar dados' },
      { status: 500 }
    )
  }
}
