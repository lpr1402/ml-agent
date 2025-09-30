/**
 * Script para corrigir status incorretos de perguntas no banco
 *
 * Regras de status:
 * - PROCESSING: apenas se NÃO tem aiSuggestion
 * - AWAITING_APPROVAL: quando tem aiSuggestion
 * - REVISING: quando está sendo revisado (não PROCESSING)
 * - RESPONDED/COMPLETED: quando já foi enviado ao ML
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixQuestionStatuses() {
  console.log('🔧 Starting status correction...')

  // 1. Corrigir perguntas com aiSuggestion mas status PROCESSING
  const fixedWithAISuggestion = await prisma.question.updateMany({
    where: {
      aiSuggestion: { not: null },
      status: 'PROCESSING'
    },
    data: {
      status: 'AWAITING_APPROVAL'
    }
  })
  console.log(`✅ Fixed ${fixedWithAISuggestion.count} questions with AI suggestion but PROCESSING status`)

  // 2. Corrigir perguntas com answer mas status incorreto
  const fixedWithAnswer = await prisma.question.updateMany({
    where: {
      answer: { not: null },
      status: { in: ['PROCESSING', 'AWAITING_APPROVAL', 'REVISING'] }
    },
    data: {
      status: 'RESPONDED'
    }
  })
  console.log(`✅ Fixed ${fixedWithAnswer.count} questions with final answer but incorrect status`)

  // 3. Listar perguntas atuais para verificação
  const currentQuestions = await prisma.question.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
      }
    },
    select: {
      id: true,
      mlQuestionId: true,
      status: true,
      aiSuggestion: true,
      answer: true,
      receivedAt: true
    },
    orderBy: { receivedAt: 'desc' },
    take: 10
  })

  console.log('\n📊 Current question status (last 10):')
  currentQuestions.forEach(q => {
    const hasAI = !!q.aiSuggestion
    const hasAnswer = !!q.answer
    const statusOk = (
      (q.status === 'PROCESSING' && !hasAI && !hasAnswer) ||
      (q.status === 'AWAITING_APPROVAL' && hasAI && !hasAnswer) ||
      (q.status === 'REVISING' && hasAI) ||
      (['RESPONDED', 'COMPLETED'].includes(q.status) && hasAnswer) ||
      (['FAILED', 'ERROR', 'TOKEN_ERROR'].includes(q.status))
    )

    console.log({
      id: q.id.slice(0, 8),
      mlQuestionId: q.mlQuestionId,
      status: q.status,
      hasAISuggestion: hasAI,
      hasAnswer: hasAnswer,
      statusCorrect: statusOk ? '✅' : '❌'
    })
  })

  // 4. Estatísticas finais
  const stats = await prisma.question.groupBy({
    by: ['status'],
    _count: true
  })

  console.log('\n📈 Status distribution:')
  stats.forEach(s => {
    console.log(`  ${s.status}: ${s._count} questions`)
  })

  await prisma.$disconnect()
  console.log('\n✅ Status correction completed!')
}

// Executar
fixQuestionStatuses().catch(console.error)