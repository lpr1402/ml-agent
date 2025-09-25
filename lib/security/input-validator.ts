/**
 * Validação de Entrada Robusta
 * Previne XSS, SQL Injection e outros ataques
 */

import DOMPurify from 'isomorphic-dompurify'

/**
 * Valida ID de pergunta do Mercado Livre
 * Formato: número de até 15 dígitos
 */
export function validateMLQuestionId(id: string): boolean {
  if (!id) return false
  // ML question IDs são numéricos
  return /^\d{1,15}$/.test(id)
}

/**
 * Valida ID de item do Mercado Livre 
 * Formato: MLB/MLA/MLM seguido de números
 */
export function validateMLItemId(id: string): boolean {
  if (!id) return false
  // Formato: MLB1234567890
  return /^ML[A-Z]\d{8,12}$/.test(id)
}

/**
 * Valida ID de usuário do Mercado Livre
 */
export function validateMLUserId(id: string): boolean {
  if (!id) return false
  // User IDs são numéricos
  return /^\d{1,15}$/.test(id)
}

/**
 * Sanitiza texto para prevenir XSS
 * Remove scripts, eventos e HTML perigoso
 */
export function sanitizeText(text: string): string {
  if (!text) return ''
  
  // Remove tags HTML perigosas
  const cleaned = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  })
  
  // Remove caracteres de controle
  return cleaned.replace(/[\x00-\x1F\x7F]/g, '')
}

/**
 * Sanitiza resposta para pergunta
 * OBRIGATÓRIO: Mercado Livre limita respostas a 2000 caracteres
 */
export function sanitizeAnswerText(text: string): string {
  if (!text) return ''
  
  // Permite apenas tags seguras para respostas
  const cleaned = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'br', 'p'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  })
  
  // CRÍTICO: ML API rejeita respostas > 2000 caracteres
  if (cleaned.length > 2000) {
    // Trunca mantendo palavras completas
    const truncated = cleaned.substring(0, 1997) // Deixa espaço para "..."
    const lastSpace = truncated.lastIndexOf(' ')
    return lastSpace > 1900 ? truncated.substring(0, lastSpace) + '...' : truncated + '...'
  }
  
  return cleaned
}

/**
 * Valida tamanho da resposta para ML API
 */
export function validateAnswerLength(text: string): { valid: boolean; length: number; message?: string } {
  const length = text.length
  
  if (length === 0) {
    return { valid: false, length, message: 'Resposta não pode estar vazia' }
  }
  
  if (length > 2000) {
    return { valid: false, length, message: `Resposta muito longa (${length}/2000 caracteres)` }
  }
  
  if (length < 10) {
    return { valid: false, length, message: 'Resposta muito curta (mínimo 10 caracteres)' }
  }
  
  return { valid: true, length }
}

/**
 * Valida e sanitiza parâmetros de paginação
 */
export interface PaginationParams {
  limit: number
  offset: number
}

export function validatePagination(
  limit?: string | number,
  offset?: string | number
): PaginationParams {
  const parsedLimit = typeof limit === 'string' ? parseInt(limit) : (limit || 20)
  const parsedOffset = typeof offset === 'string' ? parseInt(offset) : (offset || 0)
  
  return {
    limit: Math.min(Math.max(1, parsedLimit || 20), 100), // Max 100 items
    offset: Math.max(0, parsedOffset || 0)
  }
}

/**
 * Valida período de datas
 */
export function validateDateRange(
  from?: string,
  to?: string
): { from: Date; to: Date } | null {
  try {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const toDate = to ? new Date(to) : new Date()
    
    // Validar que as datas são válidas
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return null
    }
    
    // From não pode ser depois de To
    if (fromDate > toDate) {
      return null
    }
    
    // Limitar range máximo a 1 ano
    const maxRange = 365 * 24 * 60 * 60 * 1000
    if (toDate.getTime() - fromDate.getTime() > maxRange) {
      return null
    }
    
    return { from: fromDate, to: toDate }
  } catch {
    return null
  }
}

/**
 * Valida webhook payload do N8N
 */
export interface N8NWebhookPayload {
  questionId: string
  answer: string
  confidence?: number
  metadata?: Record<string, any>
}

export function validateN8NPayload(payload: any): N8NWebhookPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  
  const { questionId, answer, confidence, metadata } = payload
  
  // Validações obrigatórias
  if (!validateMLQuestionId(questionId)) {
    return null
  }
  
  if (!answer || typeof answer !== 'string') {
    return null
  }
  
  // Sanitizar resposta
  const sanitizedAnswer = sanitizeAnswerText(answer)
  if (!sanitizedAnswer) {
    return null
  }
  
  // Validar confidence se presente
  const validConfidence = confidence !== undefined
    ? Math.min(Math.max(0, parseFloat(confidence) || 0), 100)
    : undefined
  
  const result: N8NWebhookPayload = {
    questionId,
    answer: sanitizedAnswer
  }
  
  if (validConfidence !== undefined) {
    result.confidence = validConfidence
  }
  
  if (metadata) {
    result.metadata = metadata
  }
  
  return result
}

/**
 * Valida organizationId (UUID)
 */
export function validateOrganizationId(id: string): boolean {
  if (!id) return false
  // UUID v4 format
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

/**
 * Escape HTML entities para display seguro
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  }
  return text.replace(/[&<>"'/]/g, char => map[char] || char)
}