/**
 * Script de Limpeza de Perguntas com Erro - GUGALEO
 *
 * Este script verifica perguntas com status FAILED/ERROR e sincroniza
 * com o estado real no Mercado Livre, detectando respostas manuais.
 *
 * Uso:
 *   npx tsx scripts/cleanup-gugaleo-errors.ts
 *
 * Novembro 2025 - Best Practices
 */

import { PrismaClient } from '@prisma/client';
import { getValidMLToken } from '@/lib/ml-api/token-manager';
import { globalMLRateLimiter } from '@/lib/ml-api/global-rate-limiter';

const prisma = new PrismaClient();

interface ReconcileResult {
  questionId: string;
  mlQuestionId: string;
  oldStatus: string;
  newStatus: string;
  action: 'COMPLETED_EXTERNAL' | 'COMPLETED_DELETED' | 'STILL_UNANSWERED' | 'ERROR';
  details?: string;
  answer?: string;
}

interface CleanupStats {
  total: number;
  completedExternal: number;
  completedDeleted: number;
  stillUnanswered: number;
  errors: number;
  results: ReconcileResult[];
}

/**
 * Busca detalhes da pergunta no ML API
 */
async function fetchMLQuestionDetails(
  mlQuestionId: string,
  accessToken: string
): Promise<any> {
  const url = `https://api.mercadolibre.com/questions/${mlQuestionId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { deleted: true, status: 'NOT_FOUND' };
    }
    throw new Error(`ML API error ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

/**
 * Reconcilia uma única pergunta com o estado do ML
 */
async function reconcileQuestion(
  question: any,
  mlAccount: any
): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    questionId: question.id,
    mlQuestionId: question.mlQuestionId,
    oldStatus: question.status,
    newStatus: question.status,
    action: 'ERROR',
  };

  try {
    console.log(`\n🔍 Verificando: ${question.mlQuestionId}`);
    console.log(`   Status atual: ${question.status}`);
    console.log(`   Criada em: ${question.createdAt.toISOString()}`);
    console.log(`   Motivo falha: ${question.failureReason || 'N/A'}`);

    // Obter token válido
    const accessToken = await getValidMLToken(mlAccount.id);
    if (!accessToken) {
      throw new Error('Token inválido ou expirado');
    }

    // Buscar dados no ML com rate limiting
    const mlData = await globalMLRateLimiter.executeRequest({
      mlAccountId: mlAccount.id,
      organizationId: mlAccount.organizationId,
      endpoint: `/questions/${question.mlQuestionId}`,
      requestFn: async () => fetchMLQuestionDetails(question.mlQuestionId, accessToken),
      priority: 'low', // Priority baixa - não urgente
      maxRetries: 2,
    });

    // Caso 1: Pergunta foi deletada no ML
    if (mlData.deleted || mlData.status === 'NOT_FOUND') {
      console.log(`   ❌ Pergunta deletada no ML`);

      await prisma.question.update({
        where: { id: question.id },
        data: {
          status: 'COMPLETED',
          answeredBy: 'DELETED',
          updatedAt: new Date(),
        },
      });

      result.newStatus = 'COMPLETED';
      result.action = 'COMPLETED_DELETED';
      result.details = 'Pergunta deletada no Mercado Livre';
      return result;
    }

    // Caso 2: Pergunta foi respondida (manualmente ou por outro sistema)
    if (mlData.answer) {
      console.log(`   ✅ Resposta encontrada no ML!`);
      console.log(`   Respondida em: ${mlData.answer.date_created}`);
      console.log(`   Resposta: ${mlData.answer.text.substring(0, 100)}...`);

      await prisma.question.update({
        where: { id: question.id },
        data: {
          status: 'COMPLETED',
          answer: mlData.answer.text,
          answeredAt: new Date(mlData.answer.date_created),
          answeredBy: 'EXTERNAL',
          updatedAt: new Date(),
        },
      });

      result.newStatus = 'COMPLETED';
      result.action = 'COMPLETED_EXTERNAL';
      result.details = 'Resposta manual detectada';
      result.answer = mlData.answer.text.substring(0, 100);
      return result;
    }

    // Caso 3: Ainda sem resposta
    console.log(`   ⏳ Ainda sem resposta no ML`);
    console.log(`   Status ML: ${mlData.status}`);

    result.action = 'STILL_UNANSWERED';
    result.details = `Status ML: ${mlData.status} - Aguardando resposta`;
    return result;

  } catch (error: any) {
    console.log(`   ⚠️ Erro ao verificar: ${error.message}`);

    result.action = 'ERROR';
    result.details = error.message;
    return result;
  }
}

/**
 * Executa limpeza completa para organização GUGALEO
 */
async function cleanupGugaleoErrors(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    total: 0,
    completedExternal: 0,
    completedDeleted: 0,
    stillUnanswered: 0,
    errors: 0,
    results: [],
  };

  console.log('========================================');
  console.log('🧹 CLEANUP: Perguntas com Erro - GUGALEO');
  console.log('========================================\n');

  // Buscar organização GUGALEO
  const gugaleoOrg = await prisma.organization.findFirst({
    where: {
      OR: [
        { organizationName: { contains: 'GUGALEO', mode: 'insensitive' } },
        { username: { contains: 'gugaleo', mode: 'insensitive' } },
      ],
    },
    include: {
      mlAccounts: {
        where: { isActive: true },
        include: {
          questions: {
            where: {
              status: { in: ['FAILED', 'ERROR', 'TOKEN_ERROR'] },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (!gugaleoOrg) {
    console.log('❌ Organização GUGALEO não encontrada');
    return stats;
  }

  console.log(`✅ Organização encontrada: ${gugaleoOrg.organizationName || gugaleoOrg.username}`);
  console.log(`   ID: ${gugaleoOrg.id}`);
  console.log(`   Contas ML: ${gugaleoOrg.mlAccounts.length}\n`);

  // Processar cada conta
  for (const mlAccount of gugaleoOrg.mlAccounts) {
    const errorQuestions = mlAccount.questions;

    if (errorQuestions.length === 0) {
      console.log(`✓ ${mlAccount.nickname}: Sem perguntas com erro\n`);
      continue;
    }

    console.log(`\n📋 Conta: ${mlAccount.nickname}`);
    console.log(`   ML User ID: ${mlAccount.mlUserId}`);
    console.log(`   Perguntas com erro: ${errorQuestions.length}`);

    // Processar cada pergunta
    for (const question of errorQuestions) {
      stats.total++;

      const result = await reconcileQuestion(question, mlAccount);
      stats.results.push(result);

      // Atualizar estatísticas
      switch (result.action) {
        case 'COMPLETED_EXTERNAL':
          stats.completedExternal++;
          break;
        case 'COMPLETED_DELETED':
          stats.completedDeleted++;
          break;
        case 'STILL_UNANSWERED':
          stats.stillUnanswered++;
          break;
        case 'ERROR':
          stats.errors++;
          break;
      }

      // Small delay para respeitar rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return stats;
}

/**
 * Exibe relatório final
 */
function printReport(stats: CleanupStats) {
  console.log('\n========================================');
  console.log('📊 RELATÓRIO FINAL');
  console.log('========================================\n');

  console.log(`Total de perguntas analisadas: ${stats.total}`);
  console.log(`✅ Completadas (resposta externa): ${stats.completedExternal}`);
  console.log(`🗑️  Completadas (deletadas): ${stats.completedDeleted}`);
  console.log(`⏳ Ainda sem resposta: ${stats.stillUnanswered}`);
  console.log(`❌ Erros: ${stats.errors}\n`);

  if (stats.results.length > 0) {
    console.log('📋 Detalhes:\n');

    for (const result of stats.results) {
      const icon =
        result.action === 'COMPLETED_EXTERNAL'
          ? '✅'
          : result.action === 'COMPLETED_DELETED'
          ? '🗑️'
          : result.action === 'STILL_UNANSWERED'
          ? '⏳'
          : '❌';

      console.log(`${icon} ${result.mlQuestionId}`);
      console.log(`   ${result.oldStatus} → ${result.newStatus}`);
      console.log(`   ${result.details}`);
      if (result.answer) {
        console.log(`   Resposta: ${result.answer}...`);
      }
      console.log('');
    }
  }

  console.log('========================================');
  console.log('✅ Limpeza concluída!');
  console.log('========================================\n');
}

/**
 * Main execution
 */
async function main() {
  try {
    const stats = await cleanupGugaleoErrors();
    printReport(stats);

    // Exit com código baseado em resultados
    if (stats.errors > 0) {
      console.log('⚠️  Alguns erros ocorreram durante o processo');
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute
main();
