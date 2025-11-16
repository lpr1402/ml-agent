/**
 * 🎮 RECÁLCULO COMPLETO DE XP - GUGALEO
 *
 * 1. Apaga todos os dados de XP da organização
 * 2. Recalcula XP de TODAS as perguntas respondidas desde o início
 * 3. Processa em ordem cronológica correta
 *
 * Uso: npx tsx scripts/recalculate-xp-gugaleo.ts
 */

import { prisma } from '@/lib/prisma'
import { XPService } from '@/lib/gamification/xp-service'

async function recalculateXP() {
  console.log('🎮 ================================================================')
  console.log('🎮 RECÁLCULO COMPLETO DE XP - GUGALEO')
  console.log('🎮 Limpando dados antigos e recalculando desde o início')
  console.log('🎮 ================================================================\n')

  try {
    // 🔍 PASSO 1: Buscar organização GUGALEO
    console.log('📋 Buscando organização GUGALEO...')

    const organization = await prisma.organization.findFirst({
      where: {
        OR: [
          { organizationName: { contains: 'GUGALEO', mode: 'insensitive' } },
          { primaryNickname: { contains: 'GUGALEO', mode: 'insensitive' } }
        ]
      },
      include: {
        mlAccounts: true
      }
    })

    if (!organization) {
      console.error('❌ Organização GUGALEO não encontrada!')
      process.exit(1)
    }

    console.log(`✅ Organização: ${organization.organizationName || organization.primaryNickname}`)
    console.log(`📊 Contas ML: ${organization.mlAccounts.length}`)
    organization.mlAccounts.forEach((acc, i) => {
      console.log(`   ${i + 1}. ${acc.nickname}`)
    })

    const accountIds = organization.mlAccounts.map(a => a.id)

    // 🗑️ PASSO 2: LIMPAR TODOS OS DADOS DE XP
    console.log('\n🗑️  Limpando dados de XP antigos...')

    // Deletar achievements
    const deletedAchievements = await prisma.achievement.deleteMany({
      where: { mlAccountId: { in: accountIds } }
    })
    console.log(`   ✅ ${deletedAchievements.count} achievements deletados`)

    // Deletar atividades de XP
    const deletedActivities = await prisma.xPActivity.deleteMany({
      where: { mlAccountId: { in: accountIds } }
    })
    console.log(`   ✅ ${deletedActivities.count} atividades de XP deletadas`)

    // Deletar tracking de XP
    const deletedTracking = await prisma.mLAccountXP.deleteMany({
      where: { mlAccountId: { in: accountIds } }
    })
    console.log(`   ✅ ${deletedTracking.count} registros de XP tracking deletados`)

    console.log('\n✨ Limpeza concluída! Banco zerado para recálculo.\n')

    // 🔍 PASSO 3: Buscar TODAS as perguntas respondidas
    console.log('🔍 Buscando TODAS as perguntas respondidas desde o início...')

    const allQuestions = await prisma.question.findMany({
      where: {
        mlAccountId: { in: accountIds },
        status: { in: ['RESPONDED', 'COMPLETED', 'APPROVED'] },
        OR: [
          { sentToMLAt: { not: null } },
          { approvedAt: { not: null } },
          { answeredAt: { not: null } }
        ]
      },
      orderBy: [
        {
          sentToMLAt: 'asc'
        },
        {
          approvedAt: 'asc'
        },
        {
          receivedAt: 'asc'
        }
      ],
      select: {
        id: true,
        mlQuestionId: true,
        mlAccountId: true,
        receivedAt: true,
        approvedAt: true,
        sentToMLAt: true,
        answeredAt: true,
        updatedAt: true,
        status: true,
        answer: true,
        aiSuggestion: true,
        approvalType: true
      }
    })

    console.log(`✅ ${allQuestions.length} perguntas encontradas\n`)

    // 📊 PASSO 4: Agrupar por conta
    const questionsByAccount = organization.mlAccounts.map(account => ({
      account,
      questions: allQuestions.filter(q => q.mlAccountId === account.id)
    }))

    console.log('📊 Distribuição:')
    questionsByAccount.forEach(({ account, questions }) => {
      console.log(`   ${account.nickname}: ${questions.length} perguntas`)
    })

    // 🎯 PASSO 5: Processar cada conta em ordem cronológica
    console.log('\n🎯 Processando XP...\n')

    let grandTotalXP = 0
    let grandTotalAchievements = 0

    for (const { account, questions: accountQuestions } of questionsByAccount) {
      if (accountQuestions.length === 0) {
        console.log(`⏭️  ${account.nickname}: Sem perguntas, pulando...\n`)
        continue
      }

      console.log(`\n${'='.repeat(60)}`)
      console.log(`🎯 ${account.nickname}`)
      console.log(`${'='.repeat(60)}`)
      console.log(`📊 ${accountQuestions.length} perguntas para processar\n`)

      let accountXP = 0
      let levelUps = 0
      let achievementsUnlocked = 0

      for (const question of accountQuestions) {
        try {
          // Determinar timestamp correto (priorizar sentToMLAt)
          const processedTimestamp = question.sentToMLAt ||
                                    question.approvedAt ||
                                    question.answeredAt ||
                                    question.updatedAt

          const receivedAt = new Date(question.receivedAt)
          const sentAt = new Date(processedTimestamp)

          // Calcular tempo de resposta
          const responseTimeMinutes = Math.max(
            0,
            Math.round((sentAt.getTime() - receivedAt.getTime()) / 60000)
          )

          // Determinar primeira aprovação
          const firstApproval = question.approvalType === 'AUTO' ||
                                question.approvalType === 'MANUAL' ||
                                !question.approvalType

          // Comprimento da resposta
          const answerLength = (question.answer || question.aiSuggestion || '').length

          // ⚡ Award XP
          const xpResult = await XPService.awardXPForResponse({
            questionId: question.id,
            mlAccountId: account.id,
            responseTimeMinutes,
            firstApproval,
            answerLength,
            timestamp: sentAt
          })

          if (xpResult.success) {
            accountXP += xpResult.xpAwarded

            // Log level ups
            if (xpResult.leveledUp) {
              levelUps++
              console.log(`   🎉 LEVEL UP! ${xpResult.oldLevel} → ${xpResult.newLevel} (${accountXP.toLocaleString()} XP)`)
            }

            // Log achievements
            if (xpResult.achievementsUnlocked.length > 0) {
              achievementsUnlocked += xpResult.achievementsUnlocked.length
              grandTotalAchievements += xpResult.achievementsUnlocked.length
              xpResult.achievementsUnlocked.forEach(ach => {
                console.log(`   🏆 CONQUISTA: ${ach.title} (+${ach.xpReward} XP)`)
              })
            }
          }

        } catch (error) {
          console.error(`   ❌ Erro em ${question.mlQuestionId}:`, error)
        }
      }

      grandTotalXP += accountXP

      // Resumo da conta
      console.log(`\n📊 RESUMO ${account.nickname}:`)
      console.log(`   XP Total: ${accountXP.toLocaleString()}`)
      console.log(`   Level Ups: ${levelUps}`)
      console.log(`   Conquistas: ${achievementsUnlocked}`)
      console.log(`   Perguntas: ${accountQuestions.length}`)
    }

    // 📊 PASSO 6: Mostrar ranking final
    console.log('\n\n' + '='.repeat(70))
    console.log('🏆 RANKING FINAL - GUGALEO')
    console.log('='.repeat(70))

    const finalRanking = await prisma.mLAccountXP.findMany({
      where: {
        mlAccountId: { in: accountIds }
      },
      include: {
        mlAccount: true,
        achievements: true
      },
      orderBy: {
        totalXP: 'desc'
      }
    })

    finalRanking.forEach((xp, index) => {
      const medals = ['🥇', '🥈', '🥉']
      const medal = medals[index] || `${index + 1}º`

      console.log(`\n${medal} ${xp.mlAccount.nickname}`)
      console.log(`${'─'.repeat(50)}`)
      console.log(`   Nível:                ${xp.level}`)
      console.log(`   XP Total:             ${xp.totalXP.toLocaleString()}`)
      console.log(`   Perguntas:            ${xp.questionsAnswered}`)
      console.log(`   Tempo Médio:          ${Math.round(xp.avgResponseTimeMinutes)} min`)
      console.log(`   Ultra Rápidas (<5):   ${xp.ultraFastCount}`)
      console.log(`   Rápidas (<30):        ${xp.fastResponsesCount}`)
      console.log(`   Normais (<60):        ${xp.normalResponsesCount}`)
      console.log(`   Sequência Máxima:     ${xp.longestStreak}x`)
      console.log(`   Primeira Aprovação:   ${xp.firstApprovalCount}`)
      console.log(`   Com Revisão:          ${xp.revisionCount}`)
      console.log(`   Madrugador:           ${xp.earlyBirdCount}`)
      console.log(`   Fim de Semana:        ${xp.weekendCount}`)
      console.log(`   Conquistas:           ${xp.achievements.length}`)

      if (xp.achievements.length > 0) {
        console.log(`   ╰─ Desbloqueadas:`)
        xp.achievements.forEach(ach => {
          console.log(`      🏅 ${ach.title} (+${ach.xpRewarded} XP)`)
        })
      }
    })

    // Total da organização
    const orgTotalXP = finalRanking.reduce((sum, acc) => sum + acc.totalXP, 0)

    console.log(`\n\n${'='.repeat(70)}`)
    console.log('✨ RESUMO GERAL GUGALEO')
    console.log('='.repeat(70))
    console.log(`XP Total da Organização:   ${orgTotalXP.toLocaleString()}`)
    console.log(`Conquistas Totais:         ${grandTotalAchievements}`)
    console.log(`Perguntas Processadas:     ${allQuestions.length}`)
    console.log('='.repeat(70))

    console.log('\n✅ Recálculo concluído com sucesso!\n')

  } catch (error) {
    console.error('\n❌ Erro durante recálculo:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar
recalculateXP()
  .then(() => {
    console.log('👋 Script finalizado.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error)
    process.exit(1)
  })
