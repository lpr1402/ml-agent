import { prisma } from './lib/prisma'

async function checkTokenDetails() {
  const account = await prisma.mLAccount.findFirst({
    where: { nickname: 'GS.ECOMMERCE' }
  })

  if (!account) {
    console.log('❌ Conta não encontrada')
    return
  }

  console.log('📊 DETALHES DA CONTA GS.ECOMMERCE')
  console.log('═'.repeat(60))
  console.log('ID:', account.id)
  console.log('Nickname:', account.nickname)
  console.log('Site:', account.siteId)
  console.log('ML User ID:', account.mlUserId)
  console.log('')
  console.log('🔐 TOKENS:')
  console.log('accessToken:', account.accessToken ? '✅ Presente (' + account.accessToken.length + ' chars)' : '❌ NULL')
  console.log('accessTokenIV:', account.accessTokenIV ? '✅ Presente' : '❌ NULL')
  console.log('accessTokenTag:', account.accessTokenTag ? '✅ Presente' : '❌ NULL')
  console.log('refreshToken:', account.refreshToken ? '✅ Presente (' + account.refreshToken.length + ' chars)' : '❌ NULL')
  console.log('refreshTokenIV:', account.refreshTokenIV ? '✅ Presente' : '❌ NULL')
  console.log('refreshTokenTag:', account.refreshTokenTag ? '✅ Presente' : '❌ NULL')
  console.log('')
  console.log('📅 DATAS:')
  console.log('Token expira em:', account.tokenExpiresAt?.toISOString() || 'N/A')
  console.log('Última sincronização:', account.lastSyncAt?.toISOString() || 'N/A')
  console.log('')
  console.log('✅ STATUS:')
  console.log('Ativa:', account.isActive ? 'Sim' : 'Não')
  console.log('Primária:', account.isPrimary ? 'Sim' : 'Não')
  console.log('Erro de conexão:', account.connectionError || 'Nenhum')

  await prisma.$disconnect()
}

checkTokenDetails()
