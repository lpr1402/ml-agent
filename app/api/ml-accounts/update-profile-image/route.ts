import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getCurrentSession } from '@/lib/auth/ml-auth'
import { MLAvatarService } from '@/lib/services/ml-avatar-service'

/**
 * GET /api/ml-accounts/update-profile-image
 * Busca e atualiza a imagem do perfil do ML para todas as contas
 */
export async function GET() {
  try {
    // Obter sessão
    const session = await getCurrentSession()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    logger.info('[UpdateProfileImage] Starting avatar update for organization', {
      organizationId: session.organizationId
    })

    // Atualizar avatares de toda a organização
    await MLAvatarService.updateOrganizationAvatars(session.organizationId)

    return NextResponse.json({
      success: true,
      message: 'Avatar update process completed'
    })

  } catch (error) {
    logger.error('[UpdateProfileImage] Error:', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}