/**
 * 🔧 Script para processar XP das 9 perguntas faltantes
 * Perguntas RESPONDED/COMPLETED mas sem sentToMLAt
 */

import { prisma } from '@/lib/prisma'
import { XPService } from '@/lib/gamification/xp-service'

async function fixMissingXP() {
  console.log('🔧 Processando perguntas faltantes...\n')

  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { organizationName: { contains: 'GUGALEO', mode: 'insensitive' } },
        { primaryNickname: { contains: 'GUGALEO', mode: 'insensitive' } }
      ]
    },
    include: { mlAccounts: true }
  })

  if (!org) return

  // Buscar perguntas RESPONDED/COMPLETED sem sentToMLAt OU APPROVED
  const missingQuestions = await prisma.question.findMany({
    where: {
      mlAccountId: { in: org.mlAccounts.map(a => a.id) },
      AND: [
        {
          OR: [
            {
              status: { in: ['RESPONDED', 'COMPLETED'] },
              sentToMLAt: null
            },
            {
              status: 'APPROVED'
            }
          ]
        },
        {
          OR: [
            { answer: { not: null } },
            { aiSuggestion: { not: null } }
          ]
        }
      ]
    },
    orderBy: {
      receivedAt: 'asc'
    }
  })

  console.log(`Encontradas ${missingQuestions.length} perguntas para processar\n`)

  let totalXP = 0

  for (const question of missingQuestions) {
    try {
      const receivedAt = new Date(question.receivedAt)
      const processedAt = question.approvedAt || question.answeredAt || question.updatedAt
      const responseTimeMinutes = Math.round((processedAt.getTime() - receivedAt.getTime()) / 60000)

      const answerLength = (question.answer || question.aiSuggestion || '').length
      const firstApproval = question.approvalType === 'AUTO' || question.approvalType === 'MANUAL'

      const xpResult = await XPService.awardXPForResponse({
        questionId: question.id,
        mlAccountId: question.mlAccountId,
        responseTimeMinutes,
        firstApproval,
        answerLength,
        timestamp: processedAt
      })

      if (xpResult.success) {
        totalXP += xpResult.xpAwarded
        console.log(`✅ ${question.mlQuestionId}: +${xpResult.xpAwarded} XP (${responseTimeMinutes} min)`)

        if (xpResult.leveledUp) {
          console.log(`   🎉 LEVEL UP! ${xpResult.oldLevel} → ${xpResult.newLevel}`)
        }

        if (xpResult.achievementsUnlocked.length > 0) {
          console.log(`   🏆 ${xpResult.achievementsUnlocked.map(a => a.title).join(', ')}`)
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao processar ${question.mlQuestionId}:`, error)
    }
  }

  console.log(`\n✅ XP Total Adicionado: ${totalXP.toLocaleString()}`)
  console.log(`📊 Perguntas Processadas: ${missingQuestions.length}`)

  await prisma.$disconnect()
}

fixMissingXP()
