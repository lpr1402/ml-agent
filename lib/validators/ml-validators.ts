/**
 * Validadores para APIs do Mercado Livre
 * Garante integridade e segurança dos dados antes de enviar para ML
 */

import { z } from 'zod'

// ========== SCHEMAS DE ITEMS ==========

/**
 * Schema para atualização de item
 * Baseado na documentação oficial do ML
 */
export const ItemUpdateSchema = z.object({
  // Título - máximo 60 caracteres
  title: z.string()
    .min(1, 'Título não pode estar vazio')
    .max(60, 'Título deve ter no máximo 60 caracteres')
    .optional(),
  
  // Preço - deve ser positivo e razoável
  price: z.number()
    .positive('Preço deve ser positivo')
    .max(99999999, 'Preço muito alto')
    .optional(),
  
  // Quantidade disponível
  available_quantity: z.number()
    .int('Quantidade deve ser um número inteiro')
    .min(0, 'Quantidade não pode ser negativa')
    .max(999999, 'Quantidade muito alta')
    .optional(),
  
  // Status do item
  status: z.enum(['active', 'paused', 'closed'])
    .optional(),
  
  // Condição do item
  condition: z.enum(['new', 'used', 'refurbished'])
    .optional(),
  
  // Descrição - texto puro ou HTML
  description: z.object({
    plain_text: z.string().max(50000).optional(),
    text: z.string().max(50000).optional()
  }).optional(),
  
  // Fotos - máximo 12
  pictures: z.array(
    z.object({
      source: z.string().url('URL da imagem inválida'),
      id: z.string().optional()
    })
  ).max(12, 'Máximo 12 fotos permitidas')
    .optional(),
  
  // Vídeo
  video_id: z.string()
    .regex(/^[A-Za-z0-9_-]+$/, 'ID de vídeo inválido')
    .optional(),
  
  // Atributos do produto
  attributes: z.array(
    z.object({
      id: z.string(),
      value_name: z.string().optional(),
      value_id: z.string().optional(),
      values: z.array(z.object({
        id: z.string().optional(),
        name: z.string().optional()
      })).optional()
    })
  ).optional(),
  
  // Variações
  variations: z.array(
    z.object({
      id: z.number().optional(),
      price: z.number().positive().optional(),
      available_quantity: z.number().int().min(0).optional(),
      attribute_combinations: z.array(z.object({
        id: z.string(),
        value_id: z.string().optional(),
        value_name: z.string().optional()
      })).optional()
    })
  ).optional(),
  
  // Garantia
  warranty: z.string()
    .max(500, 'Garantia deve ter no máximo 500 caracteres')
    .optional(),
  
  // Configurações de envio
  shipping: z.object({
    mode: z.enum(['me1', 'me2', 'not_specified']).optional(),
    local_pick_up: z.boolean().optional(),
    free_shipping: z.boolean().optional(),
    methods: z.array(z.number()).optional(),
    dimensions: z.string().optional(),
    tags: z.array(z.string()).optional()
  }).optional(),
  
  // Termos de venda
  sale_terms: z.array(z.object({
    id: z.string(),
    value_name: z.string().optional(),
    value_id: z.string().optional()
  })).optional(),
  
  // Canais de venda
  channels: z.array(z.string()).optional(),
  
  // Tipo de listagem
  listing_type_id: z.enum(['gold_special', 'gold_pro', 'gold_premium', 'free', 'bronze']).optional(),
  
  // Modo de compra
  buying_mode: z.enum(['buy_it_now', 'auction']).optional(),
  
  // Categoria (raramente pode ser alterada após criação)
  category_id: z.string()
    .regex(/^ML[A-Z]\d+$/, 'ID de categoria inválido')
    .optional(),
  
  // Aceita Mercado Pago
  accepts_mercadopago: z.boolean().optional()
})

/**
 * Schema para criação de novo item
 */
export const ItemCreateSchema = z.object({
  title: z.string()
    .min(1, 'Título é obrigatório')
    .max(60, 'Título deve ter no máximo 60 caracteres'),
  
  category_id: z.string()
    .regex(/^ML[A-Z]\d+$/, 'ID de categoria inválido'),
  
  price: z.number()
    .positive('Preço deve ser positivo')
    .max(99999999, 'Preço muito alto'),
  
  currency_id: z.enum(['BRL', 'ARS', 'USD', 'MXN', 'CLP', 'UYU', 'COP', 'PEN']),
  
  available_quantity: z.number()
    .int('Quantidade deve ser um número inteiro')
    .min(1, 'Quantidade mínima é 1')
    .max(999999, 'Quantidade muito alta'),
  
  buying_mode: z.enum(['buy_it_now', 'auction']),
  
  condition: z.enum(['new', 'used', 'refurbished']),
  
  listing_type_id: z.enum(['gold_special', 'gold_pro', 'gold_premium', 'free', 'bronze']),
  
  pictures: z.array(
    z.object({
      source: z.string().url('URL da imagem inválida')
    })
  ).min(1, 'Pelo menos uma foto é obrigatória')
    .max(12, 'Máximo 12 fotos permitidas'),
  
  description: z.object({
    plain_text: z.string().max(50000).optional(),
    text: z.string().max(50000).optional()
  }).optional(),
  
  attributes: z.array(
    z.object({
      id: z.string(),
      value_name: z.string().optional(),
      value_id: z.string().optional()
    })
  ).optional()
})

// ========== SCHEMAS DE PERGUNTAS ==========

/**
 * Schema para responder pergunta
 */
export const AnswerQuestionSchema = z.object({
  question_id: z.string()
    .regex(/^\d+$/, 'ID de pergunta inválido'),
  
  text: z.string()
    .min(1, 'Resposta não pode estar vazia')
    .max(2000, 'Resposta deve ter no máximo 2000 caracteres')
})

/**
 * Schema para filtros de busca de perguntas
 */
export const QuestionsFilterSchema = z.object({
  status: z.enum(['UNANSWERED', 'ANSWERED', 'CLOSED_UNANSWERED', 'UNDER_REVIEW'])
    .optional(),
  
  item_id: z.string()
    .regex(/^ML[A-Z]\d+$/, 'ID de item inválido')
    .optional(),
  
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(50),
  
  offset: z.number()
    .int()
    .min(0)
    .default(0),
  
  sort: z.enum(['date_desc', 'date_asc'])
    .default('date_desc')
})

// ========== SCHEMAS DE PEDIDOS ==========

/**
 * Schema para atualização de status de pedido
 */
export const OrderUpdateSchema = z.object({
  order_id: z.string()
    .regex(/^\d+$/, 'ID de pedido inválido'),
  
  status: z.enum(['paid', 'packed', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'])
    .optional(),
  
  substatus: z.string().optional(),
  
  tracking_number: z.string()
    .max(100, 'Número de rastreio muito longo')
    .optional(),
  
  tracking_method: z.string()
    .max(100, 'Método de rastreio muito longo')
    .optional()
})

/**
 * Schema para mensagem no pedido
 */
export const OrderMessageSchema = z.object({
  order_id: z.string()
    .regex(/^\d+$/, 'ID de pedido inválido'),
  
  message: z.string()
    .min(1, 'Mensagem não pode estar vazia')
    .max(2000, 'Mensagem deve ter no máximo 2000 caracteres'),
  
  attachments: z.array(
    z.string().url('URL de anexo inválida')
  ).max(5, 'Máximo 5 anexos permitidos')
    .optional()
})

// ========== SCHEMAS DE USUÁRIO ==========

/**
 * Schema para atualização de perfil
 */
export const UserProfileUpdateSchema = z.object({
  first_name: z.string()
    .max(100, 'Nome muito longo')
    .optional(),
  
  last_name: z.string()
    .max(100, 'Sobrenome muito longo')
    .optional(),
  
  phone: z.object({
    area_code: z.string().regex(/^\d{2,4}$/).optional(),
    number: z.string().regex(/^\d{6,12}$/).optional(),
    extension: z.string().max(10).optional(),
    verified: z.boolean().optional()
  }).optional(),
  
  logo: z.string()
    .url('URL do logo inválida')
    .optional()
})

// ========== FUNÇÕES DE VALIDAÇÃO ==========

/**
 * Valida dados usando um schema Zod
 * @throws {ValidationError} se os dados são inválidos
 */
export function validateMLRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
      
      throw new ValidationError(
        `Validation failed: ${errors.map(e => `${e.path}: ${e.message}`).join(', ')}`,
        errors
      )
    }
    throw error
  }
}

/**
 * Valida dados e retorna resultado sem throw
 */
export function safeValidateMLRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Array<{ path: string; message: string }> } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.errors.map(e => ({
    path: e.path.join('.'),
    message: e.message
  }))
  
  return { success: false, errors }
}

/**
 * Sanitiza dados removendo campos não permitidos
 */
export function sanitizeMLRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | null {
  try {
    // Parse com modo strip (remove campos extras)
    return schema.parse(data)
  } catch {
    return null
  }
}

// ========== CLASSES DE ERRO ==========

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ path: string; message: string }> = []
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

// ========== MIDDLEWARE DE VALIDAÇÃO ==========

/**
 * Cria um middleware de validação para Next.js
 */
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return async (req: Request): Promise<T | Response> => {
    try {
      const body = await req.json()
      return validateMLRequest(schema, body)
    } catch (error) {
      if (error instanceof ValidationError) {
        return new Response(
          JSON.stringify({
            error: 'Validation failed',
            details: error.errors
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }
}

// ========== VALIDADORES ESPECÍFICOS ==========

/**
 * Valida CPF brasileiro
 */
export function isValidCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]/g, '')
  
  if (cpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cpf)) return false
  
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i)
  }
  
  let digit = 11 - (sum % 11)
  if (digit >= 10) digit = 0
  if (digit !== parseInt(cpf.charAt(9))) return false
  
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i)
  }
  
  digit = 11 - (sum % 11)
  if (digit >= 10) digit = 0
  if (digit !== parseInt(cpf.charAt(10))) return false
  
  return true
}

/**
 * Valida CNPJ brasileiro
 */
export function isValidCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/[^\d]/g, '')
  
  if (cnpj.length !== 14) return false
  if (/^(\d)\1+$/.test(cnpj)) return false
  
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj.charAt(i)) * (weights1[i] || 0)
  }
  
  let digit = 11 - (sum % 11)
  if (digit >= 10) digit = 0
  if (digit !== parseInt(cnpj.charAt(12))) return false
  
  sum = 0
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj.charAt(i)) * (weights2[i] || 0)
  }
  
  digit = 11 - (sum % 11)
  if (digit >= 10) digit = 0
  if (digit !== parseInt(cnpj.charAt(13))) return false
  
  return true
}

// Exportar todos os schemas e funções
export const MLValidators = {
  schemas: {
    ItemUpdate: ItemUpdateSchema,
    ItemCreate: ItemCreateSchema,
    AnswerQuestion: AnswerQuestionSchema,
    QuestionsFilter: QuestionsFilterSchema,
    OrderUpdate: OrderUpdateSchema,
    OrderMessage: OrderMessageSchema,
    UserProfileUpdate: UserProfileUpdateSchema
  },
  validate: validateMLRequest,
  safeValidate: safeValidateMLRequest,
  sanitize: sanitizeMLRequest,
  createMiddleware: createValidationMiddleware,
  utils: {
    isValidCPF,
    isValidCNPJ
  }
}