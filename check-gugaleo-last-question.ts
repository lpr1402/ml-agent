import { prisma } from './lib/prisma'

async function checkLastQuestion() {
  try {
    // Buscar organização GUGALEO
    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { organizationName: { contains: 'GUGALEO', mode: 'insensitive' } },
          { username: { contains: 'gugaleo', mode: 'insensitive' } }
        ]
      }
    })

    if (!org) {
      console.log('❌ Organização GUGALEO não encontrada')
      process.exit(1)
    }

    console.log('✅ Organização encontrada:', org.organizationName || org.username, '(ID:', org.id + ')')

    // Buscar última pergunta (mais recente por receivedAt)
    const lastQuestion = await prisma.question.findFirst({
      where: {
        mlAccount: {
          organizationId: org.id
        }
      },
      orderBy: {
        receivedAt: 'desc'
      },
      include: {
        mlAccount: {
          select: {
            nickname: true,
            mlUserId: true,
            siteId: true
          }
        }
      }
    })

    if (!lastQuestion) {
      console.log('❌ Nenhuma pergunta encontrada para esta organização')
      process.exit(1)
    }

    console.log('')
    console.log('📝 ÚLTIMA PERGUNTA RECEBIDA:')
    console.log('═'.repeat(80))
    console.log('ID:', lastQuestion.id)
    console.log('ML Question ID:', lastQuestion.mlQuestionId)
    console.log('Sequencial:', lastQuestion.sequentialId || 'N/A')
    console.log('Conta ML:', lastQuestion.mlAccount.nickname, '(' + lastQuestion.mlAccount.siteId + ')')
    console.log('Item:', lastQuestion.itemTitle || 'N/A')
    console.log('')
    console.log('Pergunta:', lastQuestion.text.substring(0, 150) + (lastQuestion.text.length > 150 ? '...' : ''))
    console.log('')
    console.log('📅 DATAS:')
    console.log('Recebida em:', lastQuestion.receivedAt.toISOString())
    console.log('Processada IA:', lastQuestion.aiProcessedAt?.toISOString() || 'Não processada')
    console.log('Aprovada em:', lastQuestion.approvedAt?.toISOString() || 'Não aprovada')
    console.log('Enviada ao ML:', lastQuestion.sentToMLAt?.toISOString() || 'Não enviada')
    console.log('Falhou em:', lastQuestion.failedAt?.toISOString() || 'Sem falhas')
    console.log('')
    console.log('📊 STATUS E RESPOSTA:')
    console.log('Status atual:', lastQuestion.status)
    console.log('Tipo aprovação:', lastQuestion.approvalType || 'N/A')
    console.log('Respondida por:', lastQuestion.answeredBy || 'N/A')
    console.log('')
    console.log('Sugestão IA:', lastQuestion.aiSuggestion ? lastQuestion.aiSuggestion.substring(0, 100) + '...' : 'Nenhuma')
    console.log('Resposta final:', lastQuestion.answer ? lastQuestion.answer.substring(0, 100) + '...' : 'Nenhuma')
    console.log('')
    console.log('🎯 CONFIRMAÇÃO MERCADO LIVRE:')
    console.log('ML Answer ID:', lastQuestion.mlAnswerId || '❌ NÃO RECEBIDO')
    console.log('Código resposta ML:', lastQuestion.mlResponseCode || 'N/A')
    console.log('')

    if (lastQuestion.failureReason) {
      console.log('❌ MOTIVO DA FALHA:')
      console.log(lastQuestion.failureReason)
      console.log('')
    }

    if (lastQuestion.mlResponseData) {
      console.log('📦 DADOS DA RESPOSTA ML:')
      console.log(JSON.stringify(lastQuestion.mlResponseData, null, 2))
      console.log('')
    }

    console.log('═'.repeat(80))
    console.log('')

    // Verificação final
    if (lastQuestion.mlAnswerId) {
      console.log('✅ RESPOSTA ENVIADA COM SUCESSO AO MERCADO LIVRE')
      console.log('   Answer ID confirmado:', lastQuestion.mlAnswerId)
    } else if (lastQuestion.status === 'RESPONDED' || lastQuestion.status === 'COMPLETED') {
      console.log('⚠️  STATUS INDICA ENVIADO MAS SEM mlAnswerId')
      console.log('   Pode ter sido enviado mas ID não foi salvo')
    } else if (lastQuestion.status === 'FAILED') {
      console.log('❌ ENVIO FALHOU')
      console.log('   Motivo:', lastQuestion.failureReason || 'Desconhecido')
    } else {
      console.log('⏳ PERGUNTA AINDA NÃO FOI ENVIADA AO ML')
      console.log('   Status atual:', lastQuestion.status)
    }

  } catch (error) {
    console.error('Erro:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkLastQuestion()
