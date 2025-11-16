/**
 * DIAGNÓSTICO - DETECÇÃO DE TIPOS DE ESTOQUE
 * Script para validar a nova lógica de detecção
 * Outubro 2025 - Testing Tool
 *
 * USO:
 * npx tsx diagnose-stock-detection.ts <ml_account_id>
 */

import { prisma } from './lib/prisma'
import { getValidMLToken } from './lib/ml-api/token-manager'
import { stockTypeDetector } from './lib/stock/stock-type-detector'
import { logger } from './lib/logger'

async function diagnoseStockDetection(mlAccountId: string) {
  console.log('\n🔍 DIAGNÓSTICO DE DETECÇÃO DE ESTOQUE\n')
  console.log('='+ '='.repeat(60))

  try {
    // 1. Buscar conta ML
    const mlAccount = await prisma.mLAccount.findUnique({
      where: { id: mlAccountId },
      select: {
        id: true,
        nickname: true,
        mlUserId: true,
        siteId: true,
        organizationId: true
      }
    })

    if (!mlAccount) {
      console.error('❌ ML Account não encontrada:', mlAccountId)
      return
    }

    console.log('\n✅ Conta ML encontrada:')
    console.log('   - ID:', mlAccount.id)
    console.log('   - Nickname:', mlAccount.nickname)
    console.log('   - User ID:', mlAccount.mlUserId)
    console.log('   - Site:', mlAccount.siteId)

    // 2. Obter token
    const token = await getValidMLToken(mlAccountId)
    if (!token) {
      console.error('\n❌ Token inválido ou expirado')
      return
    }

    console.log('\n✅ Token obtido com sucesso')

    // 3. Buscar alguns items para teste (primeiros 10)
    console.log('\n🔍 Buscando primeiros 10 items ativos...\n')

    const searchRes = await fetch(
      `https://api.mercadolibre.com/users/${mlAccount.mlUserId}/items/search?status=active&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!searchRes.ok) {
      console.error('❌ Erro ao buscar items:', searchRes.status)
      return
    }

    const searchData = await searchRes.json()
    const itemIds = searchData.results || []

    console.log(`✅ ${itemIds.length} items encontrados\n`)

    // 4. Buscar detalhes e testar detecção
    const detectionResults: any[] = []

    for (const itemId of itemIds) {
      const itemRes = await fetch(
        `https://api.mercadolibre.com/items/${itemId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!itemRes.ok) continue

      const item = await itemRes.json()

      // Testar detecção
      const report = stockTypeDetector.generateDetectionReport(item)

      detectionResults.push({
        itemId: item.id,
        title: item.title?.substring(0, 50) + '...',
        report
      })

      // Aguardar rate limit
      await new Promise(resolve => setTimeout(resolve, 2100))
    }

    // 5. Gerar relatório
    console.log('='+ '='.repeat(60))
    console.log('\n📊 RELATÓRIO DE DETECÇÃO\n')

    const stats = {
      fullPure: 0,
      fullFlex: 0,
      multiOrigin: 0,
      pendingReception: 0,
      flexOnly: 0,
      notFull: 0,
      totalVariations: 0,
      variationsWithFull: 0
    }

    for (const result of detectionResults) {
      const { itemId, title, report } = result

      console.log(`\n📦 Item: ${itemId}`)
      console.log(`   Título: ${title}`)
      console.log(`   Tipo Base: ${report.baseItem.type}`)
      console.log(`   Endpoint: ${report.baseItem.endpoint || 'N/A'}`)
      console.log(`   Inventory ID: ${report.baseItem.inventoryId || 'N/A'}`)
      console.log(`   User Product ID: ${report.baseItem.userProductId || 'N/A'}`)
      console.log(`   Razão: ${report.baseItem.reason}`)

      // Estatísticas
      if (report.baseItem.type === 'full_pure') stats.fullPure++
      else if (report.baseItem.type === 'full_flex') stats.fullFlex++
      else if (report.baseItem.type === 'multi_origin') stats.multiOrigin++
      else if (report.baseItem.type === 'pending_reception') stats.pendingReception++
      else if (report.baseItem.type === 'flex_only') stats.flexOnly++
      else stats.notFull++

      // Variações
      if (report.variations.length > 0) {
        console.log(`   Variações com Full: ${report.variations.length}`)
        stats.totalVariations += report.variations.length
        stats.variationsWithFull += report.variations.length

        for (const varResult of report.variations) {
          console.log(`     • Variação ${varResult.variationId}: ${varResult.detection.type}`)
          console.log(`       Endpoint: ${varResult.detection.endpoint || 'N/A'}`)

          if (varResult.detection.type === 'full_pure') stats.fullPure++
          else if (varResult.detection.type === 'full_flex') stats.fullFlex++
          else if (varResult.detection.type === 'multi_origin') stats.multiOrigin++
          else if (varResult.detection.type === 'pending_reception') stats.pendingReception++
        }
      }
    }

    // Resumo final
    console.log('\n' + '='.repeat(60))
    console.log('\n📈 RESUMO ESTATÍSTICO\n')
    console.log(`Total de Items Analisados: ${detectionResults.length}`)
    console.log(`\nDetecção por Tipo:`)
    console.log(`  🟢 Full Puro:            ${stats.fullPure}`)
    console.log(`  🔵 Full+Flex:            ${stats.fullFlex}`)
    console.log(`  🟣 Multi-Origem:         ${stats.multiOrigin}`)
    console.log(`  🟡 Pending Reception:    ${stats.pendingReception}`)
    console.log(`  ⚪ Flex Only (ignored):  ${stats.flexOnly}`)
    console.log(`  ⚫ Not Full (ignored):   ${stats.notFull}`)
    console.log(`\nVariações:`)
    console.log(`  Total de Variações:      ${stats.totalVariations}`)
    console.log(`  Variações com Full:      ${stats.variationsWithFull}`)

    const totalFullEntries = stats.fullPure + stats.fullFlex + stats.multiOrigin + stats.pendingReception
    console.log(`\n🎯 TOTAL DE ENTRADAS FULL: ${totalFullEntries}`)
    console.log(`   (Serão sincronizadas no sistema)`)

    console.log('\n' + '='.repeat(60))
    console.log('\n✅ Diagnóstico concluído!\n')

  } catch (error: any) {
    console.error('\n❌ Erro no diagnóstico:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar
const mlAccountId = process.argv[2]

if (!mlAccountId) {
  console.error('\n❌ Uso: npx tsx diagnose-stock-detection.ts <ml_account_id>\n')
  process.exit(1)
}

diagnoseStockDetection(mlAccountId).catch(console.error)
