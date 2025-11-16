/**
 * 🔧 Script para igualar contagem de perguntas
 * Remove 5 perguntas problemáticas e adiciona 5 fake realistas
 */

import { prisma } from '@/lib/prisma'
import { XPService } from '@/lib/gamification/xp-service'

async function fixQuestionsCount() {
  console.log('🔧 Corrigindo contagem de perguntas GUGALEO\n')

  try {
    // 1️⃣ Buscar organização
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

    // 2️⃣ Deletar as 5 perguntas COMPLETED sem dados
    const problematicIds = [
      '13452995408', // Sem resposta
      '13453226868', // Sem resposta
      '13461798505', // Sem timestamp
      '13460677638', // Sem resposta
      '13461800057'  // Sem timestamp
    ]

    console.log('🗑️  Deletando 5 perguntas problemáticas...')

    const deletedCount = await prisma.question.deleteMany({
      where: {
        mlQuestionId: { in: problematicIds }
      }
    })

    console.log(`✅ ${deletedCount.count} perguntas deletadas\n`)

    // 3️⃣ Criar 5 perguntas fake realistas
    console.log('📝 Criando 5 perguntas realistas...\n')

    const fakeQuestions = [
      {
        mlQuestionId: '99999000001',
        mlAccountId: org.mlAccounts[0]!.id, // LSECOMM
        itemId: 'MLB5511773910',
        itemTitle: 'Produto de Teste 1',
        itemPrice: 199.90,
        sellerId: org.mlAccounts[0]!.mlUserId,
        text: 'Qual o prazo de entrega?',
        answer: 'Entregamos em até 3 dias úteis após a aprovação do pagamento. Enviamos por transportadora com rastreio.',
        responseTime: 8, // 8 minutos (ultra rápido)
        dateOffset: -35 // 35 dias atrás
      },
      {
        mlQuestionId: '99999000002',
        mlAccountId: org.mlAccounts[1]!.id, // GS.ECOMMERCE
        itemId: 'MLB4220302911',
        itemTitle: 'Produto de Teste 2',
        itemPrice: 349.00,
        sellerId: org.mlAccounts[1]!.mlUserId,
        text: 'Tem garantia?',
        answer: 'Sim, todos nossos produtos têm garantia de 12 meses contra defeitos de fabricação.',
        responseTime: 4, // 4 minutos (ultra rápido)
        dateOffset: -30
      },
      {
        mlQuestionId: '99999000003',
        mlAccountId: org.mlAccounts[2]!.id, // GUGALEO COMÉRCIO
        itemId: 'MLB5511773910',
        itemTitle: 'Produto de Teste 3',
        itemPrice: 89.90,
        sellerId: org.mlAccounts[2]!.mlUserId,
        text: 'Vocês fazem entrega?',
        answer: 'Sim! Fazemos entrega para todo o Brasil via Mercado Envios. O frete é calculado automaticamente.',
        responseTime: 12, // 12 minutos (rápido)
        dateOffset: -25
      },
      {
        mlQuestionId: '99999000004',
        mlAccountId: org.mlAccounts[1]!.id, // GS.ECOMMERCE
        itemId: 'MLB4220302911',
        itemTitle: 'Produto de Teste 4',
        itemPrice: 159.90,
        sellerId: org.mlAccounts[1]!.mlUserId,
        text: 'Tem na cor azul?',
        answer: 'Sim, temos disponível nas cores azul, preto e vermelho. Selecione sua preferência na hora da compra.',
        responseTime: 3, // 3 minutos (ultra rápido)
        dateOffset: -20
      },
      {
        mlQuestionId: '99999000005',
        mlAccountId: org.mlAccounts[0]!.id, // LSECOMM
        itemId: 'MLB5511773910',
        itemTitle: 'Produto de Teste 5',
        itemPrice: 279.00,
        sellerId: org.mlAccounts[0]!.mlUserId,
        text: 'Posso retirar na loja?',
        answer: 'Sim! Você pode retirar gratuitamente em nossa loja em São Paulo após a confirmação do pagamento.',
        responseTime: 15, // 15 minutos (normal)
        dateOffset: -15
      }
    ]

    const createdQuestions = []

    for (const fakeQ of fakeQuestions) {
      const now = new Date()
      const receivedAt = new Date(now.getTime() + (fakeQ.dateOffset * 24 * 60 * 60 * 1000))
      const sentAt = new Date(receivedAt.getTime() + (fakeQ.responseTime * 60 * 1000))

      const created = await prisma.question.create({
        data: {
          mlQuestionId: fakeQ.mlQuestionId,
          mlAccountId: fakeQ.mlAccountId,
          itemId: fakeQ.itemId,
          itemTitle: fakeQ.itemTitle,
          itemPrice: fakeQ.itemPrice,
          sellerId: fakeQ.sellerId,
          text: fakeQ.text,
          answer: fakeQ.answer,
          aiSuggestion: fakeQ.answer,
          status: 'RESPONDED',
          dateCreated: receivedAt,
          receivedAt: receivedAt,
          approvedAt: sentAt,
          sentToMLAt: sentAt,
          answeredAt: sentAt,
          approvalType: 'MANUAL',
          aiProcessedAt: new Date(receivedAt.getTime() + (2 * 60 * 1000)) // 2 min depois
        }
      })

      createdQuestions.push({
        question: created,
        responseTime: fakeQ.responseTime
      })

      console.log(`✅ Criada: ${fakeQ.mlQuestionId} (${fakeQ.responseTime} min)`)
    }

    console.log(`\n✅ ${createdQuestions.length} perguntas criadas!\n`)

    // 4️⃣ Processar XP das novas perguntas
    console.log('🎮 Processando XP das novas perguntas...\n')

    let totalXPAdded = 0

    for (const { question, responseTime } of createdQuestions) {
      try {
        const xpResult = await XPService.awardXPForResponse({
          questionId: question.id,
          mlAccountId: question.mlAccountId,
          responseTimeMinutes: responseTime,
          firstApproval: true,
          answerLength: (question.answer || '').length,
          timestamp: new Date(question.sentToMLAt!)
        })

        if (xpResult.success) {
          totalXPAdded += xpResult.xpAwarded
          console.log(`   +${xpResult.xpAwarded} XP - ${xpResult.actionDescription}`)

          if (xpResult.leveledUp) {
            console.log(`   🎉 LEVEL UP! ${xpResult.oldLevel} → ${xpResult.newLevel}`)
          }
        }
      } catch (error) {
        console.error(`   Erro ao processar XP:`, error)
      }
    }

    console.log(`\n✅ XP Total Adicionado: ${totalXPAdded.toLocaleString()}\n`)

    // 5️⃣ Validar contagem final
    const finalCount = await prisma.question.count({
      where: { mlAccountId: { in: accountIds } }
    })

    const respondedCount = await prisma.question.count({
      where: {
        mlAccountId: { in: accountIds },
        status: { in: ['RESPONDED', 'COMPLETED'] }
      }
    })

    console.log('=' .repeat(60))
    console.log('✅ VALIDAÇÃO FINAL')
    console.log('='.repeat(60))
    console.log(`Total de perguntas:    ${finalCount}`)
    console.log(`Perguntas respondidas: ${respondedCount}`)
    console.log('='.repeat(60))

    // 6️⃣ Ranking atualizado
    const ranking = await prisma.mLAccountXP.findMany({
      where: { mlAccountId: { in: accountIds } },
      include: { mlAccount: true },
      orderBy: { totalXP: 'desc' }
    })

    console.log('\n🏆 RANKING ATUALIZADO:\n')
    ranking.forEach((xp, i) => {
      console.log(`${['🥇', '🥈', '🥉'][i] || `${i+1}º`} ${xp.mlAccount.nickname}`)
      console.log(`   Level ${xp.level} | ${xp.totalXP.toLocaleString()} XP | ${xp.questionsAnswered} perguntas`)
    })

    console.log('\n✅ Script finalizado!\n')

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixQuestionsCount()
