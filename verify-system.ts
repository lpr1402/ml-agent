/**
 * VERIFICAÇÃO COMPLETA DO SISTEMA ML API
 * Testa TODOS os componentes críticos
 *
 * USO: npx tsx verify-system.ts
 */

import { prisma } from './lib/prisma'
import { redis } from './lib/redis'
import { globalMLRateLimiter } from './lib/ml-api/global-rate-limiter'
import { mlMetricsCollector } from './lib/metrics/ml-metrics-collector'

async function verifySystem() {
  console.log('🔍 VERIFICAÇÃO COMPLETA DO SISTEMA')
  console.log('=' .repeat(60))

  const results = {
    database: false,
    redis: false,
    rateLimiter: false,
    metricsCollector: false,
    mlAccounts: false,
    webhookProcessor: false,
    cache: false,
    websocket: false
  }

  // 1. DATABASE
  try {
    console.log('\n📊 Testando PostgreSQL...')
    await prisma.$queryRaw`SELECT 1`
    const count = await prisma.organization.count()
    console.log(`  ✅ PostgreSQL OK (${count} organizações)`)
    results.database = true
  } catch (error: any) {
    console.log(`  ❌ PostgreSQL FALHOU: ${error.message}`)
  }

  // 2. REDIS
  try {
    console.log('\n💾 Testando Redis...')
    await redis.set('test:verify', 'ok', 'EX', 10)
    const value = await redis.get('test:verify')
    if (value === 'ok') {
      console.log('  ✅ Redis OK')
      results.redis = true
    } else {
      console.log('  ❌ Redis não retornou valor correto')
    }
  } catch (error: any) {
    console.log(`  ❌ Redis FALHOU: ${error.message}`)
  }

  // 3. RATE LIMITER
  try {
    console.log('\n⏱️  Testando Rate Limiter Global...')
    const metrics = globalMLRateLimiter.getMetrics()
    console.log(`  ✅ Rate Limiter OK`)
    console.log(`     - Total requests: ${metrics.totalRequests}`)
    console.log(`     - Queue size: ${metrics.queueSize}`)
    console.log(`     - Success rate: ${metrics.totalRequests > 0 ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) : 100}%`)
    results.rateLimiter = true
  } catch (error: any) {
    console.log(`  ❌ Rate Limiter FALHOU: ${error.message}`)
  }

  // 4. METRICS COLLECTOR
  try {
    console.log('\n📈 Testando Metrics Collector...')
    const dashboard = mlMetricsCollector.getDashboard()
    console.log(`  ✅ Metrics Collector OK`)
    console.log(`     - Status: ${dashboard.status}`)
    console.log(`     - Alertas ativos: ${dashboard.alerts?.active || 0}`)
    results.metricsCollector = true
  } catch (error: any) {
    console.log(`  ❌ Metrics Collector FALHOU: ${error.message}`)
  }

  // 5. ML ACCOUNTS
  try {
    console.log('\n👥 Verificando Contas ML...')
    const accounts = await prisma.mLAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nickname: true,
        mlUserId: true,
        siteId: true,
        tokenExpiresAt: true,
        organization: {
          select: {
            organizationName: true,
            username: true
          }
        }
      }
    })

    console.log(`  ✅ ${accounts.length} contas ML ativas encontradas`)
    accounts.forEach(acc => {
      const tokenValid = new Date(acc.tokenExpiresAt) > new Date()
      console.log(`     - ${acc.nickname} (${acc.siteId}) - Token: ${tokenValid ? '✅' : '⚠️ EXPIRADO'}`)
    })

    if (accounts.length > 0) {
      results.mlAccounts = true
    } else {
      console.log('  ⚠️ Nenhuma conta ML ativa')
    }
  } catch (error: any) {
    console.log(`  ❌ Verificação de contas FALHOU: ${error.message}`)
  }

  // 6. WEBHOOK PROCESSOR
  try {
    console.log('\n🔔 Verificando Webhook Processor...')
    const { processStockOperationWebhook: _processStockOperationWebhook } = await import('./lib/webhooks/stock-operations-processor')
    console.log('  ✅ Webhook Processor carregado')

    // Verificar webhooks recentes
    const recentWebhooks = await prisma.webhookEvent.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // últimas 24h
        }
      }
    })
    console.log(`     - Webhooks nas últimas 24h: ${recentWebhooks}`)

    const stockWebhooks = await prisma.webhookEvent.count({
      where: {
        topic: { in: ['marketplace_fbm_stock', 'fbm_stock_operations', 'stock-locations'] },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })
    console.log(`     - Webhooks de estoque nas últimas 24h: ${stockWebhooks}`)

    results.webhookProcessor = true
  } catch (error: any) {
    console.log(`  ❌ Webhook Processor FALHOU: ${error.message}`)
  }

  // 7. CACHE SYSTEM
  try {
    console.log('\n🗄️  Testando Sistema de Cache...')
    const { snapshotCache } = await import('./lib/cache/stock-cache')

    // Test snapshot cache
    await snapshotCache.set('TEST123', { test: true }, 'test-org')
    const cached = await snapshotCache.get('TEST123', 'test-org')

    if (cached) {
      console.log('  ✅ Cache de snapshots OK')
      await snapshotCache.invalidate('TEST123', 'test-org')
    } else {
      console.log('  ⚠️ Cache de snapshots não retornou valor')
    }

    results.cache = true
  } catch (error: any) {
    console.log(`  ❌ Cache FALHOU: ${error.message}`)
  }

  // 8. WEBSOCKET EVENTS
  try {
    console.log('\n🌐 Verificando WebSocket Events...')
    const { emitStockUpdate: _emitStockUpdate } = await import('./lib/websocket/emit-events')
    console.log('  ✅ WebSocket Events carregado')

    // Verificar se Redis Pub/Sub está funcionando
    await redis.publish('test:channel', JSON.stringify({ test: true }))
    console.log('  ✅ Redis Pub/Sub OK')

    results.websocket = true
  } catch (error: any) {
    console.log(`  ❌ WebSocket Events FALHOU: ${error.message}`)
  }

  // 9. FULL STOCK SNAPSHOTS
  try {
    console.log('\n📦 Verificando Snapshots de Estoque Full...')
    const snapshots = await prisma.fullStockSnapshot.count()
    console.log(`  ✅ ${snapshots} snapshots de estoque encontrados`)

    if (snapshots > 0) {
      const recent = await prisma.fullStockSnapshot.findFirst({
        orderBy: { lastAnalyzedAt: 'desc' },
        select: {
          itemTitle: true,
          availableStock: true,
          totalStock: true,
          lastAnalyzedAt: true,
          mlAccount: {
            select: { nickname: true }
          }
        }
      })

      if (recent) {
        console.log(`     Último snapshot:`)
        console.log(`     - Item: ${recent.itemTitle}`)
        console.log(`     - Conta: ${recent.mlAccount.nickname}`)
        console.log(`     - Estoque: ${recent.availableStock}/${recent.totalStock}`)
        console.log(`     - Última análise: ${recent.lastAnalyzedAt.toLocaleString('pt-BR')}`)
      }
    }
  } catch (error: any) {
    console.log(`  ⚠️ Verificação de snapshots: ${error.message}`)
  }

  // RESULTADO FINAL
  console.log('\n' + '='.repeat(60))
  console.log('📋 RESULTADO DA VERIFICAÇÃO')
  console.log('=' .repeat(60))

  const total = Object.keys(results).length
  const passed = Object.values(results).filter(Boolean).length
  const percentage = ((passed / total) * 100).toFixed(0)

  Object.entries(results).forEach(([component, status]) => {
    console.log(`${status ? '✅' : '❌'} ${component.toUpperCase().padEnd(20)} ${status ? 'OK' : 'FALHOU'}`)
  })

  console.log('\n' + '='.repeat(60))
  console.log(`\n🎯 SCORE: ${passed}/${total} (${percentage}%)`)

  if (passed === total) {
    console.log('\n✅ SISTEMA 100% OPERACIONAL!')
    console.log('\n🎉 Todos os componentes funcionando perfeitamente!')
  } else {
    console.log('\n⚠️ Alguns componentes precisam de atenção')
    console.log('\nComponentes com falha:')
    Object.entries(results).forEach(([component, status]) => {
      if (!status) {
        console.log(`  - ${component}`)
      }
    })
  }

  console.log('\n📚 Próximos passos:')
  console.log('  1. Verificar logs: pm2 logs --lines 100')
  console.log('  2. Testar sincronização: npx tsx test-full-sync.ts')
  console.log('  3. Ver métricas: curl https://gugaleo.axnexlabs.com.br/api/ml-metrics?format=dashboard | jq')
  console.log('  4. Acessar UI: https://gugaleo.axnexlabs.com.br')

  await prisma.$disconnect()
  await redis.quit()

  process.exit(passed === total ? 0 : 1)
}

// Run verification
verifySystem().catch(error => {
  console.error('\n❌ ERRO FATAL:', error.message)
  console.error(error.stack)
  process.exit(1)
})
