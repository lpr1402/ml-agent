import { prisma } from '@/lib/prisma'

async function deleteFailedQuestions() {
  console.log('🔍 Buscando perguntas com falha da conta ELITESAUDEANIMAL...\n')

  // Primeiro buscar a conta
  const account = await prisma.mLAccount.findFirst({
    where: { nickname: 'ELITESAUDEANIMAL' }
  })

  if (!account) {
    console.log('❌ Conta ELITESAUDEANIMAL não encontrada!')
    await prisma.$disconnect()
    return
  }

  console.log('✅ Conta encontrada:', {
    id: account.id,
    nickname: account.nickname,
    mlUserId: account.mlUserId
  })

  // Buscar perguntas com status FAILED
  const failedQuestions = await prisma.question.findMany({
    where: {
      mlAccountId: account.id,
      status: 'FAILED'
    },
    select: {
      id: true,
      mlQuestionId: true,
      text: true,
      status: true,
      failureReason: true,
      createdAt: true
    }
  })

  console.log(`\n📊 Encontradas ${failedQuestions.length} perguntas com falha:\n`)

  if (failedQuestions.length === 0) {
    console.log('✅ Nenhuma pergunta com falha encontrada!')
    await prisma.$disconnect()
    return
  }

  // Mostrar detalhes
  failedQuestions.forEach((q, i) => {
    console.log(`${i + 1}. ID: ${q.id}`)
    console.log(`   ML Question ID: ${q.mlQuestionId}`)
    console.log(`   Texto: ${q.text.substring(0, 100)}${q.text.length > 100 ? '...' : ''}`)
    console.log(`   Erro: ${q.failureReason || 'Não especificado'}`)
    console.log(`   Data: ${q.createdAt}`)
    console.log()
  })

  console.log('🗑️  DELETANDO TODAS AS PERGUNTAS COM FALHA...')

  // Deletar todas as perguntas com falha
  const deleteResult = await prisma.question.deleteMany({
    where: {
      mlAccountId: account.id,
      status: 'FAILED'
    }
  })

  console.log(`\n✅ ${deleteResult.count} perguntas deletadas com sucesso!`)

  // Verificar total de perguntas restantes
  const remainingQuestions = await prisma.question.count({
    where: {
      mlAccountId: account.id
    }
  })

  console.log(`\n📈 Status final:`)
  console.log(`   - Perguntas deletadas: ${deleteResult.count}`)
  console.log(`   - Perguntas restantes: ${remainingQuestions}`)

  await prisma.$disconnect()
}

deleteFailedQuestions().catch(error => {
  console.error('❌ Erro:', error)
  prisma.$disconnect()
})