/**
 * GET SERVER SESSION
 * Utilitário para obter sessão do servidor em API routes
 */

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function getServerSession() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('ml-agent-session')?.value // FIX: Nome correto do cookie

    if (!sessionToken) {
      return null
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

    if (!session) {
      return null
    }

    // Verificar se expirou
    if (session.expiresAt < new Date()) {
      return null
    }

    return {
      organizationId: session.organizationId,
      organization: session.organization,
      accounts: session.organization.mlAccounts
    }

  } catch (error) {
    logger.error('[Auth] Error getting server session', { error })
    return null
  }
}
