/**
 * Question Status Constants
 * Padronização única de status para todo o sistema
 * Simplificado para melhor UX
 */

export enum QuestionStatus {
  // Estados principais do fluxo
  PENDING = 'PENDING',                       // Aguardando processamento (inclui RECEIVED, AWAITING_APPROVAL)
  PROCESSING = 'PROCESSING',                 // Sendo processada pela IA
  REVIEWING = 'REVIEWING',                   // Em revisão (inclui REVISING)
  RESPONDED = 'RESPONDED',                   // Respondida no ML (inclui SENT_TO_ML, COMPLETED, APPROVED)

  // Estados de erro
  FAILED = 'FAILED',                         // Erro geral recuperável
  ERROR = 'ERROR',                           // Erro crítico não recuperável
  TOKEN_ERROR = 'TOKEN_ERROR',               // Erro de autenticação/token

  // Estados legados (mantidos temporariamente para compatibilidade)
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',   // Mapeado para PENDING
  APPROVED = 'APPROVED',                     // Mapeado para RESPONDED
  SENT_TO_ML = 'SENT_TO_ML',                 // Mapeado para RESPONDED
  COMPLETED = 'COMPLETED',                   // Mapeado para RESPONDED
  REVISING = 'REVISING',                     // Mapeado para REVIEWING
  RECEIVED = 'RECEIVED',                     // Mapeado para PENDING
}

// Status que indicam que a pergunta está ativa
export const ACTIVE_STATUSES = [
  QuestionStatus.PENDING,
  QuestionStatus.PROCESSING,
  QuestionStatus.REVIEWING
]

// Status finais (não devem mudar mais)
export const FINAL_STATUSES = [
  QuestionStatus.RESPONDED,
  QuestionStatus.ERROR
]

// Status que permitem retry
export const RETRYABLE_STATUSES = [
  QuestionStatus.FAILED,
  QuestionStatus.TOKEN_ERROR
]

// Status que mostram loading no frontend
export const LOADING_STATUSES = [
  QuestionStatus.PROCESSING,
  QuestionStatus.REVIEWING
]

// Mapeamento de status para cores (UI)
export const STATUS_COLORS = {
  [QuestionStatus.PENDING]: 'amber',
  [QuestionStatus.PROCESSING]: 'blue',
  [QuestionStatus.REVIEWING]: 'purple',
  [QuestionStatus.RESPONDED]: 'emerald',
  [QuestionStatus.FAILED]: 'red',
  [QuestionStatus.ERROR]: 'red',
  [QuestionStatus.TOKEN_ERROR]: 'orange',
  // Legados
  [QuestionStatus.AWAITING_APPROVAL]: 'amber',
  [QuestionStatus.APPROVED]: 'emerald',
  [QuestionStatus.SENT_TO_ML]: 'emerald',
  [QuestionStatus.COMPLETED]: 'emerald',
  [QuestionStatus.REVISING]: 'purple',
  [QuestionStatus.RECEIVED]: 'amber',
}

// Mapeamento de status para ícones (UI)
export const STATUS_ICONS = {
  [QuestionStatus.PENDING]: 'Clock',
  [QuestionStatus.PROCESSING]: 'RefreshCw',
  [QuestionStatus.REVIEWING]: 'Edit2',
  [QuestionStatus.RESPONDED]: 'CheckCircle2',
  [QuestionStatus.FAILED]: 'XCircle',
  [QuestionStatus.ERROR]: 'XCircle',
  [QuestionStatus.TOKEN_ERROR]: 'Key',
  // Legados
  [QuestionStatus.AWAITING_APPROVAL]: 'Clock',
  [QuestionStatus.APPROVED]: 'CheckCircle2',
  [QuestionStatus.SENT_TO_ML]: 'CheckCircle2',
  [QuestionStatus.COMPLETED]: 'CheckCircle2',
  [QuestionStatus.REVISING]: 'Edit2',
  [QuestionStatus.RECEIVED]: 'Clock',
}

// Mapeamento de status para labels (UI)
export const STATUS_LABELS = {
  [QuestionStatus.PENDING]: 'Pendente',
  [QuestionStatus.PROCESSING]: 'Processando',
  [QuestionStatus.REVIEWING]: 'Revisando',
  [QuestionStatus.RESPONDED]: 'Respondida',
  [QuestionStatus.FAILED]: 'Falhou',
  [QuestionStatus.ERROR]: 'Erro',
  [QuestionStatus.TOKEN_ERROR]: 'Erro de Token',
  // Legados
  [QuestionStatus.AWAITING_APPROVAL]: 'Pendente',
  [QuestionStatus.APPROVED]: 'Respondida',
  [QuestionStatus.SENT_TO_ML]: 'Respondida',
  [QuestionStatus.COMPLETED]: 'Respondida',
  [QuestionStatus.REVISING]: 'Revisando',
  [QuestionStatus.RECEIVED]: 'Pendente',
}

// Função helper para validar status
export function isValidStatus(status: string): boolean {
  return Object.values(QuestionStatus).includes(status as QuestionStatus)
}

// Função helper para verificar se pode transicionar de um status para outro
export function canTransitionTo(from: QuestionStatus, to: QuestionStatus): boolean {
  // Normalizar status legados
  const normalizeStatus = (status: QuestionStatus): QuestionStatus => {
    const mapping: Record<string, QuestionStatus> = {
      [QuestionStatus.RECEIVED]: QuestionStatus.PENDING,
      [QuestionStatus.AWAITING_APPROVAL]: QuestionStatus.PENDING,
      [QuestionStatus.REVISING]: QuestionStatus.REVIEWING,
      [QuestionStatus.APPROVED]: QuestionStatus.RESPONDED,
      [QuestionStatus.SENT_TO_ML]: QuestionStatus.RESPONDED,
      [QuestionStatus.COMPLETED]: QuestionStatus.RESPONDED,
    }
    return mapping[status] || status
  }

  const normalizedFrom = normalizeStatus(from)
  const normalizedTo = normalizeStatus(to)

  const transitions: Record<QuestionStatus, QuestionStatus[]> = {
    [QuestionStatus.PENDING]: [
      QuestionStatus.PROCESSING,
      QuestionStatus.REVIEWING,
      QuestionStatus.FAILED,
      QuestionStatus.ERROR
    ],
    [QuestionStatus.PROCESSING]: [
      QuestionStatus.PENDING,
      QuestionStatus.REVIEWING,
      QuestionStatus.RESPONDED,
      QuestionStatus.FAILED,
      QuestionStatus.ERROR
    ],
    [QuestionStatus.REVIEWING]: [
      QuestionStatus.PENDING,
      QuestionStatus.RESPONDED,
      QuestionStatus.FAILED,
      QuestionStatus.ERROR
    ],
    [QuestionStatus.RESPONDED]: [], // Estado final
    [QuestionStatus.FAILED]: [
      QuestionStatus.PENDING,
      QuestionStatus.PROCESSING,
      QuestionStatus.ERROR
    ],
    [QuestionStatus.ERROR]: [],     // Estado final
    [QuestionStatus.TOKEN_ERROR]: [
      QuestionStatus.PENDING,
      QuestionStatus.ERROR
    ],
    // Estados legados (mapeiam para os novos)
    [QuestionStatus.AWAITING_APPROVAL]: [
      QuestionStatus.PROCESSING,
      QuestionStatus.REVIEWING,
      QuestionStatus.RESPONDED,
      QuestionStatus.FAILED
    ],
    [QuestionStatus.APPROVED]: [
      QuestionStatus.RESPONDED
    ],
    [QuestionStatus.SENT_TO_ML]: [
      QuestionStatus.RESPONDED
    ],
    [QuestionStatus.COMPLETED]: [],
    [QuestionStatus.REVISING]: [
      QuestionStatus.PENDING,
      QuestionStatus.RESPONDED,
      QuestionStatus.FAILED
    ],
    [QuestionStatus.RECEIVED]: [
      QuestionStatus.PROCESSING,
      QuestionStatus.FAILED,
      QuestionStatus.ERROR
    ]
  }

  return transitions[normalizedFrom]?.includes(normalizedTo) || false
}

// Helper para normalizar status legados para os novos
export function normalizeQuestionStatus(status: string): QuestionStatus {
  const mapping: Record<string, QuestionStatus> = {
    'RECEIVED': QuestionStatus.PENDING,
    'AWAITING_APPROVAL': QuestionStatus.PENDING,
    'REVISING': QuestionStatus.REVIEWING,
    'APPROVED': QuestionStatus.RESPONDED,
    'SENT_TO_ML': QuestionStatus.RESPONDED,
    'COMPLETED': QuestionStatus.RESPONDED,
  }
  return (mapping[status] || status) as QuestionStatus
}