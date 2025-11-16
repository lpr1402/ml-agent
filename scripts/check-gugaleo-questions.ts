/**
 * Script para investigar discrepância de perguntas GUGALEO
 */

import { prisma } from '@/lib/prisma'

async function checkQuestions() {
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { organizationName: { contains: 'GUGALEO', mode: 'insensitive' } },
        { primaryNickname: { contains: 'GUGALEO', mode: 'insensitive' } }
      ]
    },
    include: { mlAccounts: true }
  })

  if (!org) {
    console.log('Organização não encontrada')
    return
  }

  console.log(`Organização: ${org.organizationName}`)
  console.log(`Contas: ${org.mlAccounts.length}\n`)

  const accountIds = org.mlAccounts.map(a => a.id)

  // Total de perguntas por status
  const questionsByStatus = await prisma.question.groupBy({
    by: ['status'],
    where: { mlAccountId: { in: accountIds } },
    _count: true
  })

  console.log('📊 Perguntas por status:')
  questionsByStatus.forEach(s => {
    console.log(`   ${s.status}: ${s._count}`)
  })

  // Total geral
  const total = await prisma.question.count({
    where: { mlAccountId: { in: accountIds } }
  })

  console.log(`\n✅ Total de perguntas: ${total}`)

  // Perguntas RESPONDED/COMPLETED com sentToMLAt
  const respondedWithDate = await prisma.question.count({
    where: {
      mlAccountId: { in: accountIds },
      status: { in: ['RESPONDED', 'COMPLETED'] },
      sentToMLAt: { not: null }
    }
  })

  console.log(`📨 RESPONDED/COMPLETED com sentToMLAt: ${respondedWithDate}`)

  // Perguntas RESPONDED/COMPLETED sem sentToMLAt
  const respondedWithoutDate = await prisma.question.count({
    where: {
      mlAccountId: { in: accountIds },
      status: { in: ['RESPONDED', 'COMPLETED'] },
      sentToMLAt: null
    }
  })

  console.log(`⚠️  RESPONDED/COMPLETED SEM sentToMLAt: ${respondedWithoutDate}`)

  if (respondedWithoutDate > 0) {
    const questionsWithoutDate = await prisma.question.findMany({
      where: {
        mlAccountId: { in: accountIds },
        status: { in: ['RESPONDED', 'COMPLETED'] },
        sentToMLAt: null
      },
      select: {
        id: true,
        mlQuestionId: true,
        status: true,
        approvedAt: true,
        answeredAt: true,
        receivedAt: true,
        answer: true,
        aiSuggestion: true
      }
    })

    console.log(`\n🔍 Perguntas RESPONDED sem sentToMLAt (${questionsWithoutDate.length}):`)
    questionsWithoutDate.forEach(q => {
      console.log(`   ID: ${q.id}`)
      console.log(`   ML Question ID: ${q.mlQuestionId}`)
      console.log(`   Status: ${q.status}`)
      console.log(`   Recebida: ${q.receivedAt.toISOString()}`)
      console.log(`   Aprovada: ${q.approvedAt?.toISOString() || 'N/A'}`)
      console.log(`   Tem resposta: ${q.answer || q.aiSuggestion ? 'Sim' : 'Não'}`)
      console.log('')
    })
  }

  await prisma.$disconnect()
}

checkQuestions()
