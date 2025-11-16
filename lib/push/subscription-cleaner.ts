/**
 * Push Subscription Cleaner
 * Limpa subscriptions inválidas ou expiradas
 * Executado diariamente via cron
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

/**
 * Cleanup push subscriptions inválidas
 * - Desativa subscriptions com 3+ falhas
 * - Deleta subscriptions inativas há mais de 30 dias
 */
export async function cleanupInvalidSubscriptions(): Promise<{
  deactivated: number
  deleted: number
}> {
  const startTime = Date.now()

  logger.info('[PushCleanup] 🧹 Starting push subscription cleanup')

  try {
    // 1. Desativar subscriptions com 3+ falhas consecutivas
    const deactivatedResult = await prisma.pushSubscription.updateMany({
      where: {
        failureCount: { gte: 3 },
        isActive: true
      },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })

    logger.info('[PushCleanup] Deactivated failed subscriptions', {
      count: deactivatedResult.count
    })

    // 2. Deletar subscriptions inativas há mais de 30 dias
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const deletedResult = await prisma.pushSubscription.deleteMany({
      where: {
        isActive: false,
        updatedAt: { lt: thirtyDaysAgo }
      }
    })

    logger.info('[PushCleanup] Deleted old subscriptions', {
      count: deletedResult.count,
      olderThan: '30 days'
    })

    // 3. Estatísticas finais
    const totalActive = await prisma.pushSubscription.count({
      where: { isActive: true }
    })

    const totalInactive = await prisma.pushSubscription.count({
      where: { isActive: false }
    })

    const duration = Date.now() - startTime

    logger.info('[PushCleanup] ✅ Cleanup completed', {
      deactivated: deactivatedResult.count,
      deleted: deletedResult.count,
      totalActive,
      totalInactive,
      durationMs: duration
    })

    return {
      deactivated: deactivatedResult.count,
      deleted: deletedResult.count
    }

  } catch (error: any) {
    logger.error('[PushCleanup] Cleanup failed', {
      error: error.message
    })
    throw error
  }
}

/**
 * Reset failure count para uma subscription específica
 * Útil quando usuário re-ativa notificações
 */
export async function resetSubscriptionFailureCount(
  subscriptionId: string
): Promise<void> {
  await prisma.pushSubscription.update({
    where: { id: subscriptionId },
    data: {
      failureCount: 0,
      isActive: true,
      updatedAt: new Date()
    }
  })

  logger.info('[PushCleanup] Reset failure count', { subscriptionId })
}

/**
 * Incrementar failure count após envio falhar
 * Desativa automaticamente após 3 falhas
 */
export async function incrementSubscriptionFailure(
  subscriptionId: string
): Promise<void> {
  const subscription = await prisma.pushSubscription.findUnique({
    where: { id: subscriptionId },
    select: { failureCount: true }
  })

  if (!subscription) {
    return
  }

  const newFailureCount = subscription.failureCount + 1
  const shouldDeactivate = newFailureCount >= 3

  await prisma.pushSubscription.update({
    where: { id: subscriptionId },
    data: shouldDeactivate
      ? { failureCount: newFailureCount, isActive: false, updatedAt: new Date() }
      : { failureCount: newFailureCount, updatedAt: new Date() }
  })

  if (shouldDeactivate) {
    logger.warn('[PushCleanup] Subscription deactivated after 3 failures', {
      subscriptionId,
      failureCount: newFailureCount
    })
  }
}

// Se executado diretamente (cron job)
if (require.main === module) {
  cleanupInvalidSubscriptions()
    .then(result => {
      logger.info('[PushCleanup] Standalone execution completed', result)
      process.exit(0)
    })
    .catch(error => {
      logger.error('[PushCleanup] Standalone execution failed', { error })
      process.exit(1)
    })
}
