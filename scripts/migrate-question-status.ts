#!/usr/bin/env npx tsx
/**
 * Script para migrar status antigos para os novos status simplificados
 * PENDING, PROCESSING, REVIEWING, RESPONDED
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function migrateQuestionStatus() {
  logger.info('[Status Migration] Starting question status migration...')

  try {
    // Mapeamento de status antigos para novos
    const statusMapping = [
      { old: ['RECEIVED', 'AWAITING_APPROVAL'], new: 'PENDING' },
      { old: ['REVISING'], new: 'REVIEWING' },
      { old: ['APPROVED', 'SENT_TO_ML', 'COMPLETED'], new: 'RESPONDED' }
    ]

    let totalUpdated = 0

    for (const mapping of statusMapping) {
      const result = await prisma.question.updateMany({
        where: {
          status: {
            in: mapping.old
          }
        },
        data: {
          status: mapping.new
        }
      })

      totalUpdated += result.count
      logger.info(`[Status Migration] Updated ${result.count} questions from [${mapping.old.join(', ')}] to ${mapping.new}`)
    }

    // Obter estatísticas atualizadas
    const stats = await prisma.question.groupBy({
      by: ['status'],
      _count: {
        _all: true
      }
    })

    logger.info('[Status Migration] Migration complete!', {
      totalUpdated,
      currentDistribution: stats.map(s => ({ status: s.status, count: s._count._all }))
    })

    // Verificar se ainda existem status antigos
    const oldStatuses = await prisma.question.findMany({
      where: {
        status: {
          in: ['RECEIVED', 'AWAITING_APPROVAL', 'REVISING', 'APPROVED', 'SENT_TO_ML', 'COMPLETED']
        }
      },
      select: {
        id: true,
        status: true
      }
    })

    if (oldStatuses.length > 0) {
      logger.warn(`[Status Migration] Found ${oldStatuses.length} questions with old status that were not migrated`)
      logger.warn('[Status Migration] Old statuses:', oldStatuses)
    } else {
      logger.info('[Status Migration] ✅ All questions successfully migrated to new status system!')
    }

  } catch (error) {
    logger.error('[Status Migration] Error during migration:', { error })
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Execute if running directly
if (require.main === module) {
  migrateQuestionStatus()
    .then(() => {
      console.log('✅ Status migration completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Status migration failed:', error)
      process.exit(1)
    })
}

export { migrateQuestionStatus }