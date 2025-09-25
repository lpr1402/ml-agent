/**
 * Multi-Account Event Emitters
 * Funções auxiliares para emitir eventos WebSocket multi-conta
 */

import { emitToMLAccount } from '@/lib/websocket/emit-events'
import { Question, MLAccount } from '@prisma/client'

// Types for multi-account events
export type MultiAccountEventType = 'question:new' | 'question:answered' | 'question:failed' | 'metrics:updated'

export interface MultiAccountEvent {
  type: MultiAccountEventType
  accountId: string
  accountNickname: string
  organizationId: string
  data: any
  timestamp: string
}

// Re-export from event manager for backward compatibility
export async function emitMultiAccountEvent(event: MultiAccountEvent) {
  return emitToMLAccount(event.accountId, event.type, event.data)
}

export async function emitNewQuestionEvent(
  question: Question & { mlAccount?: MLAccount },
  account: MLAccount
) {
  const event: MultiAccountEvent = {
    type: 'question:new',
    accountId: account.id,
    accountNickname: account.nickname || 'Unknown',
    organizationId: account.organizationId,
    data: {
      questionId: question.id,
      mlQuestionId: question.mlQuestionId,
      text: question.text,
      itemTitle: question.itemTitle,
      itemPrice: question.itemPrice
    },
    timestamp: new Date().toISOString()
  }

  emitMultiAccountEvent(event)
}

export async function emitQuestionAnsweredEvent(
  question: Question & { mlAccount?: MLAccount },
  account: MLAccount,
  answer: string
) {
  const event: MultiAccountEvent = {
    type: 'question:answered',
    accountId: account.id,
    accountNickname: account.nickname || 'Unknown',
    organizationId: account.organizationId,
    data: {
      questionId: question.id,
      mlQuestionId: question.mlQuestionId,
      text: question.text,
      answer
    },
    timestamp: new Date().toISOString()
  }

  emitMultiAccountEvent(event)
}

export async function emitQuestionFailedEvent(
  question: Question & { mlAccount?: MLAccount },
  account: MLAccount,
  error: string
) {
  const event: MultiAccountEvent = {
    type: 'question:failed',
    accountId: account.id,
    accountNickname: account.nickname || 'Unknown',
    organizationId: account.organizationId,
    data: {
      questionId: question.id,
      mlQuestionId: question.mlQuestionId,
      error
    },
    timestamp: new Date().toISOString()
  }

  emitMultiAccountEvent(event)
}