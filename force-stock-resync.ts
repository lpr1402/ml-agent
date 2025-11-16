/**
 * FORCE STOCK RESYNC - Força resincronização completa
 * Limpa snapshots antigos e resincroniza com código novo
 */

import { prisma } from './lib/prisma'
import { syncOrganizationStock } from './lib/stock/stock-sync-manager'
import { logger } from './lib/logger'

async function main() {
  try {
    logger.info('🔄 FORCE RESYNC - Iniciando...')

    // 1. Buscar organizações ativas
    const orgs = await prisma.organization.findMany({
      where: {
        subscriptionStatus: { in: ['TRIAL', 'ACTIVE'] }
      },
      select: {
        id: true,
        organizationName: true,
        primaryNickname: true
      }
    })

    logger.info('📊 Organizações encontradas', { count: orgs.length })

    for (const org of orgs) {
      logger.info(`\n🏢 Processando: ${org.organizationName || org.primaryNickname}`, {
        organizationId: org.id
      })

      // 2. Limpar snapshots antigos desta org
      const deleted = await prisma.fullStockSnapshot.deleteMany({
        where: { organizationId: org.id }
      })

      logger.info('🗑️  Snapshots antigos removidos', { count: deleted.count })

      // 3. Forçar sync completo com código NOVO
      const result = await syncOrganizationStock(org.id, {
        force: true,
        concurrency: 2
      })

      logger.info('✅ Sync completado', {
        organizationId: org.id,
        accountsProcessed: result.accountsProcessed,
        itemsSynced: result.itemsSynced,
        errors: result.errors,
        duration: `${(result.duration / 1000).toFixed(2)}s`
      })

      if (result.errors.length > 0) {
        logger.error('⚠️  Erros durante sync', { errors: result.errors })
      }
    }

    logger.info('\n🎉 FORCE RESYNC COMPLETO!')

  } catch (error: any) {
    logger.error('❌ Erro durante force resync', {
      error: error.message,
      stack: error.stack
    })
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
