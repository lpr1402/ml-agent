import { prisma } from '@/lib/prisma'

async function showCurrentStatus() {
  const account = await prisma.mLAccount.findFirst({
    where: { nickname: 'ELITESAUDEANIMAL' },
    select: {
      nickname: true,
      thumbnail: true,
      mlUserId: true,
      siteId: true
    }
  })

  console.log('\n📸 STATUS ATUAL DO AVATAR:\n')
  console.log('Conta:', account?.nickname)
  console.log('ML User ID:', account?.mlUserId)
  console.log('Thumbnail no banco:', account?.thumbnail || 'NENHUM')

  if (!account?.thumbnail) {
    console.log('\n⚠️ NENHUMA FOTO DE PERFIL CADASTRADA')
    console.log('\nPARA ADICIONAR FOTO:')
    console.log('1. Acesse sua conta no Mercado Livre')
    console.log('2. Vá em Minha Conta > Dados Pessoais')
    console.log('3. Adicione uma foto de perfil')
    console.log('4. Faça logout e login novamente no ML Agent')
    console.log('5. A foto será sincronizada automaticamente')
  }

  await prisma.$disconnect()
}

showCurrentStatus()