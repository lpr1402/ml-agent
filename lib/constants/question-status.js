/**
 * Question Status Constants - JavaScript version
 * Padronização única de status para todo o sistema
 * Simplificado para melhor UX
 */

const QuestionStatus = {
  // Estados principais do fluxo
  PENDING: 'PENDING',                       // Aguardando processamento (inclui RECEIVED, AWAITING_APPROVAL)
  PROCESSING: 'PROCESSING',                 // Sendo processada pela IA
  REVIEWING: 'REVIEWING',                   // Em revisão (inclui REVISING)
  RESPONDED: 'RESPONDED',                   // Respondida no ML (inclui SENT_TO_ML, COMPLETED, APPROVED)

  // Estados de erro
  FAILED: 'FAILED',                         // Erro geral recuperável
  ERROR: 'ERROR',                           // Erro crítico não recuperável
  TOKEN_ERROR: 'TOKEN_ERROR',               // Erro de autenticação/token

  // Estados legados (mantidos temporariamente para compatibilidade)
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',   // Mapeado para PENDING
  APPROVED: 'APPROVED',                     // Mapeado para RESPONDED
  SENT_TO_ML: 'SENT_TO_ML',                 // Mapeado para RESPONDED
  COMPLETED: 'COMPLETED',                   // Mapeado para RESPONDED
  REVISING: 'REVISING',                     // Mapeado para REVIEWING
  RECEIVED: 'RECEIVED',                     // Mapeado para PENDING
}

// Status que indicam que a pergunta está ativa
const ACTIVE_STATUSES = [
  QuestionStatus.PENDING,
  QuestionStatus.PROCESSING,
  QuestionStatus.REVIEWING
]

// Status finais (não devem mudar mais)
const FINAL_STATUSES = [
  QuestionStatus.RESPONDED,
  QuestionStatus.ERROR
]

// Status que permitem retry
const RETRYABLE_STATUSES = [
  QuestionStatus.FAILED,
  QuestionStatus.TOKEN_ERROR
]

// Status que mostram loading no frontend
const LOADING_STATUSES = [
  QuestionStatus.PROCESSING,
  QuestionStatus.REVIEWING
]

// Helper para normalizar status legados para os novos
function normalizeQuestionStatus(status) {
  const mapping = {
    'RECEIVED': QuestionStatus.PENDING,
    'AWAITING_APPROVAL': QuestionStatus.PENDING,
    'REVISING': QuestionStatus.REVIEWING,
    'APPROVED': QuestionStatus.RESPONDED,
    'SENT_TO_ML': QuestionStatus.RESPONDED,
    'COMPLETED': QuestionStatus.RESPONDED,
  }
  return mapping[status] || status
}

module.exports = {
  QuestionStatus,
  ACTIVE_STATUSES,
  FINAL_STATUSES,
  RETRYABLE_STATUSES,
  LOADING_STATUSES,
  normalizeQuestionStatus
}
