/**
 * 🔍 ANÁLISE DE DISCREPÂNCIA DE PERGUNTAS
 * Investigar diferença entre 127 (Central) e 122 (Ranking)
 */

import { prisma } from '@/lib/prisma'

async function analyzeDiscrepancy() {
  console.log('🔍 ANÁLISE DE DISCREPÂNCIA DE PERGUNTAS GUGALEO\n')

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

  const accountIds = org.mlAccounts.map(a => a.id)

  // Total de perguntas
  const totalQuestions = await prisma.question.count({
    where: { mlAccountId: { in: accountIds } }
  })

  console.log(`✅ TOTAL DE PERGUNTAS: ${totalQuestions}`)
  console.log('')

  // Por status
  const byStatus = await prisma.question.groupBy({
    by: ['status'],
    where: { mlAccountId: { in: accountIds } },
    _count: true
  })

  console.log('📊 POR STATUS:')
  byStatus.forEach(s => {
    console.log(`   ${s.status.padEnd(20)} ${s._count}`)
  })

  // RESPONDED/COMPLETED que deveriam ter XP
  const shouldHaveXP = await prisma.question.findMany({
    where: {
      mlAccountId: { in: accountIds },
      status: { in: ['RESPONDED', 'COMPLETED', 'APPROVED'] }
    },
    select: {
      id: true,
      mlQuestionId: true,
      status: true,
      sentToMLAt: true,
      approvedAt: true,
      answeredAt: true,
      answer: true,
      aiSuggestion: true
    }
  })

  console.log(`\n✅ Perguntas que DEVERIAM ter XP: ${shouldHaveXP.length}`)

  // Analisar quais podem ser processadas
  const processable = shouldHaveXP.filter(q =>
    (q.answer || q.aiSuggestion) &&
    (q.sentToMLAt || q.approvedAt || q.answeredAt)
  )

  const notProcessable = shouldHaveXP.filter(q =>
    !(q.answer || q.aiSuggestion) ||
    !(q.sentToMLAt || q.approvedAt || q.answeredAt)
  )

  console.log(`   ✅ Processáveis (tem resposta + timestamp): ${processable.length}`)
  console.log(`   ⚠️  NÃO processáveis (sem dados): ${notProcessable.length}`)

  if (notProcessable.length > 0) {
    console.log(`\n⚠️  PERGUNTAS NÃO PROCESSÁVEIS (${notProcessable.length}):`)
    notProcessable.forEach(q => {
      console.log(`   ${q.mlQuestionId} - Status: ${q.status}`)
      console.log(`      Tem resposta: ${q.answer || q.aiSuggestion ? 'Sim' : 'NÃO'}`)
      console.log(`      Tem timestamp: ${q.sentToMLAt || q.approvedAt || q.answeredAt ? 'Sim' : 'NÃO'}`)
    })
  }

  // Verificar XP tracking atual
  console.log(`\n📊 XP TRACKING ATUAL:`)
  const xpTracking = await prisma.mLAccountXP.findMany({
    where: { mlAccountId: { in: accountIds } },
    include: { mlAccount: true }
  })

  xpTracking.forEach(xp => {
    console.log(`   ${xp.mlAccount.nickname}: ${xp.questionsAnswered} perguntas registradas`)
  })

  const totalInXP = xpTracking.reduce((sum, xp) => sum + xp.questionsAnswered, 0)
  console.log(`   TOTAL no XP: ${totalInXP}`)
  console.log(`   TOTAL processáveis: ${processable.length}`)
  console.log(`   DIFERENÇA: ${processable.length - totalInXP}`)

  await prisma.$disconnect()
}

analyzeDiscrepancy()
