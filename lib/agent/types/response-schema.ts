/**
 * Response Schema - Structured Output para Gemini 3.0 Pro
 * Garante formato consistente e validado
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

import { z } from 'zod'

/**
 * Schema Zod SIMPLIFICADO para resposta do agente
 * Apenas 2 campos essenciais: answer + confidence
 */
export const AgentResponseSchema = z.object({
  // Resposta final (pronta para envio ao ML)
  answer: z.string()
    .min(50, 'Resposta muito curta - mínimo 50 caracteres')
    .max(2000, 'Resposta muito longa - máximo 2000 caracteres')
    .describe('Resposta COMPLETA ao cliente, pronta para envio direto ao Mercado Livre. OBRIGATÓRIO incluir assinatura "Atenciosamente, Equipe [Nome]." no final. Use linguagem natural brasileira, seja específico e persuasivo.'),

  // Confiança na resposta (auto-avaliação do agente)
  confidence: z.number()
    .min(0)
    .max(1)
    .describe('Seu nível de confiança nesta resposta (0.0 a 1.0). Use: 0.9-1.0 = resposta direta com dados claros do produto, 0.7-0.9 = resposta com alguma inferência mas baseada em dados, 0.5-0.7 = resposta com incerteza ou falta de informações específicas.'),
})

/**
 * Tipo TypeScript derivado do schema
 */
export type AgentResponseStructured = z.infer<typeof AgentResponseSchema>

/**
 * JSON Schema SIMPLIFICADO para Gemini API
 * Apenas 2 campos: answer + confidence
 */
export const AgentResponseJSONSchema = {
  type: 'object',
  required: ['answer', 'confidence'],
  properties: {
    answer: {
      type: 'string',
      description: 'Resposta COMPLETA ao cliente, pronta para envio direto ao Mercado Livre. OBRIGATÓRIO incluir assinatura "Atenciosamente, Equipe [Nome]." no final. Use linguagem natural brasileira, seja específico e persuasivo.',
      minLength: 50,
      maxLength: 2000,
    },
    confidence: {
      type: 'number',
      description: 'Seu nível de confiança nesta resposta (0.0 a 1.0). Use: 0.9-1.0 = resposta direta com dados claros do produto, 0.7-0.9 = resposta com alguma inferência mas baseada em dados, 0.5-0.7 = resposta com incerteza ou falta de informações específicas.',
      minimum: 0,
      maximum: 1,
    },
  },
} as const
