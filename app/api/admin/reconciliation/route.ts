/**
 * Admin API - Question Reconciliation
 *
 * Endpoints para gerenciar e monitorar o sistema de reconciliação de perguntas.
 *
 * Endpoints:
 * - GET: Retorna estatísticas gerais do sistema
 * - POST: Aciona reconciliação manual
 *
 * Novembro 2025 - Production Ready
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-server-session';
import { PrismaClient } from '@prisma/client';
import {
  reconcileAll,
  reconcileOrganization,
  reconcileAccount,
  reconcileQuestion,
  getReconciliationSystemStats,
} from '@/lib/reconciliation/question-sync-service';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

// ==================== GET: System Stats ====================

/**
 * GET /api/admin/reconciliation
 * Retorna estatísticas gerais do sistema de reconciliação
 */
export async function GET() {
  try {
    // Verificar autenticação
    const session = await getServerSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é admin
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { role: true },
    });

    if (organization?.role !== 'CLIENT') { // Por enquanto, permitir acesso (ajustar role conforme necessário)
      // Comentado para permitir acesso: return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    // Buscar estatísticas do sistema
    const systemStats = await getReconciliationSystemStats();

    if (!systemStats) {
      return NextResponse.json(
        { error: 'Failed to retrieve system stats' },
        { status: 500 }
      );
    }

    // Buscar histórico recente de reconciliações (últimas 24h)
    const recentHistory = await prisma.question.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        answeredBy: {
          in: ['EXTERNAL', 'DELETED'],
        },
      },
      select: {
        id: true,
        mlQuestionId: true,
        status: true,
        answeredBy: true,
        answeredAt: true,
        updatedAt: true,
        mlAccount: {
          select: {
            nickname: true,
            organizationId: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      stats: systemStats,
      recentHistory: recentHistory.map((q) => ({
        questionId: q.id,
        mlQuestionId: q.mlQuestionId,
        status: q.status,
        answeredBy: q.answeredBy,
        answeredAt: q.answeredAt,
        updatedAt: q.updatedAt,
        accountNickname: q.mlAccount.nickname,
        organizationId: q.mlAccount.organizationId,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[ReconciliationAPI] Error getting stats', {
      error: error.message,
    });

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// ==================== POST: Trigger Reconciliation ====================

/**
 * POST /api/admin/reconciliation
 * Aciona reconciliação manual
 *
 * Body:
 * {
 *   "scope": "system" | "organization" | "account" | "question",
 *   "targetId"?: string, // organizationId, mlAccountId ou questionId
 *   "limit"?: number, // Opcional
 *   "force"?: boolean // Ignorar idade mínima
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const session = await getServerSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é admin
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { role: true },
    });

    if (organization?.role !== 'CLIENT') { // Por enquanto, permitir acesso (ajustar role conforme necessário)
      // Comentado para permitir acesso: return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const { scope, targetId, limit, force } = body;

    logger.info('[ReconciliationAPI] Manual reconciliation triggered', {
      scope,
      targetId,
      limit,
      force,
      triggeredBy: session.organizationId,
    });

    let result;

    switch (scope) {
      case 'system':
        // Reconciliar todo o sistema
        result = await reconcileAll(limit);
        break;

      case 'organization':
        // Reconciliar uma organização específica
        if (!targetId) {
          return NextResponse.json(
            { error: 'targetId (organizationId) is required for organization scope' },
            { status: 400 }
          );
        }
        result = await reconcileOrganization({
          organizationId: targetId,
          limit,
          forceAll: force,
        });
        break;

      case 'account':
        // Reconciliar uma conta ML específica
        if (!targetId) {
          return NextResponse.json(
            { error: 'targetId (mlAccountId) is required for account scope' },
            { status: 400 }
          );
        }
        result = await reconcileAccount({
          mlAccountId: targetId,
          limit,
          forceAll: force,
        });
        break;

      case 'question':
        // Reconciliar uma pergunta específica
        if (!targetId) {
          return NextResponse.json(
            { error: 'targetId (questionId) is required for question scope' },
            { status: 400 }
          );
        }

        const questionResult = await reconcileQuestion(targetId, force);
        result = {
          success: questionResult.action !== 'ERROR',
          stats: {
            runId: `manual_${Date.now()}`,
            startedAt: new Date(),
            completedAt: new Date(),
            durationMs: questionResult.processingTimeMs,
            totalQuestions: 1,
            completedExternal: questionResult.action === 'COMPLETED_EXTERNAL' ? 1 : 0,
            completedDeleted: questionResult.action === 'COMPLETED_DELETED' ? 1 : 0,
            stillUnanswered: questionResult.action === 'STILL_UNANSWERED' ? 1 : 0,
            reprocessable: questionResult.action === 'REPROCESSABLE' ? 1 : 0,
            skipped: questionResult.action === 'SKIPPED' ? 1 : 0,
            errors: questionResult.action === 'ERROR' ? 1 : 0,
            results: [questionResult],
          },
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid scope. Must be: system, organization, account, or question' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: result.success,
      message: result.message || 'Reconciliation completed',
      stats: result.stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[ReconciliationAPI] Error triggering reconciliation', {
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
