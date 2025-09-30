/**
 * API de inscrição para Push Notifications
 * Registra dispositivos para receber notificações 24/7
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getCurrentSession } from '@/lib/auth/ml-auth'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const session = await getCurrentSession()
    if (!session?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subscription, deviceInfo, preferences } = body

    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      )
    }

    // Extrair informações do user agent
    const userAgent = request.headers.get('user-agent') || ''
    const deviceType = getDeviceType(userAgent)
    const browserInfo = getBrowserInfo(userAgent)

    // Verificar se já existe uma subscription para este endpoint
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint }
    })

    if (existingSubscription) {
      // Atualizar subscription existente
      const updated = await prisma.pushSubscription.update({
        where: { endpoint: subscription.endpoint },
        data: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          isActive: true,
          failureCount: 0,
          deviceName: deviceInfo?.name || existingSubscription.deviceName,
          enableQuestions: preferences?.enableQuestions ?? true,
          enableUrgent: preferences?.enableUrgent ?? true,
          enableBatch: preferences?.enableBatch ?? true,
          quietHoursStart: preferences?.quietHoursStart,
          quietHoursEnd: preferences?.quietHoursEnd,
          timezone: preferences?.timezone || 'America/Sao_Paulo',
          updatedAt: new Date()
        }
      })

      logger.info('[Push Subscribe] Subscription updated', {
        organizationId: session.organizationId,
        endpoint: subscription.endpoint.substring(0, 50) + '...'
      })

      return NextResponse.json({
        success: true,
        message: 'Subscription updated',
        subscriptionId: updated.id
      })
    }

    // Criar nova subscription
    const newSubscription = await prisma.pushSubscription.create({
      data: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        organizationId: session.organizationId,
        deviceName: deviceInfo?.name || `${browserInfo.browser} on ${deviceType}`,
        deviceType,
        browser: browserInfo.browser,
        browserVersion: browserInfo.version || null,
        os: getOS(userAgent),
        enableQuestions: preferences?.enableQuestions ?? true,
        enableUrgent: preferences?.enableUrgent ?? true,
        enableBatch: preferences?.enableBatch ?? true,
        quietHoursStart: preferences?.quietHoursStart,
        quietHoursEnd: preferences?.quietHoursEnd,
        timezone: preferences?.timezone || 'America/Sao_Paulo'
      }
    })

    logger.info('[Push Subscribe] New subscription created', {
      organizationId: session.organizationId,
      deviceType,
      browser: browserInfo.browser
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'push.subscribe',
        entityType: 'push_subscription',
        entityId: newSubscription.id,
        organizationId: session.organizationId,
        metadata: {
          deviceType,
          browser: browserInfo.browser,
          os: getOS(userAgent)
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to push notifications',
      subscriptionId: newSubscription.id,
      deviceInfo: {
        type: deviceType,
        browser: browserInfo.browser,
        os: getOS(userAgent)
      }
    })

  } catch (error) {
    logger.error('[Push Subscribe] Error:', { error })
    return NextResponse.json(
      { error: 'Failed to subscribe to push notifications' },
      { status: 500 }
    )
  }
}

// DELETE - Remover inscrição
export async function DELETE(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { endpoint } = await request.json()

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint required' },
        { status: 400 }
      )
    }

    // Desativar subscription
    await prisma.pushSubscription.update({
      where: { endpoint },
      data: { isActive: false }
    })

    logger.info('[Push Unsubscribe] Subscription deactivated', {
      organizationId: session.organizationId
    })

    return NextResponse.json({
      success: true,
      message: 'Unsubscribed from push notifications'
    })

  } catch (error) {
    logger.error('[Push Unsubscribe] Error:', { error })
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    )
  }
}

// Helpers
function getDeviceType(userAgent: string): string {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  if (/Mobile/i.test(userAgent)) return 'mobile'
  return 'desktop'
}

function getBrowserInfo(userAgent: string): { browser: string, version?: string | undefined } {
  if (/CriOS/i.test(userAgent)) return { browser: 'chrome-ios' }
  if (/FxiOS/i.test(userAgent)) return { browser: 'firefox-ios' }
  if (/Safari/i.test(userAgent) && /Version/i.test(userAgent)) {
    const match = userAgent.match(/Version\/([\d.]+)/i)
    return { browser: 'safari', version: match?.[1] || undefined }
  }
  if (/Chrome/i.test(userAgent)) {
    const match = userAgent.match(/Chrome\/([\d.]+)/i)
    return { browser: 'chrome', version: match?.[1] || undefined }
  }
  if (/Firefox/i.test(userAgent)) {
    const match = userAgent.match(/Firefox\/([\d.]+)/i)
    return { browser: 'firefox', version: match?.[1] || undefined }
  }
  if (/Edge/i.test(userAgent)) {
    const match = userAgent.match(/Edge\/([\d.]+)/i)
    return { browser: 'edge', version: match?.[1] || undefined }
  }
  return { browser: 'unknown' }
}

function getOS(userAgent: string): string {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    const match = userAgent.match(/OS ([\d_]+)/i)
    if (match && match[1]) return `iOS ${match[1].replace(/_/g, '.')}`
    return 'iOS'
  }
  if (/Android/i.test(userAgent)) {
    const match = userAgent.match(/Android ([\d.]+)/i)
    if (match && match[1]) return `Android ${match[1]}`
    return 'Android'
  }
  if (/Windows NT/i.test(userAgent)) {
    const match = userAgent.match(/Windows NT ([\d.]+)/i)
    if (match && match[1]) {
      const version = match[1]
      if (version === '10.0') return 'Windows 10'
      if (version === '11.0') return 'Windows 11'
    }
    return 'Windows'
  }
  if (/Mac OS X/i.test(userAgent)) {
    const match = userAgent.match(/Mac OS X ([\d_]+)/i)
    if (match && match[1]) return `macOS ${match[1].replace(/_/g, '.')}`
    return 'macOS'
  }
  if (/Linux/i.test(userAgent)) return 'Linux'
  return 'Unknown'
}