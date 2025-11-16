/**
 * Question Sync Service - Sistema de Reconciliação Inteligente
 *
 * Responsável por sincronizar perguntas com status de erro com o
 * estado real no Mercado Livre, detectando respostas manuais.
 *
 * Features:
 * - Detecção automática de respostas manuais
 * - Rate limiting inteligente
 * - Suporte para múltiplas contas ML
 * - Métricas e observabilidade
 *
 * Novembro 2025 - Production Grade
 */

import { PrismaClient } from '@prisma/client';
import { getValidMLToken } from '@/lib/ml-api/token-manager';
import { globalMLRateLimiter } from '@/lib/ml-api/global-rate-limiter';
import { logger } from '@/lib/logger';
import { emitQuestionUpdate } from '@/lib/websocket/emit-events';
import {
  ReconciliationResult,
  ReconciliationStats,
  ReconciliationConfig,
  MLQuestionResponse,
  DEFAULT_RECONCILIATION_CONFIG,
  EligibilityResult,
  EligibilityCriteria,
  ReconcileOrganizationRequest,
  ReconcileAccountRequest,
  ReconciliationResponse,
} from './types';

const prisma = new PrismaClient();

// ==================== CONFIGURATION ====================

let config: ReconciliationConfig = { ...DEFAULT_RECONCILIATION_CONFIG };

/**
 * Atualiza configuração do serviço
 */
export function setReconciliationConfig(newConfig: Partial<ReconciliationConfig>) {
  config = { ...config, ...newConfig };
  logger.info('[ReconciliationService] Configuration updated', newConfig);
}

/**
 * Obtém configuração atual
 */
export function getReconciliationConfig(): ReconciliationConfig {
  return { ...config };
}

// ==================== ML API INTEGRATION ====================

/**
 * Busca detalhes da pergunta no ML API
 */
async function fetchMLQuestionDetails(
  mlQuestionId: string,
  accessToken: string
): Promise<MLQuestionResponse> {
  const url = `https://api.mercadolibre.com/questions/${mlQuestionId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return {
        id: parseInt(mlQuestionId),
        date_created: new Date().toISOString(),
        item_id: 'UNKNOWN',
        seller_id: 0,
        status: 'DELETED',
        text: 'Deleted question',
        deleted: true,
      };
    }
    throw new Error(`ML API error ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

// ==================== ELIGIBILITY CHECKS ====================

/**
 * Verifica se uma pergunta é elegível para reconciliação
 */
async function checkQuestionEligibility(
  question: any,
  force: boolean = false
): Promise<EligibilityResult> {
  const criteria: EligibilityCriteria = {
    hasEligibleStatus: config.eligibleStatuses.includes(question.status),
    meetsMinAge: false,
    notRecentlyChecked: true,
    accountIsActive: question.mlAccount?.isActive ?? true,
    hasValidToken: false,
    isEligible: false,
  };

  // Check status
  if (!criteria.hasEligibleStatus) {
    return {
      questionId: question.id,
      eligible: false,
      criteria: { ...criteria, reason: `Status ${question.status} not eligible` },
    };
  }

  // Check age (skip if forced)
  const questionAge = Date.now() - new Date(question.createdAt).getTime();
  criteria.meetsMinAge = force || questionAge >= config.minQuestionAgeMs;

  if (!criteria.meetsMinAge) {
    const waitTime = config.minQuestionAgeMs - questionAge;
    return {
      questionId: question.id,
      eligible: false,
      criteria: { ...criteria, reason: 'Question too recent' },
      estimatedWaitTime: waitTime,
    };
  }

  // Check if account is active
  if (!criteria.accountIsActive) {
    return {
      questionId: question.id,
      eligible: false,
      criteria: { ...criteria, reason: 'ML Account is inactive' },
    };
  }

  // Check if token is valid
  try {
    const token = await getValidMLToken(question.mlAccountId);
    criteria.hasValidToken = !!token;
  } catch (_error) {
    criteria.hasValidToken = false;
    return {
      questionId: question.id,
      eligible: false,
      criteria: { ...criteria, reason: 'Token validation failed' },
    };
  }

  // All checks passed
  criteria.isEligible = true;
  return {
    questionId: question.id,
    eligible: true,
    criteria,
  };
}

// ==================== RECONCILIATION LOGIC ====================

/**
 * Reconcilia uma única pergunta com o estado do ML
 */
export async function reconcileQuestion(
  questionId: string,
  force: boolean = false
): Promise<ReconciliationResult> {
  const startTime = Date.now();

  try {
    // Buscar pergunta no banco
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        mlAccount: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!question || !question.mlAccount) {
      throw new Error('Question or ML Account not found');
    }

    const result: ReconciliationResult = {
      questionId: question.id,
      mlQuestionId: question.mlQuestionId,
      mlAccountId: question.mlAccountId,
      organizationId: question.mlAccount.organizationId,
      oldStatus: question.status,
      newStatus: question.status,
      action: 'ERROR',
      processingTimeMs: 0,
      checkedAt: new Date(),
    };

    // Verificar elegibilidade
    const eligibility = await checkQuestionEligibility(question, force);
    if (!eligibility.eligible) {
      result.action = 'SKIPPED';
      result.details = eligibility.criteria.reason || 'Not eligible for reconciliation';
      result.processingTimeMs = Date.now() - startTime;
      logger.debug('[ReconciliationService] Question skipped', {
        questionId,
        reason: eligibility.criteria.reason,
      });
      return result;
    }

    // Obter token válido
    const accessToken = await getValidMLToken(question.mlAccountId);
    if (!accessToken) {
      throw new Error('Failed to get valid access token');
    }

    // Buscar dados no ML com rate limiting
    const mlData = await globalMLRateLimiter.executeRequest({
      mlAccountId: question.mlAccountId,
      organizationId: question.mlAccount.organizationId,
      endpoint: `/questions/${question.mlQuestionId}`,
      requestFn: async () => fetchMLQuestionDetails(question.mlQuestionId, accessToken),
      priority: 'low',
      maxRetries: 2,
    });

    // Caso 1: Pergunta foi deletada no ML
    if (mlData.deleted || mlData.status === 'DELETED') {
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
      result.details = 'Question deleted on Mercado Libre';

      logger.info('[ReconciliationService] Question marked as deleted', {
        questionId,
        mlQuestionId: question.mlQuestionId,
      });

      // Emit WebSocket event
      if (config.enableWebSocketNotifications) {
        await emitQuestionUpdate(question.id, question.mlAccount.organizationId);
      }

      result.processingTimeMs = Date.now() - startTime;
      return result;
    }

    // Caso 2: Pergunta foi respondida (manual ou externo)
    if (mlData.answer) {
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
      result.details = 'Manual answer detected on Mercado Libre';
      result.answer = mlData.answer.text;

      logger.info('[ReconciliationService] Manual answer detected', {
        questionId,
        mlQuestionId: question.mlQuestionId,
        answerLength: mlData.answer.text.length,
      });

      // Emit WebSocket event
      if (config.enableWebSocketNotifications) {
        await emitQuestionUpdate(question.id, question.mlAccount.organizationId);
      }

      result.processingTimeMs = Date.now() - startTime;
      return result;
    }

    // Caso 3: Ainda sem resposta
    const questionAge = Date.now() - new Date(question.createdAt).getTime();
    const is24HoursOld = questionAge > 24 * 60 * 60 * 1000;

    if (mlData.status === 'UNANSWERED' && is24HoursOld && question.status === 'FAILED') {
      result.action = 'REPROCESSABLE';
      result.details = `Still unanswered after ${Math.floor(questionAge / (60 * 60 * 1000))} hours - may need manual review`;
    } else {
      result.action = 'STILL_UNANSWERED';
      result.details = `Status on ML: ${mlData.status} - Still pending response`;
    }

    logger.debug('[ReconciliationService] Question still pending', {
      questionId,
      mlQuestionId: question.mlQuestionId,
      mlStatus: mlData.status,
    });

    result.processingTimeMs = Date.now() - startTime;
    return result;

  } catch (error: any) {
    logger.error('[ReconciliationService] Error reconciling question', {
      questionId,
      error: error.message,
    });

    return {
      questionId,
      mlQuestionId: '',
      mlAccountId: '',
      organizationId: '',
      oldStatus: 'UNKNOWN',
      newStatus: 'UNKNOWN',
      action: 'ERROR',
      error: error.message,
      processingTimeMs: Date.now() - startTime,
      checkedAt: new Date(),
    };
  }
}

// ==================== BATCH OPERATIONS ====================

/**
 * Reconcilia múltiplas perguntas em batch
 */
export async function reconcileBatch(
  questionIds: string[],
  force: boolean = false
): Promise<ReconciliationStats> {
  const runId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  const results: ReconciliationResult[] = [];

  logger.info('[ReconciliationService] Starting batch reconciliation', {
    runId,
    questionCount: questionIds.length,
  });

  // Process questions sequentially to respect rate limits
  for (const questionId of questionIds) {
    try {
      const result = await reconcileQuestion(questionId, force);
      results.push(result);

      // Small delay between questions to be nice to the system
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error: any) {
      logger.error('[ReconciliationService] Error in batch processing', {
        runId,
        questionId,
        error: error.message,
      });

      results.push({
        questionId,
        mlQuestionId: '',
        mlAccountId: '',
        organizationId: '',
        oldStatus: 'UNKNOWN',
        newStatus: 'UNKNOWN',
        action: 'ERROR',
        error: error.message,
        processingTimeMs: 0,
        checkedAt: new Date(),
      });
    }
  }

  const stats: ReconciliationStats = {
    runId,
    startedAt: new Date(startTime),
    completedAt: new Date(),
    durationMs: Date.now() - startTime,
    totalQuestions: results.length,
    completedExternal: results.filter((r) => r.action === 'COMPLETED_EXTERNAL').length,
    completedDeleted: results.filter((r) => r.action === 'COMPLETED_DELETED').length,
    stillUnanswered: results.filter((r) => r.action === 'STILL_UNANSWERED').length,
    reprocessable: results.filter((r) => r.action === 'REPROCESSABLE').length,
    skipped: results.filter((r) => r.action === 'SKIPPED').length,
    errors: results.filter((r) => r.action === 'ERROR').length,
    results,
  };

  logger.info('[ReconciliationService] Batch reconciliation completed', {
    runId,
    stats: {
      total: stats.totalQuestions,
      completedExternal: stats.completedExternal,
      completedDeleted: stats.completedDeleted,
      errors: stats.errors,
    },
  });

  return stats;
}

/**
 * Reconcilia todas perguntas elegíveis de uma organização
 */
export async function reconcileOrganization(
  request: ReconcileOrganizationRequest
): Promise<ReconciliationResponse> {
  try {
    logger.info('[ReconciliationService] Starting organization reconciliation', {
      organizationId: request.organizationId,
      limit: request.limit,
    });

    // Buscar perguntas elegíveis
    const questions = await prisma.question.findMany({
      where: {
        mlAccount: {
          organizationId: request.organizationId,
          isActive: true,
        },
        status: {
          in: config.eligibleStatuses,
        },
      },
      select: {
        id: true,
      },
      take: request.limit || config.maxQuestionsPerOrg,
      orderBy: {
        createdAt: 'asc', // Processar as mais antigas primeiro
      },
    });

    if (questions.length === 0) {
      return {
        success: true,
        message: 'No eligible questions found for reconciliation',
        stats: {
          runId: `org_${Date.now()}`,
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 0,
          organizationId: request.organizationId,
          totalQuestions: 0,
          completedExternal: 0,
          completedDeleted: 0,
          stillUnanswered: 0,
          reprocessable: 0,
          skipped: 0,
          errors: 0,
          results: [],
        },
      };
    }

    const questionIds = questions.map((q) => q.id);
    const stats = await reconcileBatch(questionIds, request.forceAll);
    stats.organizationId = request.organizationId;

    return {
      success: true,
      stats,
      message: `Reconciled ${stats.totalQuestions} questions for organization`,
    };
  } catch (error: any) {
    logger.error('[ReconciliationService] Error reconciling organization', {
      organizationId: request.organizationId,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
      stats: {
        runId: `org_error_${Date.now()}`,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0,
        organizationId: request.organizationId,
        totalQuestions: 0,
        completedExternal: 0,
        completedDeleted: 0,
        stillUnanswered: 0,
        reprocessable: 0,
        skipped: 0,
        errors: 1,
        results: [],
      },
    };
  }
}

/**
 * Reconcilia todas perguntas elegíveis de uma conta ML
 */
export async function reconcileAccount(
  request: ReconcileAccountRequest
): Promise<ReconciliationResponse> {
  try {
    logger.info('[ReconciliationService] Starting account reconciliation', {
      mlAccountId: request.mlAccountId,
      limit: request.limit,
    });

    const questions = await prisma.question.findMany({
      where: {
        mlAccountId: request.mlAccountId,
        mlAccount: {
          isActive: true,
        },
        status: {
          in: config.eligibleStatuses,
        },
      },
      select: {
        id: true,
      },
      take: request.limit || config.maxQuestionsPerOrg,
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (questions.length === 0) {
      return {
        success: true,
        message: 'No eligible questions found for reconciliation',
        stats: {
          runId: `account_${Date.now()}`,
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 0,
          mlAccountId: request.mlAccountId,
          totalQuestions: 0,
          completedExternal: 0,
          completedDeleted: 0,
          stillUnanswered: 0,
          reprocessable: 0,
          skipped: 0,
          errors: 0,
          results: [],
        },
      };
    }

    const questionIds = questions.map((q) => q.id);
    const stats = await reconcileBatch(questionIds, request.forceAll);
    stats.mlAccountId = request.mlAccountId;

    return {
      success: true,
      stats,
      message: `Reconciled ${stats.totalQuestions} questions for account`,
    };
  } catch (error: any) {
    logger.error('[ReconciliationService] Error reconciling account', {
      mlAccountId: request.mlAccountId,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
      stats: {
        runId: `account_error_${Date.now()}`,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0,
        mlAccountId: request.mlAccountId,
        totalQuestions: 0,
        completedExternal: 0,
        completedDeleted: 0,
        stillUnanswered: 0,
        reprocessable: 0,
        skipped: 0,
        errors: 1,
        results: [],
      },
    };
  }
}

/**
 * Reconcilia todas perguntas elegíveis do sistema
 */
export async function reconcileAll(limit?: number): Promise<ReconciliationResponse> {
  try {
    logger.info('[ReconciliationService] Starting system-wide reconciliation', {
      limit,
    });

    const questions = await prisma.question.findMany({
      where: {
        mlAccount: {
          isActive: true,
        },
        status: {
          in: config.eligibleStatuses,
        },
      },
      select: {
        id: true,
      },
      take: limit || config.maxQuestionsPerOrg * 10, // Max 10 orgs
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (questions.length === 0) {
      return {
        success: true,
        message: 'No eligible questions found for reconciliation',
        stats: {
          runId: `system_${Date.now()}`,
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 0,
          totalQuestions: 0,
          completedExternal: 0,
          completedDeleted: 0,
          stillUnanswered: 0,
          reprocessable: 0,
          skipped: 0,
          errors: 0,
          results: [],
        },
      };
    }

    const questionIds = questions.map((q) => q.id);
    const stats = await reconcileBatch(questionIds, false);

    return {
      success: true,
      stats,
      message: `Reconciled ${stats.totalQuestions} questions system-wide`,
    };
  } catch (error: any) {
    logger.error('[ReconciliationService] Error in system-wide reconciliation', {
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
      stats: {
        runId: `system_error_${Date.now()}`,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0,
        totalQuestions: 0,
        completedExternal: 0,
        completedDeleted: 0,
        stillUnanswered: 0,
        reprocessable: 0,
        skipped: 0,
        errors: 1,
        results: [],
      },
    };
  }
}

// ==================== STATISTICS ====================

/**
 * Retorna estatísticas gerais do sistema de reconciliação
 */
export async function getReconciliationSystemStats() {
  try {
    const [totalEligible, byStatus, byOrg] = await Promise.all([
      // Total de perguntas elegíveis
      prisma.question.count({
        where: {
          status: {
            in: config.eligibleStatuses,
          },
          mlAccount: {
            isActive: true,
          },
        },
      }),

      // Por status
      prisma.question.groupBy({
        by: ['status'],
        where: {
          status: {
            in: config.eligibleStatuses,
          },
          mlAccount: {
            isActive: true,
          },
        },
        _count: true,
      }),

      // Por organização
      prisma.question.groupBy({
        by: ['mlAccountId'],
        where: {
          status: {
            in: config.eligibleStatuses,
          },
          mlAccount: {
            isActive: true,
          },
        },
        _count: true,
      }),
    ]);

    return {
      totalEligibleQuestions: totalEligible,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      activeAccounts: byOrg.length,
      config: getReconciliationConfig(),
    };
  } catch (error: any) {
    logger.error('[ReconciliationService] Error getting system stats', {
      error: error.message,
    });
    return null;
  }
}
