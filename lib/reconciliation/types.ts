/**
 * Types para Sistema de Reconciliação de Perguntas
 *
 * Define interfaces para o sistema que sincroniza automaticamente
 * perguntas com status de erro com o estado real no Mercado Livre.
 *
 * Novembro 2025 - Best Practices
 */

// ==================== CORE TYPES ====================

/**
 * Ações possíveis durante reconciliação
 */
export type ReconciliationAction =
  | 'COMPLETED_EXTERNAL' // Resposta manual detectada
  | 'COMPLETED_DELETED' // Pergunta deletada no ML
  | 'STILL_UNANSWERED' // Ainda sem resposta
  | 'REPROCESSABLE' // Elegível para reprocessamento
  | 'SKIPPED' // Ignorada (muito recente, etc)
  | 'ERROR'; // Erro durante verificação

/**
 * Status de reconciliação por pergunta
 */
export interface ReconciliationResult {
  questionId: string;
  mlQuestionId: string;
  mlAccountId: string;
  organizationId: string;
  oldStatus: string;
  newStatus: string;
  action: ReconciliationAction;
  details?: string;
  answer?: string;
  error?: string;
  processingTimeMs: number;
  checkedAt: Date;
}

/**
 * Estatísticas de uma reconciliação
 */
export interface ReconciliationStats {
  runId: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  organizationId?: string;
  mlAccountId?: string;
  totalQuestions: number;
  completedExternal: number;
  completedDeleted: number;
  stillUnanswered: number;
  reprocessable: number;
  skipped: number;
  errors: number;
  results: ReconciliationResult[];
}

/**
 * Configuração de reconciliação
 */
export interface ReconciliationConfig {
  // Intervalo entre execuções (ms)
  intervalMs: number;

  // Batch size (quantas perguntas processar por vez)
  batchSize: number;

  // Idade mínima da pergunta para reconciliar (ms)
  minQuestionAgeMs: number;

  // Status elegíveis para reconciliação
  eligibleStatuses: string[];

  // Max perguntas por organização por execução
  maxQuestionsPerOrg: number;

  // Timeout para cada verificação (ms)
  requestTimeoutMs: number;

  // Habilitar WebSocket notifications
  enableWebSocketNotifications: boolean;

  // Habilitar audit logs
  enableAuditLogs: boolean;
}

// ==================== REQUEST/RESPONSE TYPES ====================

/**
 * Request para reconciliar organização
 */
export interface ReconcileOrganizationRequest {
  organizationId: string;
  limit?: number;
  forceAll?: boolean; // Ignorar minQuestionAgeMs
}

/**
 * Request para reconciliar conta ML
 */
export interface ReconcileAccountRequest {
  mlAccountId: string;
  limit?: number;
  forceAll?: boolean;
}

/**
 * Request para reconciliar pergunta específica
 */
export interface ReconcileQuestionRequest {
  questionId: string;
  force?: boolean;
}

/**
 * Response de reconciliação
 */
export interface ReconciliationResponse {
  success: boolean;
  stats: ReconciliationStats;
  message?: string;
  error?: string;
}

// ==================== ML API TYPES ====================

/**
 * Resposta da ML API /questions/{id}
 */
export interface MLQuestionResponse {
  id: number;
  date_created: string;
  item_id: string;
  seller_id: number;
  status: 'UNANSWERED' | 'ANSWERED' | 'CLOSED_UNANSWERED' | 'UNDER_REVIEW' | 'BANNED' | 'DELETED';
  text: string;
  answer?: {
    text: string;
    status: string;
    date_created: string;
  } | null;
  from?: {
    id: number;
    answered_questions: number;
  };
  deleted?: boolean;
}

// ==================== WORKER TYPES ====================

/**
 * Estado do worker de reconciliação
 */
export interface ReconciliationWorkerState {
  isRunning: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  consecutiveErrors: number;
  totalRuns: number;
  totalQuestionsReconciled: number;
  totalExternalAnswersDetected: number;
  uptime: number;
}

/**
 * Metrics do worker
 */
export interface ReconciliationMetrics {
  // Contadores gerais
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;

  // Perguntas processadas
  totalQuestionsChecked: number;
  externalAnswersDetected: number;
  deletedQuestionsFound: number;
  errorsEncountered: number;

  // Performance
  averageRunDurationMs: number;
  averageQuestionsPerRun: number;
  lastRunDurationMs: number;

  // Timestamps
  lastSuccessfulRunAt: Date | null;
  lastFailedRunAt: Date | null;
  workerStartedAt: Date;
}

// ==================== DATABASE TYPES ====================

/**
 * Log de reconciliação (para auditoria)
 */
export interface ReconciliationLog {
  id: string;
  runId: string;
  organizationId: string;
  mlAccountId: string;
  questionId: string;
  mlQuestionId: string;
  action: ReconciliationAction;
  oldStatus: string;
  newStatus: string;
  details: string | null;
  processingTimeMs: number;
  createdAt: Date;
}

// ==================== VALIDATION TYPES ====================

/**
 * Critérios de elegibilidade para reconciliação
 */
export interface EligibilityCriteria {
  // Status deve estar na lista elegível
  hasEligibleStatus: boolean;

  // Pergunta deve ter idade mínima
  meetsMinAge: boolean;

  // Não deve ter sido verificada recentemente
  notRecentlyChecked: boolean;

  // Conta ML deve estar ativa
  accountIsActive: boolean;

  // Token deve estar válido
  hasValidToken: boolean;

  // Resultado final
  isEligible: boolean;

  // Motivo se não elegível
  reason?: string;
}

/**
 * Resultado de validação de elegibilidade
 */
export interface EligibilityResult {
  questionId: string;
  eligible: boolean;
  criteria: EligibilityCriteria;
  estimatedWaitTime?: number; // ms até próxima verificação
}

// ==================== CONSTANTS ====================

/**
 * Configuração padrão de reconciliação
 */
export const DEFAULT_RECONCILIATION_CONFIG: ReconciliationConfig = {
  intervalMs: 30 * 60 * 1000, // 30 minutos
  batchSize: 50,
  minQuestionAgeMs: 5 * 60 * 1000, // 5 minutos
  eligibleStatuses: ['FAILED', 'ERROR', 'TOKEN_ERROR', 'PROCESSING', 'SENT_TO_ML'],
  maxQuestionsPerOrg: 100,
  requestTimeoutMs: 10000, // 10 segundos
  enableWebSocketNotifications: true,
  enableAuditLogs: true,
};

/**
 * Status que indicam erro/problema
 */
export const ERROR_STATUSES = ['FAILED', 'ERROR', 'TOKEN_ERROR'] as const;

/**
 * Status que indicam processamento em andamento
 */
export const PROCESSING_STATUSES = ['PROCESSING', 'SENT_TO_ML', 'REVISING'] as const;

/**
 * Status finais (não reconciliar)
 */
export const FINAL_STATUSES = ['COMPLETED', 'RESPONDED'] as const;

// ==================== UTILITY TYPES ====================

/**
 * Helper type para operações de reconciliação
 */
export type ReconciliationOperation = 'CHECK' | 'UPDATE' | 'SKIP' | 'RETRY';

/**
 * Priority para processamento
 */
export type ReconciliationPriority = 'high' | 'normal' | 'low';

/**
 * Resultado de operação assíncrona
 */
export interface AsyncOperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
}
