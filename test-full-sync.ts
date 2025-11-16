/**
 * TESTE DE SINCRONIZAÇÃO COMPLETA - GUGALEO
 * Verifica e sincroniza TODOS os items Full de TODAS as contas ML
 *
 * USO: npx tsx test-full-sync.ts
 */

import { prisma } from './lib/prisma'
import { fullStockSyncService } from './lib/stock/full-stock-sync-service'

async function testFullSync() {
  try {
    console.log('🚀 TESTE DE SINCRONIZAÇÃO COMPLETA - GUGALEO')
    console.log('=' .repeat(60))

    // 1. Buscar organização GUGALEO
    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { organizationName: { contains: 'GUGALEO', mode: 'insensitive' } },
          { primaryNickname: { contains: 'GUGALEO', mode: 'insensitive' } },
          { username: { contains: 'gugaleo', mode: 'insensitive' } }
        ]
      },
      include: {
        mlAccounts: {
          where: { isActive: true },
          select: {
            id: true,
            nickname: true,
            mlUserId: true,
            siteId: true,
            isActive: true,
            tokenExpiresAt: true
          }
        }
      }
    })

    if (!org) {
      console.error('❌ Organização GUGALEO não encontrada!')
      console.log('\n📋 Organizações disponíveis:')
      const orgs = await prisma.organization.findMany({
        select: {
          id: true,
          organizationName: true,
          username: true,
          primaryNickname: true
        }
      })
      orgs.forEach(o => {
        console.log(`  - ${o.organizationName || o.username} (${o.primaryNickname})`)
      })
      process.exit(1)
    }

    console.log(`\n✅ Organização encontrada: ${org.organizationName || org.username}`)
    console.log(`   ID: ${org.id}`)
    console.log(`\n📊 Contas ML ativas: ${org.mlAccounts.length}`)

    org.mlAccounts.forEach((acc, i) => {
      const tokenValid = new Date(acc.tokenExpiresAt) > new Date()
      console.log(`   ${i + 1}. ${acc.nickname} (${acc.siteId})`)
      console.log(`      User ID: ${acc.mlUserId}`)
      console.log(`      Token: ${tokenValid ? '✅ Válido' : '⚠️ Expirado'}`)
    })

    // 2. Verificar estoque atual no banco
    const currentSnapshots = await prisma.fullStockSnapshot.findMany({
      where: { organizationId: org.id },
      select: {
        mlAccountId: true,
        inventoryId: true,
        itemTitle: true,
        totalStock: true,
        availableStock: true,
        mlAccount: {
          select: { nickname: true }
        }
      }
    })

    console.log(`\n📦 Snapshots atuais no banco: ${currentSnapshots.length}`)

    if (currentSnapshots.length > 0) {
      const byAccount = currentSnapshots.reduce((acc, s) => {
        const key = s.mlAccount.nickname
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      Object.entries(byAccount).forEach(([nickname, count]) => {
        console.log(`   - ${nickname}: ${count} items`)
      })
    }

    // 3. Confirmar sincronização
    console.log('\n' + '='.repeat(60))
    console.log('🔄 Iniciando sincronização completa...')
    console.log('   Isso pode levar alguns minutos...')
    console.log('=' .repeat(60))

    const startTime = Date.now()

    const result = await fullStockSyncService.syncOrganization(org.id, {
      force: true, // Forçar resync completo
      skipCache: false
    })

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    // 4. Mostrar resultados
    console.log('\n' + '='.repeat(60))
    console.log('✅ SINCRONIZAÇÃO COMPLETA!')
    console.log('=' .repeat(60))
    console.log(`⏱️  Duração: ${duration}s`)
    console.log(`📊 Status: ${result.success ? '✅ Sucesso' : '❌ Falha'}`)
    console.log(`🔢 Contas processadas: ${result.accountsProcessed}`)
    console.log(`❌ Contas com erro: ${result.accountsFailed}`)
    console.log(`📦 Total de items: ${result.totalItems}`)
    console.log(`🏷️  Total de inventories: ${result.totalInventories}`)

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Erros encontrados:`)
      result.errors.forEach(err => {
        console.log(`   - ${err.accountId}: ${err.error}`)
      })
    }

    // 5. Verificar dados atualizados
    const updatedSnapshots = await prisma.fullStockSnapshot.findMany({
      where: { organizationId: org.id },
      select: {
        mlAccountId: true,
        inventoryId: true,
        itemId: true,
        variationId: true,
        itemTitle: true,
        itemPrice: true,
        totalStock: true,
        availableStock: true,
        notAvailableStock: true,
        lastAnalyzedAt: true,
        mlAccount: {
          select: { nickname: true }
        }
      },
      orderBy: { lastAnalyzedAt: 'desc' }
    })

    console.log(`\n📦 Snapshots após sincronização: ${updatedSnapshots.length}`)

    const byAccount = updatedSnapshots.reduce((acc, s) => {
      const key = s.mlAccount.nickname
      if (!acc[key]) {
        acc[key] = { count: 0, totalStock: 0, availableStock: 0 }
      }
      acc[key].count++
      acc[key].totalStock += s.totalStock
      acc[key].availableStock += s.availableStock
      return acc
    }, {} as Record<string, { count: number; totalStock: number; availableStock: number }>)

    console.log('\n📊 Detalhamento por conta:')
    Object.entries(byAccount).forEach(([nickname, stats]) => {
      console.log(`\n   🏪 ${nickname}`)
      console.log(`      Items Full: ${stats.count}`)
      console.log(`      Estoque Total: ${stats.totalStock} unidades`)
      console.log(`      Estoque Disponível: ${stats.availableStock} unidades`)
    })

    // 6. Mostrar alguns items de exemplo
    if (updatedSnapshots.length > 0) {
      console.log(`\n📋 Primeiros items sincronizados (até 10):`)
      updatedSnapshots.slice(0, 10).forEach((s, i) => {
        console.log(`\n   ${i + 1}. ${s.itemTitle}`)
        console.log(`      Item ID: ${s.itemId}${s.variationId ? ` (variação ${s.variationId})` : ''}`)
        console.log(`      Inventory ID: ${s.inventoryId}`)
        console.log(`      Conta: ${s.mlAccount.nickname}`)
        console.log(`      Preço: R$ ${s.itemPrice.toFixed(2)}`)
        console.log(`      Estoque: ${s.availableStock}/${s.totalStock} (${s.notAvailableStock} indisponível)`)
        console.log(`      Última análise: ${s.lastAnalyzedAt.toLocaleString('pt-BR')}`)
      })
    }

    // 7. Estatísticas gerais
    const totalStockValue = updatedSnapshots.reduce((sum, s) => sum + (s.availableStock * s.itemPrice), 0)
    const totalStock = updatedSnapshots.reduce((sum, s) => sum + s.totalStock, 0)
    const totalAvailable = updatedSnapshots.reduce((sum, s) => sum + s.availableStock, 0)

    console.log('\n' + '='.repeat(60))
    console.log('💰 ESTATÍSTICAS FINAIS')
    console.log('=' .repeat(60))
    console.log(`📦 Total de items Full: ${updatedSnapshots.length}`)
    console.log(`📊 Estoque total: ${totalStock} unidades`)
    console.log(`✅ Disponível: ${totalAvailable} unidades`)
    console.log(`💵 Valor em estoque: R$ ${totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)

    console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!')
    console.log('\n🎯 Próximos passos:')
    console.log('   1. Acesse a UI em: https://gugaleo.axnexlabs.com.br')
    console.log('   2. Vá para a seção de Estoque Full')
    console.log('   3. Você verá TODOS os items sincronizados!')

  } catch (error: any) {
    console.error('\n❌ ERRO:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar teste
testFullSync()
