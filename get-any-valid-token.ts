import { prisma } from './lib/prisma'
import { getValidMLToken } from './lib/ml-api/token-manager'

async function main() {
  const account = await prisma.mLAccount.findUnique({
    where: { mlUserId: '697346348' },
    select: { id: true, mlUserId: true, nickname: true }
  })

  if (!account) {
    console.log('Conta não encontrada')
    process.exit(1)
  }

  const token = await getValidMLToken(account.id)

  console.log('Token:', token)
  console.log('User ID:', account.mlUserId)
  console.log('Nickname:', account.nickname)
  console.log('Expira em:', new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString())

  await prisma.$disconnect()
}

main()
