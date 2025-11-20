import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeProductionMetrics() {
  try {
    console.log('📊 ANÁLISE DE PRODUÇÃO - ML AGENT (desde 01/10/2025)\n');
    console.log('='.repeat(80));

    // 1. Total de perguntas recebidas
    const totalQuestions = await prisma.question.count({
      where: {
        receivedAt: {
          gte: new Date('2025-10-01')
        }
      }
    });

    // 2. Perguntas por status
    const questionsByStatus = await prisma.question.groupBy({
      by: ['status'],
      _count: true,
      where: {
        receivedAt: {
          gte: new Date('2025-10-01')
        }
      }
    });

    // 3. Perguntas respondidas
    const answeredQuestions = await prisma.question.count({
      where: {
        receivedAt: {
          gte: new Date('2025-10-01')
        },
        answeredAt: {
          not: null
        }
      }
    });

    // 4. Perguntas respondidas por tipo
    const answersByType = await prisma.question.groupBy({
      by: ['answeredBy'],
      _count: true,
      where: {
        receivedAt: {
          gte: new Date('2025-10-01')
        },
        answeredAt: {
          not: null
        }
      }
    });

    // 5. Tempo médio de resposta
    const avgResponseTime = await prisma.$queryRaw<[{avg: number}]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("answeredAt" - "receivedAt"))) as avg
      FROM "Question"
      WHERE "receivedAt" >= '2025-10-01'
      AND "answeredAt" IS NOT NULL
    `;

    // 6. Perguntas com erro
    const failedQuestions = await prisma.question.count({
      where: {
        receivedAt: {
          gte: new Date('2025-10-01')
        },
        failedAt: {
          not: null
        }
      }
    });

    // 7. Webhooks processados
    const webhooksProcessed = await prisma.webhookEvent.count({
      where: {
        createdAt: {
          gte: new Date('2025-10-01')
        }
      }
    });

    // 8. Organizações ativas
    const activeOrgs = await prisma.organization.count({
      where: {
        createdAt: {
          lte: new Date('2025-11-17')
        }
      }
    });

    // 9. Contas ML conectadas
    const mlAccounts = await prisma.mLAccount.count({
      where: {
        isActive: true
      }
    });

    // 10. Taxa de sucesso
    const successRate = totalQuestions > 0 ? ((answeredQuestions / totalQuestions) * 100).toFixed(2) : '0';
    const errorRate = totalQuestions > 0 ? ((failedQuestions / totalQuestions) * 100).toFixed(2) : '0';

    // 11. Conversões (se existirem)
    const conversions = await prisma.orderConversion.count({
      where: {
        createdAt: {
          gte: new Date('2025-10-01')
        }
      }
    });

    // Print Results
    console.log('\n📈 MÉTRICAS GERAIS:');
    console.log(`   Total de Perguntas Recebidas: ${totalQuestions}`);
    console.log(`   Perguntas Respondidas: ${answeredQuestions} (${successRate}%)`);
    console.log(`   Perguntas com Falha: ${failedQuestions} (${errorRate}%)`);
    console.log(`   Webhooks Processados: ${webhooksProcessed}`);
    console.log(`   Organizações Ativas: ${activeOrgs}`);
    console.log(`   Contas ML Conectadas: ${mlAccounts}`);
    console.log(`   Conversões Rastreadas: ${conversions}`);

    console.log('\n📊 PERGUNTAS POR STATUS:');
    questionsByStatus.forEach(stat => {
      console.log(`   ${stat.status}: ${stat._count}`);
    });

    console.log('\n🤖 RESPOSTAS POR TIPO:');
    answersByType.forEach(stat => {
      const type = stat.answeredBy || 'NULL';
      console.log(`   ${type}: ${stat._count}`);
    });

    if (avgResponseTime && avgResponseTime[0] && avgResponseTime[0].avg) {
      const avgSeconds = Math.round(avgResponseTime[0].avg);
      const avgMinutes = Math.floor(avgSeconds / 60);
      const remainingSeconds = avgSeconds % 60;
      console.log(`\n⚡ TEMPO MÉDIO DE RESPOSTA: ${avgMinutes}m ${remainingSeconds}s`);
    }

    // Performance diária (últimos 7 dias)
    console.log('\n📅 PERFORMANCE ÚLTIMOS 7 DIAS:');
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dailyCount = await prisma.question.count({
        where: {
          receivedAt: {
            gte: date,
            lt: nextDate
          }
        }
      });

      const dailyAnswered = await prisma.question.count({
        where: {
          receivedAt: {
            gte: date,
            lt: nextDate
          },
          answeredAt: {
            not: null
          }
        }
      });

      const dailyRate = dailyCount > 0 ? ((dailyAnswered / dailyCount) * 100).toFixed(0) : '0';
      console.log(`   ${date.toISOString().split('T')[0]}: ${dailyCount} perguntas (${dailyAnswered} respondidas - ${dailyRate}%)`);
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Erro na análise:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeProductionMetrics();
