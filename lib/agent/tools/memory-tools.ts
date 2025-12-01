/**
 * Memory Tools - Tools para memória e aprendizado do agente
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { AgentTool, ToolContext } from '../types/agent-types'

/**
 * Tool: Salvar padrão aprendido na memória
 */
export const saveLearnedPatternTool: AgentTool = {
  name: 'save_learned_pattern',
  description: `Salva um padrão ou preferência aprendido na memória de longo prazo.
Use quando identificar:
- Preferências de resposta da organização
- Padrões que funcionam bem
- Informações específicas do negócio
- Guidelines personalizados

A memória será usada em futuras interações para melhorar respostas.`,

  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Chave descritiva do padrão (ex: "shipping_response_style")',
      },
      value: {
        type: 'string',
        description: 'Valor ou descrição do padrão aprendido',
      },
      confidence: {
        type: 'number',
        description: 'Nível de confiança deste padrão (0.0 a 1.0)',
      },
      source: {
        type: 'string',
        description: 'Origem do aprendizado (ex: "user_edit", "successful_response")',
      },
    },
    required: ['key', 'value', 'confidence', 'source'],
  },

  async execute(
    params: { key: string; value: string; confidence: number; source: string },
    context: ToolContext
  ) {
    try {
      logger.info('[MemoryTools] Saving learned pattern', {
        key: params.key,
        organizationId: context.organizationId,
        source: params.source,
      })

      // Verificar se já existe
      const existing = await prisma.agentMemory.findFirst({
        where: {
          organizationId: context.organizationId,
          key: params.key,
        },
      })

      if (existing) {
        // Atualizar memória existente
        await prisma.agentMemory.update({
          where: { id: existing.id },
          data: {
            value: params.value,
            confidence: params.confidence,
            usageCount: existing.usageCount + 1,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          },
        })

        logger.info('[MemoryTools] Pattern updated', {
          key: params.key,
          previousConfidence: existing.confidence,
          newConfidence: params.confidence,
        })
      } else {
        // Criar nova memória
        await prisma.agentMemory.create({
          data: {
            organizationId: context.organizationId,
            mlAccountId: context.mlAccountId,
            memoryType: 'pattern',
            key: params.key,
            value: params.value,
            confidence: params.confidence,
            source: params.source,
            usageCount: 0,
            embedding: Prisma.JsonNull,
            embeddingDimensions: null,
          },
        })

        logger.info('[MemoryTools] New pattern saved', {
          key: params.key,
        })
      }

      return {
        success: true,
        message: `Pattern "${params.key}" saved to long-term memory`,
        wasUpdate: !!existing,
      }
    } catch (error: any) {
      logger.error('[MemoryTools] Error saving pattern', {
        key: params.key,
        error: error.message,
      })

      return {
        success: false,
        error: error.message,
      }
    }
  },
}

/**
 * Tool: Buscar memórias relevantes
 */
export const searchMemoryTool: AgentTool = {
  name: 'search_memory',
  description: `Busca na memória de longo prazo por padrões e preferências relevantes.
Use para encontrar:
- Como a organização prefere responder certos tipos de pergunta
- Padrões de sucesso em situações similares
- Guidelines específicos do negócio
- Preferências de comunicação`,

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'O que buscar na memória',
      },
      memoryType: {
        type: 'string',
        description: 'Tipo de memória (pattern, preference, success, failure)',
      },
      limit: {
        type: 'number',
        description: 'Número máximo de resultados (default: 5)',
      },
    },
    required: ['query'],
  },

  async execute(
    params: { query: string; memoryType?: string; limit?: number },
    context: ToolContext
  ) {
    try {
      const limit = params.limit || 5

      logger.info('[MemoryTools] Searching memory', {
        query: params.query,
        type: params.memoryType,
        organizationId: context.organizationId,
      })

      // Construir where clause
      const whereClause: any = {
        organizationId: context.organizationId,
        OR: [
          {
            key: {
              contains: params.query,
            },
          },
          {
            value: {
              contains: params.query,
            },
          },
        ],
      }

      if (params.memoryType) {
        whereClause.memoryType = params.memoryType
      }

      const memories = await prisma.agentMemory.findMany({
        where: whereClause,
        take: limit,
        orderBy: [
          { confidence: 'desc' },
          { usageCount: 'desc' },
          { updatedAt: 'desc' },
        ],
      })

      logger.info('[MemoryTools] Memories found', {
        count: memories.length,
      })

      return {
        success: true,
        memories: memories.map((m) => ({
          key: m.key,
          value: m.value,
          confidence: m.confidence,
          usageCount: m.usageCount,
          source: m.source,
          lastUsed: m.lastUsedAt,
        })),
        count: memories.length,
      }
    } catch (error: any) {
      logger.error('[MemoryTools] Error searching memory', {
        query: params.query,
        error: error.message,
      })

      return {
        success: false,
        error: error.message,
        memories: [],
        count: 0,
      }
    }
  },
}

/**
 * Tool: Buscar preferências da organização
 */
export const getOrganizationPreferencesTool: AgentTool = {
  name: 'get_organization_preferences',
  description: `Busca preferências configuradas pela organização.
Retorna:
- Estilo de resposta (formal, casual, amigável)
- Se deve usar emojis
- Tamanho máximo de resposta
- Guidelines personalizados

Use no INÍCIO do processamento para adaptar resposta ao estilo da organização.`,

  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute(_params: Record<string, never>, context: ToolContext) {
    try {
      logger.info('[MemoryTools] Fetching organization preferences', {
        organizationId: context.organizationId,
      })

      // Buscar preferências gerais
      const preferences = await prisma.agentMemory.findMany({
        where: {
          organizationId: context.organizationId,
          memoryType: 'preference',
        },
        orderBy: {
          confidence: 'desc',
        },
      })

      // Construir objeto de preferências
      const prefs: Record<string, any> = {}

      preferences.forEach((pref) => {
        prefs[pref.key] = pref.value
      })

      logger.info('[MemoryTools] Preferences retrieved', {
        count: preferences.length,
      })

      return {
        success: true,
        preferences: prefs,
        count: preferences.length,
      }
    } catch (error: any) {
      logger.error('[MemoryTools] Error fetching preferences', {
        organizationId: context.organizationId,
        error: error.message,
      })

      return {
        success: false,
        error: error.message,
        preferences: {},
      }
    }
  },
}

/**
 * Retorna todas as memory tools
 */
export function getAllMemoryTools(): AgentTool[] {
  return [saveLearnedPatternTool, searchMemoryTool, getOrganizationPreferencesTool]
}
