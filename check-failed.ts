import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  // Verificar últimas perguntas FAILED
  const failed = await prisma.question.findMany({
    where: { status: 'FAILED' },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      mlQuestionId: true,
      status: true,
      failureReason: true,
      mlResponseData: true,
      createdAt: true,
      text: true,
      mlAccount: {
        select: {
          nickname: true
        }
      }
    }
  })

  console.log('\n🔴 === PERGUNTAS COM FALHA ===\n')
  for (const q of failed) {
    console.log(`📋 ML Question ID: ${q.mlQuestionId}`)
    console.log(`👤 Conta: ${q.mlAccount?.nickname}`)
    console.log(`❓ Pergunta: ${q.text?.substring(0, 50)}...`)
    console.log(`❌ Erro: ${q.failureReason || 'Sem detalhes'}`)
    if (q.mlResponseData) {
      console.log(`📊 Response Data: ${JSON.stringify(q.mlResponseData).substring(0, 100)}...`)
    }
    console.log(`🕐 Criada: ${q.createdAt}`)
    console.log('---')
  }

  // Verificar perguntas PROCESSING travadas
  const stuck = await prisma.question.findMany({
    where: {
      status: 'PROCESSING',
      createdAt: {
        lt: new Date(Date.now() - 10 * 60 * 1000) // Mais de 10 minutos
      }
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      mlQuestionId: true,
      text: true,
      createdAt: true,
      mlAccount: {
        select: {
          nickname: true
        }
      }
    }
  })

  if (stuck.length > 0) {
    console.log('\n⚠️ === PERGUNTAS TRAVADAS EM PROCESSING ===\n')
    for (const q of stuck) {
      const minutesAgo = Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 1000 / 60)
      console.log(`📋 ML Question ID: ${q.mlQuestionId}`)
      console.log(`👤 Conta: ${q.mlAccount?.nickname}`)
      console.log(`❓ Pergunta: ${q.text?.substring(0, 50)}...`)
      console.log(`⏰ Travada há: ${minutesAgo} minutos`)
      console.log('---')
    }
  }

  await prisma.$disconnect()
}

check().catch(console.error)