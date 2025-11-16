/**
 * TOKEN MAINTENANCE WORKER - Enterprise Grade
 * Mantém todos os tokens ativos 24/7
 * Auto-refresh ANTES de expirar (proativo)
 * Outubro 2025 - Production Ready
 */

import { logger } from '../lib/logger'
import { prisma } from '../lib/prisma'
import { getValidMLToken } from '../lib/ml-api/token-manager'

// Configurações
const CHECK_INTERVAL = 10 * 60 * 1000 // 10 minutos
const REFRESH_THRESHOLD = 60 * 60 * 1000 // Refresh se faltar < 1 hora

/**
 * Verificar e renovar tokens de todas as contas
 */
async function checkAndRefreshTokens() {
  try {
    logger.info('[TokenMaintenance] Starting token check cycle')

    // Buscar todas as contas ativas
    const accounts = await prisma.mLAccount.findMany({
      select: {
        id: true,
        nickname: true,
        tokenExpiresAt: true,
        isActive: true,
        organizationId: true,
        organization: {
          select: {
            organizationName: true
          }
        }
      },
      orderBy: {
        tokenExpiresAt: 'asc' // Mais urgentes primeiro
      }
    })

    if (accounts.length === 0) {
      logger.info('[TokenMaintenance] No accounts found')
      return
    }

    const now = Date.now()
    const refreshThreshold = new Date(now + REFRESH_THRESHOLD)

    logger.info('[TokenMaintenance] Checking accounts', {
      total: accounts.length,
      threshold: refreshThreshold
    })

    const results = {
      total: accounts.length,
      needRefresh: 0,
      refreshed: 0,
      failed: 0,
      healthy: 0
    }

    // Processar cada conta
    for (const account of accounts) {
      const timeUntilExpiry = account.tokenExpiresAt.getTime() - now
      const minutesRemaining = Math.floor(timeUntilExpiry / 1000 / 60)

      // Se token expira em < 1 hora OU conta está inativa
      if (account.tokenExpiresAt < refreshThreshold || !account.isActive) {
        results.needRefresh++

        logger.info('[TokenMaintenance] Refreshing token', {
          account: account.nickname,
          org: account.organization.organizationName,
          minutesRemaining,
          isActive: account.isActive
        })

        // Forçar refresh via getValidMLToken
        const token = await getValidMLToken(account.id)

        if (token) {
          results.refreshed++
          logger.info('[TokenMaintenance] ✅ Token refreshed successfully', {
            account: account.nickname
          })
        } else {
          results.failed++
          logger.error('[TokenMaintenance] ❌ Failed to refresh token', {
            account: account.nickname
          })
        }

        // Rate limiting entre refreshes
        await new Promise(resolve => setTimeout(resolve, 2000))
      } else {
        results.healthy++
        logger.debug('[TokenMaintenance] Token healthy', {
          account: account.nickname,
          minutesRemaining
        })
      }
    }

    logger.info('[TokenMaintenance] Token check cycle completed', results)
  } catch (error: any) {
    logger.error('[TokenMaintenance] Token check cycle failed', {
      error: error.message
    })
  }
}

/**
 * Reativar contas que falharam temporariamente
 */
async function reactivateFailedAccounts() {
  try {
    logger.info('[TokenMaintenance] Checking for failed accounts to reactivate')

    // Buscar contas inativas com tokens que ainda não expiraram
    const failedAccounts = await prisma.mLAccount.findMany({
      where: {
        isActive: false,
        tokenExpiresAt: {
          gt: new Date() // Token ainda válido
        }
      },
      select: {
        id: true,
        nickname: true,
        connectionError: true
      }
    })

    if (failedAccounts.length === 0) {
      return
    }

    logger.info('[TokenMaintenance] Found failed accounts to reactivate', {
      count: failedAccounts.length
    })

    for (const account of failedAccounts) {
      // Reativar conta
      await prisma.mLAccount.update({
        where: { id: account.id },
        data: {
          isActive: true,
          connectionError: null
        }
      })

      logger.info('[TokenMaintenance] Account reactivated', {
        account: account.nickname
      })
    }
  } catch (error: any) {
    logger.error('[TokenMaintenance] Reactivation failed', {
      error: error.message
    })
  }
}

/**
 * Main worker loop
 */
async function runMaintenanceCycle() {
  logger.info('[TokenMaintenance] Running maintenance cycle')

  try {
    // 1. Reativar contas que falharam temporariamente
    await reactivateFailedAccounts()

    // 2. Verificar e renovar tokens
    await checkAndRefreshTokens()

    logger.info('[TokenMaintenance] Maintenance cycle completed')
  } catch (error: any) {
    logger.error('[TokenMaintenance] Maintenance cycle failed', {
      error: error.message
    })
  }
}

/**
 * Start worker
 */
async function main() {
  logger.info('[TokenMaintenance] Token Maintenance Worker started', {
    checkInterval: `${CHECK_INTERVAL / 1000 / 60} minutes`,
    refreshThreshold: `${REFRESH_THRESHOLD / 1000 / 60} minutes`
  })

  // Executar imediatamente
  await runMaintenanceCycle()

  // Depois executar periodicamente
  setInterval(runMaintenanceCycle, CHECK_INTERVAL)

  logger.info('[TokenMaintenance] Worker scheduled')
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[TokenMaintenance] Shutting down gracefully')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('[TokenMaintenance] Shutting down gracefully')
  await prisma.$disconnect()
  process.exit(0)
})

// Start worker
if (require.main === module) {
  main().catch((error) => {
    logger.error('[TokenMaintenance] Worker failed to start', { error })
    process.exit(1)
  })
}

export { runMaintenanceCycle, checkAndRefreshTokens }
