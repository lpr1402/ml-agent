import { prisma } from './lib/prisma'
import { getValidMLToken } from './lib/ml-api/token-manager'

async function main() {
  const accounts = await prisma.mLAccount.findMany({
    where: {
      organization: {
        organizationName: 'GUGALEO'
      },
      isActive: true
    },
    select: {
      id: true,
      mlUserId: true,
      nickname: true
    }
  })

  console.log(`\n🔍 Verificando items Full de ${accounts.length} contas (ENTERPRISE MODE):\n`)

  let totalFullItems = 0
  let totalActiveItems = 0

  for (const account of accounts) {
    const token = await getValidMLToken(account.id)
    if (!token) {
      console.log(`❌ ${account.nickname}: Sem token válido\n`)
      continue
    }

    try {
      // ✅ ENTERPRISE FIX: Buscar TODOS items ativos (sem filtro logistic_type)
      // Necessário para capturar items com convivência Full+Flex
      const allItemsUrl = `https://api.mercadolibre.com/users/${account.mlUserId}/items/search?status=active&limit=50`

      const allItemsResponse = await fetch(allItemsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const allItemsData = await allItemsResponse.json()
      const totalActive = allItemsData.paging?.total || 0
      totalActiveItems += totalActive

      console.log(`\n📦 ${account.nickname}:`)
      console.log(`   Total items ativos: ${totalActive}`)

      // Buscar detalhes para contar quantos têm inventory_id
      const itemIds = allItemsData.results || []
      let fullCount = 0
      let fullActiveCount = 0
      let fullPendingCount = 0

      for (const itemId of itemIds.slice(0, 50)) { // Primeiro batch
        try {
          const itemResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          if (itemResponse.ok) {
            const item = await itemResponse.json()
            const hasInventoryId = !!item.inventory_id
            const isFulfillment = item.shipping?.logistic_type === 'fulfillment'

            if (hasInventoryId) {
              fullCount++
              fullActiveCount++
            } else if (isFulfillment) {
              fullCount++
              fullPendingCount++
            }

            // Check variations
            if (item.variations) {
              for (const variation of item.variations) {
                if (variation.inventory_id) {
                  fullCount++
                  fullActiveCount++
                } else if (isFulfillment) {
                  fullCount++
                  fullPendingCount++
                }
              }
            }
          }

          await new Promise(resolve => setTimeout(resolve, 100)) // Rate limit
        } catch (err) {
          // Silent fail
        }
      }

      console.log(`   Items Full (com inventory_id): ${fullActiveCount}`)
      console.log(`   Items Full pendentes (em trânsito): ${fullPendingCount}`)
      console.log(`   Total Full: ${fullCount}`)
      console.log(`   % Full: ${totalActive > 0 ? ((fullCount / totalActive) * 100).toFixed(1) : 0}%`)

      totalFullItems += fullCount
    } catch (error) {
      console.log(`❌ ${account.nickname}: Erro - ${error}\n`)
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📊 RESUMO ENTERPRISE COMPLETO:`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Total items ativos: ${totalActiveItems}`)
  console.log(`Total items Full capturados: ${totalFullItems}`)
  console.log(`% Full: ${totalActiveItems > 0 ? ((totalFullItems / totalActiveItems) * 100).toFixed(1) : 0}%`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  await prisma.$disconnect()
}

main()
