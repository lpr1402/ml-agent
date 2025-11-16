/**
 * Question Reconciliation Worker
 *
 * Worker que executa reconciliação automática de perguntas com erro,
 * sincronizando com o estado real no Mercado Livre.
 *
 * Features:
 * - Execução periódica (30 min padrão)
 * - Detecção automática de respostas manuais
 * - Métricas e observabilidade
 * - Graceful shutdown
 * - Auto-recovery em caso de erros
 *
 * Uso:
 *   npx tsx workers/question-reconciliation-worker.ts
 *
 * Novembro 2025 - Production Ready
 */

import { logger } from '@/lib/logger';
import {
  reconcileAll,
  getReconciliationSystemStats,
  setReconciliationConfig,
} from '@/lib/reconciliation/question-sync-service';
import {
  ReconciliationMetrics,
  ReconciliationWorkerState,
} from '@/lib/reconciliation/types';

// ==================== CONFIGURATION ====================

const CONFIG = {
  // Intervalo entre execuções (ms)
  RECONCILIATION_INTERVAL_MS: parseInt(
    process.env['RECONCILIATION_INTERVAL_MS'] || String(30 * 60 * 1000)
  ), // 30 min

  // Batch size
  BATCH_SIZE: parseInt(process.env['RECONCILIATION_BATCH_SIZE'] || '50'),

  // Idade mínima da pergunta (ms)
  MIN_QUESTION_AGE_MS: parseInt(
    process.env['RECONCILIATION_MIN_AGE_MS'] || String(5 * 60 * 1000)
  ), // 5 min

  // Max retries consecutivos antes de pausar
  MAX_CONSECUTIVE_ERRORS: 5,

  // Tempo de pausa após muitos erros (ms)
  ERROR_COOLDOWN_MS: 10 * 60 * 1000, // 10 min

  // Habilitar modo verbose
  VERBOSE: process.env['RECONCILIATION_VERBOSE'] === 'true',
} as const;

// ==================== STATE ====================

const state: ReconciliationWorkerState = {
  isRunning: false,
  lastRunAt: null,
  nextRunAt: null,
  consecutiveErrors: 0,
  totalRuns: 0,
  totalQuestionsReconciled: 0,
  totalExternalAnswersDetected: 0,
  uptime: Date.now(),
};

const metrics: ReconciliationMetrics = {
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  totalQuestionsChecked: 0,
  externalAnswersDetected: 0,
  deletedQuestionsFound: 0,
  errorsEncountered: 0,
  averageRunDurationMs: 0,
  averageQuestionsPerRun: 0,
  lastRunDurationMs: 0,
  lastSuccessfulRunAt: null,
  lastFailedRunAt: null,
  workerStartedAt: new Date(),
};

let intervalTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;

// ==================== RECONCILIATION EXECUTION ====================

/**
 * Executa uma rodada de reconciliação
 */
async function executeReconciliation(): Promise<void> {
  if (state.isRunning) {
    logger.warn('[ReconciliationWorker] Skipping run - previous run still in progress');
    return;
  }

  state.isRunning = true;
  state.lastRunAt = new Date();
  const startTime = Date.now();

  try {
    logger.info('[ReconciliationWorker] 🚀 Starting reconciliation run', {
      runNumber: state.totalRuns + 1,
      consecutiveErrors: state.consecutiveErrors,
    });

    // Get system stats before reconciliation
    if (CONFIG.VERBOSE) {
      const stats = await getReconciliationSystemStats();
      if (stats) {
        logger.info('[ReconciliationWorker] System stats before run', stats);
      }
    }

    // Execute reconciliation
    const result = await reconcileAll(CONFIG.BATCH_SIZE);

    // Update metrics
    const duration = Date.now() - startTime;
    metrics.lastRunDurationMs = duration;
    metrics.totalRuns++;
    state.totalRuns++;

    if (result.success) {
      metrics.successfulRuns++;
      metrics.lastSuccessfulRunAt = new Date();
      state.consecutiveErrors = 0; // Reset error counter

      // Update detailed metrics
      metrics.totalQuestionsChecked += result.stats.totalQuestions;
      metrics.externalAnswersDetected += result.stats.completedExternal;
      metrics.deletedQuestionsFound += result.stats.completedDeleted;
      metrics.errorsEncountered += result.stats.errors;

      state.totalQuestionsReconciled += result.stats.totalQuestions;
      state.totalExternalAnswersDetected += result.stats.completedExternal;

      // Calculate averages
      metrics.averageRunDurationMs =
        (metrics.averageRunDurationMs * (metrics.successfulRuns - 1) + duration) /
        metrics.successfulRuns;
      metrics.averageQuestionsPerRun =
        metrics.totalQuestionsChecked / metrics.successfulRuns;

      logger.info('[ReconciliationWorker] ✅ Reconciliation completed successfully', {
        duration: `${duration}ms`,
        questionsProcessed: result.stats.totalQuestions,
        externalAnswers: result.stats.completedExternal,
        deleted: result.stats.completedDeleted,
        stillPending: result.stats.stillUnanswered,
        errors: result.stats.errors,
      });

      // Log details if verbose
      if (CONFIG.VERBOSE && result.stats.results.length > 0) {
        logger.debug('[ReconciliationWorker] Detailed results', {
          results: result.stats.results.map((r) => ({
            mlQuestionId: r.mlQuestionId,
            action: r.action,
            oldStatus: r.oldStatus,
            newStatus: r.newStatus,
          })),
        });
      }
    } else {
      metrics.failedRuns++;
      metrics.lastFailedRunAt = new Date();
      state.consecutiveErrors++;

      logger.error('[ReconciliationWorker] ❌ Reconciliation failed', {
        error: result.error,
        consecutiveErrors: state.consecutiveErrors,
      });

      // Check if we need to pause
      if (state.consecutiveErrors >= CONFIG.MAX_CONSECUTIVE_ERRORS) {
        logger.error('[ReconciliationWorker] 🛑 Too many consecutive errors - entering cooldown', {
          cooldownMs: CONFIG.ERROR_COOLDOWN_MS,
        });

        // Schedule next run after cooldown
        state.nextRunAt = new Date(Date.now() + CONFIG.ERROR_COOLDOWN_MS);
        setTimeout(() => {
          state.consecutiveErrors = 0;
          logger.info('[ReconciliationWorker] 🔄 Cooldown complete - resuming operations');
        }, CONFIG.ERROR_COOLDOWN_MS);
      }
    }
  } catch (error: any) {
    metrics.failedRuns++;
    metrics.lastFailedRunAt = new Date();
    state.consecutiveErrors++;

    logger.error('[ReconciliationWorker] 💥 Unexpected error during reconciliation', {
      error: error.message,
      stack: error.stack,
      consecutiveErrors: state.consecutiveErrors,
    });
  } finally {
    state.isRunning = false;

    // Schedule next run
    if (!isShuttingDown && state.consecutiveErrors < CONFIG.MAX_CONSECUTIVE_ERRORS) {
      state.nextRunAt = new Date(Date.now() + CONFIG.RECONCILIATION_INTERVAL_MS);
    }

    // Log summary
    logger.info('[ReconciliationWorker] 📊 Current metrics', {
      totalRuns: metrics.totalRuns,
      successRate: `${((metrics.successfulRuns / metrics.totalRuns) * 100).toFixed(1)}%`,
      totalQuestionsChecked: metrics.totalQuestionsChecked,
      externalAnswersDetected: metrics.externalAnswersDetected,
      deletedQuestionsFound: metrics.deletedQuestionsFound,
      avgRunTime: `${Math.round(metrics.averageRunDurationMs)}ms`,
      avgQuestionsPerRun: Math.round(metrics.averageQuestionsPerRun),
      nextRunIn: state.nextRunAt
        ? `${Math.round((state.nextRunAt.getTime() - Date.now()) / 60000)} min`
        : 'N/A',
    });
  }
}

// ==================== WORKER LIFECYCLE ====================

/**
 * Inicia o worker
 */
async function startWorker(): Promise<void> {
  logger.info('[ReconciliationWorker] 🎬 Starting Question Reconciliation Worker', {
    interval: `${CONFIG.RECONCILIATION_INTERVAL_MS / 60000} minutes`,
    batchSize: CONFIG.BATCH_SIZE,
    minQuestionAge: `${CONFIG.MIN_QUESTION_AGE_MS / 60000} minutes`,
  });

  // Configure service
  setReconciliationConfig({
    intervalMs: CONFIG.RECONCILIATION_INTERVAL_MS,
    batchSize: CONFIG.BATCH_SIZE,
    minQuestionAgeMs: CONFIG.MIN_QUESTION_AGE_MS,
  });

  // Execute first run immediately
  logger.info('[ReconciliationWorker] 🏃 Executing initial reconciliation run...');
  await executeReconciliation();

  // Schedule periodic executions
  intervalTimer = setInterval(async () => {
    if (!isShuttingDown) {
      await executeReconciliation();
    }
  }, CONFIG.RECONCILIATION_INTERVAL_MS);

  logger.info('[ReconciliationWorker] ✅ Worker started successfully', {
    nextRunAt: state.nextRunAt?.toISOString(),
  });
}

/**
 * Para o worker gracefully
 */
async function stopWorker(): Promise<void> {
  if (isShuttingDown) {
    logger.warn('[ReconciliationWorker] Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info('[ReconciliationWorker] 🛑 Shutting down gracefully...');

  // Clear interval
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }

  // Wait for current run to complete
  if (state.isRunning) {
    logger.info('[ReconciliationWorker] ⏳ Waiting for current run to complete...');
    let waitTime = 0;
    while (state.isRunning && waitTime < 60000) {
      // Max 60s wait
      await new Promise((resolve) => setTimeout(resolve, 1000));
      waitTime += 1000;
    }

    if (state.isRunning) {
      logger.warn('[ReconciliationWorker] ⚠️ Force shutdown - current run still in progress');
    }
  }

  // Log final metrics
  const uptimeSeconds = (Date.now() - state.uptime) / 1000;
  logger.info('[ReconciliationWorker] 📈 Final metrics', {
    totalRuns: metrics.totalRuns,
    successfulRuns: metrics.successfulRuns,
    failedRuns: metrics.failedRuns,
    totalQuestionsChecked: metrics.totalQuestionsChecked,
    externalAnswersDetected: metrics.externalAnswersDetected,
    deletedQuestionsFound: metrics.deletedQuestionsFound,
    uptime: `${Math.round(uptimeSeconds)}s`,
  });

  logger.info('[ReconciliationWorker] ✅ Shutdown complete');
  process.exit(0);
}

// ==================== SIGNAL HANDLERS ====================

process.on('SIGTERM', () => {
  logger.info('[ReconciliationWorker] Received SIGTERM signal');
  stopWorker();
});

process.on('SIGINT', () => {
  logger.info('[ReconciliationWorker] Received SIGINT signal');
  stopWorker();
});

process.on('uncaughtException', (error) => {
  logger.error('[ReconciliationWorker] 💥 Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });

  // Try to shutdown gracefully
  stopWorker();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[ReconciliationWorker] 💥 Unhandled rejection', {
    reason,
    promise,
  });
});

// ==================== HEALTH CHECK ENDPOINT ====================

/**
 * Retorna estado atual do worker (para health checks)
 */
export function getWorkerState(): ReconciliationWorkerState {
  return { ...state };
}

/**
 * Retorna métricas do worker
 */
export function getWorkerMetrics(): ReconciliationMetrics {
  return { ...metrics };
}

// ==================== MAIN ====================

/**
 * Entry point
 */
async function main() {
  try {
    logger.info('[ReconciliationWorker] ⚡ Initializing...');

    // Start worker
    await startWorker();

    // Keep process alive
    logger.info('[ReconciliationWorker] 💚 Worker is running');
  } catch (error: any) {
    logger.error('[ReconciliationWorker] 💥 Failed to start worker', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Start worker if running directly
if (require.main === module) {
  main();
}

export { startWorker, stopWorker };
