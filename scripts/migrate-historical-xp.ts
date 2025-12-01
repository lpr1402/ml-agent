/**
 * 🎮 SCRIPT DE MIGRAÇÃO DE XP HISTÓRICO
 *
 * Analisa TODAS as perguntas respondidas desde a criação da organização
 * e calcula XP retroativo baseado nas métricas reais de performance
 *
 * Uso: npx tsx scripts/migrate-historical-xp.ts
 */

import { prisma } from '@/lib/prisma'
import { XPService } from '@/lib/gamification/xp-service'
import { logger } from '@/lib/logger'

async function migrateHistoricalXP() {
  console.log('🎮 ========================================================')
  console.log('🎮 MIGRAÇÃO DE XP HISTÓRICO - GUGALEO')
  console.log('🎮 Processando TODA a história desde a criação')
  console.log('🎮 ========================================================\n')

  try {
    // 1️⃣ Buscar organização GUGALEO
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
      return
    }

    console.log(`✅ Organização encontrada: ${organization.organizationName || organization.primaryNickname}`)
    console.log(`📊 Contas ML conectadas: ${organization.mlAccounts.length}`)
    organization.mlAccounts.forEach((acc, i) => {
      console.log(`   ${i + 1}. ${acc.nickname} (ID: ${acc.id})`)
    })
    console.log('')

    // 2️⃣ Buscar TODAS as perguntas respondidas desde sempre
    console.log(`🔍 Buscando TODAS as perguntas respondidas desde a criação da organização...`)

    const questions = await prisma.question.findMany({
      where: {
        mlAccountId: {
          in: organization.mlAccounts.map(acc => acc.id)
        },
        status: {
          in: ['RESPONDED', 'COMPLETED']
        },
        sentToMLAt: {
          not: null
        }
      },
      orderBy: {
        sentToMLAt: 'asc'
      },
      select: {
        id: true,
        mlQuestionId: true,
        mlAccountId: true,
        receivedAt: true,
        approvedAt: true,
        sentToMLAt: true,
        status: true,
        answer: true,
        aiSuggestion: true,
        aiProcessedAt: true,
        approvalType: true
      }
    })

    console.log(`✅ ${questions.length} perguntas encontradas para processar\n`)

    if (questions.length === 0) {
      console.log('⚠️  Nenhuma pergunta para processar. Finalizando.')
      return
    }

    // 3️⃣ Agrupar perguntas por conta
    const questionsByAccount = organization.mlAccounts.map(account => ({
      account,
      questions: questions.filter(q => q.mlAccountId === account.id)
    }))

    console.log('📊 Distribuição por conta:')
    questionsByAccount.forEach(({ account, questions }) => {
      console.log(`   ${account.nickname}: ${questions.length} perguntas`)
    })
    console.log('')

    // 4️⃣ Processar XP para cada conta
    let totalXPAwarded = 0
    let totalAchievementsUnlocked = 0

    for (const { account, questions: accountQuestions } of questionsByAccount) {
      if (accountQuestions.length === 0) continue

      console.log(`\n🎯 Processando conta: ${account.nickname}`)
      console.log(`   ${accountQuestions.length} perguntas para processar`)

      let accountXP = 0
      let processedCount = 0
      let errorCount = 0

      for (const question of accountQuestions) {
        try {
          // Calcular tempo de resposta
          const receivedAt = new Date(question.receivedAt)
          const sentAt = new Date(question.sentToMLAt!)
          const responseTimeMinutes = Math.round((sentAt.getTime() - receivedAt.getTime()) / 60000)

          // Determinar se foi primeira aprovação
          const firstApproval = question.approvalType === 'AUTO' ||
                                question.approvalType === 'MANUAL' ||
                                !question.aiProcessedAt

          // Comprimento da resposta
          const answerLength = (question.answer || question.aiSuggestion || '').length

          // Award XP usando o serviço
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
            processedCount++

            // Log conquistas desbloqueadas
            if (xpResult.achievementsUnlocked.length > 0) {
              totalAchievementsUnlocked += xpResult.achievementsUnlocked.length
              console.log(`   🏆 CONQUISTA: ${xpResult.achievementsUnlocked.map(a => a.title).join(', ')}`)
            }

            // Log level up
            if (xpResult.leveledUp) {
              console.log(`   🎉 LEVEL UP! ${xpResult.oldLevel} → ${xpResult.newLevel}`)
            }

            // Progress bar
            if (processedCount % 50 === 0) {
              console.log(`   ⏳ Progresso: ${processedCount}/${accountQuestions.length}...`)
            }
          }
        } catch (error) {
          errorCount++
          logger.error('[XP Migration] Error processing question', {
            questionId: question.id,
            mlAccountId: account.id,
            error
          })

          // Não parar o script por causa de um erro
          if (errorCount > 10) {
            console.error(`   ❌ Muitos erros (${errorCount}). Pulando conta ${account.nickname}`)
            break
          }
        }
      }

      totalXPAwarded += accountXP

      console.log(`   ✅ Finalizado: ${account.nickname}`)
      console.log(`      XP Ganho: ${accountXP.toLocaleString()}`)
      console.log(`      Perguntas Processadas: ${processedCount}/${accountQuestions.length}`)
      if (errorCount > 0) {
        console.log(`      ⚠️  Erros: ${errorCount}`)
      }
    }

    // 5️⃣ Resumo final
    console.log('\n' + '='.repeat(50))
    console.log('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!')
    console.log('='.repeat(50))
    console.log(`✅ XP Total Atribuído: ${totalXPAwarded.toLocaleString()}`)
    console.log(`🏆 Conquistas Desbloqueadas: ${totalAchievementsUnlocked}`)
    console.log(`📊 Perguntas Processadas: ${questions.length}`)

    // 6️⃣ Mostrar ranking final
    console.log('\n🏆 RANKING FINAL:')

    const finalRanking = await prisma.mLAccountXP.findMany({
      where: {
        mlAccountId: {
          in: organization.mlAccounts.map(acc => acc.id)
        }
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
      console.log(`   Level: ${xp.level}`)
      console.log(`   XP Total: ${xp.totalXP.toLocaleString()}`)
      console.log(`   Perguntas: ${xp.questionsAnswered}`)
      console.log(`   Tempo Médio: ${Math.round(xp.avgResponseTimeMinutes)} min`)
      console.log(`   Ultra Rápidas (< 5min): ${xp.ultraFastCount}`)
      console.log(`   Rápidas (< 30min): ${xp.fastResponsesCount}`)
      console.log(`   Sequência Máxima: ${xp.bestStreak}x`)
      console.log(`   Primeira Aprovação: ${xp.firstApprovalCount}`)
      console.log(`   Conquistas: ${xp.achievements.length}`)

      if (xp.achievements.length > 0) {
        xp.achievements.forEach(ach => {
          console.log(`      🏅 ${ach.title} (+${ach.xpRewarded} XP)`)
        })
      }
    })

    console.log('\n✨ Script finalizado com sucesso!\n')

  } catch (error) {
    console.error('\n❌ Erro durante migração:', error)
    logger.error('[XP Migration] Fatal error', { error })
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar script
migrateHistoricalXP()
  .then(() => {
    console.log('👋 Encerrando...')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error)
    process.exit(1)
  })
