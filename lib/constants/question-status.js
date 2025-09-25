/**
 * Question Status Constants - CommonJS Version
 * Padronização única de status para todo o sistema
 */

const QuestionStatus = {
  // Estados principais do fluxo
  PENDING: 'PENDING',                       // Recebida do ML via webhook
  PROCESSING: 'PROCESSING',                 // Enviada ao N8N para IA processar
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',   // IA respondeu, aguardando aprovação
  APPROVED: 'APPROVED',                     // Usuário aprovou a resposta
  SENT_TO_ML: 'SENT_TO_ML',                 // Enviada ao ML (aguardando confirmação)
  COMPLETED: 'COMPLETED',                   // Confirmada pelo ML e concluída

  // Estados de revisão
  REVISING: 'REVISING',                     // Sendo revisada pela IA

  // Estados de erro
  FAILED: 'FAILED',                         // Erro geral recuperável
  ERROR: 'ERROR',                           // Erro crítico não recuperável
  TOKEN_ERROR: 'TOKEN_ERROR',               // Erro de autenticação/token
}

// Status que indicam que a pergunta está ativa
const ACTIVE_STATUSES = [
  QuestionStatus.PENDING,
  QuestionStatus.PROCESSING,
  QuestionStatus.AWAITING_APPROVAL,
  QuestionStatus.APPROVED,
  QuestionStatus.REVISING,
  QuestionStatus.SENT_TO_ML
]

// Status finais (não devem mudar mais)
const FINAL_STATUSES = [
  QuestionStatus.COMPLETED,
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
  QuestionStatus.REVISING,
  QuestionStatus.APPROVED, // Quando está enviando ao ML
]

// Função helper para validar status
function isValidStatus(status) {
  return Object.values(QuestionStatus).includes(status)
}

// Função helper para verificar se pode transicionar de um status para outro
function canTransitionTo(from, to) {
  const transitions = {
    [QuestionStatus.PENDING]: [
      QuestionStatus.PROCESSING,
      QuestionStatus.FAILED,
      QuestionStatus.ERROR
    ],
    [QuestionStatus.PROCESSING]: [
      QuestionStatus.AWAITING_APPROVAL,
      QuestionStatus.FAILED,
      QuestionStatus.ERROR
    ],
    [QuestionStatus.AWAITING_APPROVAL]: [
      QuestionStatus.APPROVED,
      QuestionStatus.REVISING,
      QuestionStatus.FAILED
    ],
    [QuestionStatus.APPROVED]: [
      QuestionStatus.SENT_TO_ML,
      QuestionStatus.FAILED,
      QuestionStatus.ERROR
    ],
    [QuestionStatus.SENT_TO_ML]: [
      QuestionStatus.COMPLETED,
      QuestionStatus.FAILED
    ],
    [QuestionStatus.REVISING]: [
      QuestionStatus.AWAITING_APPROVAL,
      QuestionStatus.FAILED,
      QuestionStatus.ERROR
    ],
    [QuestionStatus.FAILED]: [
      QuestionStatus.PROCESSING, // Retry
      QuestionStatus.PENDING,    // Restart
      QuestionStatus.ERROR
    ],
    [QuestionStatus.COMPLETED]: [], // Estado final
    [QuestionStatus.ERROR]: [],     // Estado final
    [QuestionStatus.TOKEN_ERROR]: [
      QuestionStatus.PENDING,    // Retry após renovar token
      QuestionStatus.ERROR
    ]
  }

  return transitions[from]?.includes(to) || false
}

module.exports = {
  QuestionStatus,
  ACTIVE_STATUSES,
  FINAL_STATUSES,
  RETRYABLE_STATUSES,
  LOADING_STATUSES,
  isValidStatus,
  canTransitionTo
}