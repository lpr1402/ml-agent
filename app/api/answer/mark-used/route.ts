import { NextRequest, NextResponse } from 'next/server'
import { approvalTokenService } from '@/lib/services/approval-token-service'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const success = await approvalTokenService.markTokenAsUsed(token, 'completed')

    logger.info('[MarkUsed] Token marked as used', { token, success })

    return NextResponse.json({ success })

  } catch (error) {
    logger.error('[MarkUsed] Error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}