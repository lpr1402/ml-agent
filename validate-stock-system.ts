/**
 * VALIDAÇÃO DO SISTEMA DE ESTOQUE - PRODUCTION CHECK
 * Script para validar correções em produção
 * Outubro 2025
 *
 * USO:
 * npx tsx validate-stock-system.ts
 */

import { prisma } from './lib/prisma'

async function validateStockSystem() {
  console.log('\n🔍 VALIDAÇÃO DO SISTEMA DE ESTOQUE FULL\n')
  console.log('=' + '='.repeat(70))

  try {
    const checks: Record<string, { status: 'OK' | 'WARNING' | 'ERROR'; message: string; details?: any }> = {}

    // 1. Verificar database connection
    console.log('\n1️⃣  Verificando database...')
    try {
      await prisma.$queryRaw`SELECT 1`
      checks['database'] = { status: 'OK', message: 'Database conectado' }
      console.log('   ✅ Database OK')
    } catch (error: any) {
      checks['database'] = { status: 'ERROR', message: error.message }
      console.log('   ❌ Database ERROR:', error.message)
    }

    // 2. Contar snapshots por tipo
    console.log('\n2️⃣  Analisando snapshots...')
    const totalSnapshots = await prisma.fullStockSnapshot.count()
    const snapshotsWithUserProductId = await prisma.fullStockSnapshot.count({
      where: { userProductId: { not: null } }
    })
    const pendingSnapshots = await prisma.fullStockSnapshot.count({
      where: { inventoryId: { startsWith: 'PENDING_' } }
    })

    console.log(`   Total de snapshots: ${totalSnapshots}`)
    console.log(`   Com user_product_id: ${snapshotsWithUserProductId}`)
    console.log(`   Pending reception: ${pendingSnapshots}`)

    checks['snapshots'] = {
      status: totalSnapshots > 0 ? 'OK' : 'WARNING',
      message: `${totalSnapshots} snapshots no banco`,
      details: {
        total: totalSnapshots,
        withUserProduct: snapshotsWithUserProductId,
        pending: pendingSnapshots
      }
    }

    // 3. Verificar distribuição por tipo
    console.log('\n3️⃣  Distribuição por tipo de conta...')
    const accounts = await prisma.mLAccount.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            fullStockSnapshots: true
          }
        }
      }
    })

    for (const account of accounts) {
      console.log(`   ${account.nickname}: ${account._count.fullStockSnapshots} items Full`)
    }

    checks['accounts'] = {
      status: accounts.length > 0 ? 'OK' : 'WARNING',
      message: `${accounts.length} contas ML ativas`,
      details: accounts.map(a => ({
        nickname: a.nickname,
        itemsCount: a._count.fullStockSnapshots
      }))
    }

    // 4. Verificar últimas sincronizações
    console.log('\n4️⃣  Últimas sincronizações...')
    const recentSyncs = await prisma.fullStockSnapshot.groupBy({
      by: ['mlAccountId'],
      _max: {
        lastAnalyzedAt: true
      },
      orderBy: {
        _max: {
          lastAnalyzedAt: 'desc'
        }
      },
      take: 5
    })

    for (const sync of recentSyncs) {
      const account = accounts.find(a => a.id === sync.mlAccountId)
      const timeSince = sync._max.lastAnalyzedAt
        ? Math.round((Date.now() - sync._max.lastAnalyzedAt.getTime()) / 1000 / 60)
        : null

      console.log(`   ${account?.nickname || sync.mlAccountId}: ${timeSince} minutos atrás`)
    }

    const oldestSync = recentSyncs[recentSyncs.length - 1]
    const oldestTime = oldestSync?._max.lastAnalyzedAt
      ? Math.round((Date.now() - oldestSync._max.lastAnalyzedAt.getTime()) / 1000 / 60 / 60)
      : null

    checks['sync_freshness'] = {
      status: oldestTime && oldestTime < 24 ? 'OK' : 'WARNING',
      message: `Última sync há ${oldestTime} horas`,
      details: { oldestSyncHoursAgo: oldestTime }
    }

    // 5. Verificar alertas
    console.log('\n5️⃣  Status de alertas...')
    const alertCounts = await prisma.fullStockSnapshot.groupBy({
      by: ['alertLevel'],
      _count: true
    })

    for (const alert of alertCounts) {
      console.log(`   ${alert.alertLevel}: ${alert._count}`)
    }

    const criticalCount = alertCounts.find(a => a.alertLevel === 'critical')?._count || 0

    checks['alerts'] = {
      status: criticalCount === 0 ? 'OK' : criticalCount < 10 ? 'WARNING' : 'ERROR',
      message: `${criticalCount} items críticos`,
      details: alertCounts.reduce((acc: any, a) => {
        acc[a.alertLevel] = a._count
        return acc
      }, {})
    }

    // 6. Verificar webhooks processados
    console.log('\n6️⃣  Processamento de webhooks...')
    const webhookStats = await prisma.webhookEvent.groupBy({
      by: ['status'],
      where: {
        topic: 'marketplace_fbm_stock',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // últimas 24h
        }
      },
      _count: true
    })

    for (const stat of webhookStats) {
      console.log(`   ${stat.status}: ${stat._count}`)
    }

    const failedCount = webhookStats.find(s => s.status === 'FAILED')?._count || 0

    checks['webhooks'] = {
      status: failedCount === 0 ? 'OK' : failedCount < 5 ? 'WARNING' : 'ERROR',
      message: `${failedCount} webhooks falharam (24h)`,
      details: webhookStats.reduce((acc: any, s) => {
        acc[s.status] = s._count
        return acc
      }, {})
    }

    // 7. Verificar operações de estoque
    console.log('\n7️⃣  Operações de estoque (últimas 24h)...')
    const operationCounts = await prisma.stockOperation.groupBy({
      by: ['operationType'],
      where: {
        dateCreated: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      _count: true,
      orderBy: {
        _count: {
          operationType: 'desc'
        }
      },
      take: 5
    })

    for (const op of operationCounts) {
      console.log(`   ${op.operationType}: ${op._count}`)
    }

    const totalOps = operationCounts.reduce((sum, o) => sum + o._count, 0)

    checks['operations'] = {
      status: 'OK',
      message: `${totalOps} operações processadas (24h)`,
      details: operationCounts.reduce((acc: any, o) => {
        acc[o.operationType] = o._count
        return acc
      }, {})
    }

    // RESUMO FINAL
    console.log('\n' + '=' + '='.repeat(70))
    console.log('\n📊 RESUMO DA VALIDAÇÃO\n')

    const okCount = Object.values(checks).filter(c => c.status === 'OK').length
    const warningCount = Object.values(checks).filter(c => c.status === 'WARNING').length
    const errorCount = Object.values(checks).filter(c => c.status === 'ERROR').length

    for (const [name, check] of Object.entries(checks)) {
      const icon = check.status === 'OK' ? '✅' : check.status === 'WARNING' ? '⚠️' : '❌'
      console.log(`${icon} ${name}: ${check.message}`)
    }

    console.log('\n' + '=' + '='.repeat(70))

    if (errorCount > 0) {
      console.log('\n❌ VALIDAÇÃO FALHOU')
      console.log(`   ${errorCount} erro(s), ${warningCount} warning(s)`)
      process.exit(1)
    } else if (warningCount > 0) {
      console.log('\n⚠️  VALIDAÇÃO OK COM WARNINGS')
      console.log(`   ${warningCount} warning(s) encontrado(s)`)
      console.log('\n💡 Recomendações:')
      if (checks['sync_freshness']?.status === 'WARNING') {
        console.log('   • Executar sincronização manual: POST /api/stock/sync-full')
      }
      if (checks['alerts']?.status === 'WARNING') {
        console.log('   • Revisar items críticos no dashboard')
      }
    } else {
      console.log('\n✅ VALIDAÇÃO 100% OK')
      console.log(`   Todos os ${okCount} checks passaram`)
    }

    console.log('\n' + '=' + '='.repeat(70))
    console.log('\n🎯 Sistema de Estoque Full: OPERACIONAL\n')

  } catch (error: any) {
    console.error('\n❌ Erro na validação:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar
validateStockSystem().catch(console.error)
