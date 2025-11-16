import { prisma } from './lib/prisma'
import { getValidMLToken } from './lib/ml-api/token-manager'

async function main() {
  const account = await prisma.mLAccount.findFirst({
    where: { nickname: 'GUGALEO COMÉRCIO' }
  })

  if (!account) {
    console.log('Conta não encontrada')
    return
  }

  const token = await getValidMLToken(account.id)
  
  // Buscar primeiro item
  const searchRes = await fetch(
    `https://api.mercadolibre.com/users/${account.mlUserId}/items/search?status=active&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const search: any = await searchRes.json()
  const itemId = search.results[0]

  console.log('\n🔬 Testando item:', itemId, '\n')

  // TESTE 1: /items/{id}
  console.log('1️⃣ GET /items/' + itemId)
  const res1 = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const item1: any = await res1.json()
  console.log('inventory_id:', item1.inventory_id || '❌ VAZIO')
  console.log('logistic_type:', item1.shipping?.logistic_type || 'N/A')
  console.log('Status:', res1.status)
  console.log('Fields:', Object.keys(item1).slice(0, 15).join(', '))

  // TESTE 2: /marketplace/items/{id}  
  console.log('\n2️⃣ GET /marketplace/items/' + itemId)
  const res2 = await fetch(`https://api.mercadolibre.com/marketplace/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const item2: any = await res2.json()
  console.log('inventory_id:', item2.inventory_id || '❌ VAZIO')
  console.log('logistic_type:', item2.shipping?.logistic_type || 'N/A')
  console.log('Status:', res2.status)
  console.log('Fields:', Object.keys(item2).slice(0, 15).join(', '))

  // Response completa
  console.log('\n📄 Item completo (/items):')
  console.log(JSON.stringify(item1, null, 2))

  await prisma.$disconnect()
}

main()
