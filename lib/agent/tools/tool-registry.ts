/**
 * Tool Registry - Gerenciamento centralizado de tools para o agente
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

import { logger } from '@/lib/logger'
import type { AgentTool, ToolContext, ToolResult, ToolCall } from '../types/agent-types'

/**
 * Registry centralizado de tools com validação e execução
 */
export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map()
  private executionStats: Map<string, ToolExecutionStats> = new Map()

  /**
   * Registra uma nova tool
   */
  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      logger.warn('[ToolRegistry] Tool already registered, overwriting', {
        toolName: tool.name,
      })
    }

    this.tools.set(tool.name, tool)
    this.executionStats.set(tool.name, {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTime: 0,
      lastExecutedAt: null,
    })

    logger.info('[ToolRegistry] Tool registered', {
      toolName: tool.name,
      description: tool.description,
    })
  }

  /**
   * Registra múltiplas tools de uma vez
   */
  registerMany(tools: AgentTool[]): void {
    tools.forEach((tool) => this.register(tool))
    logger.info('[ToolRegistry] Multiple tools registered', {
      count: tools.length,
    })
  }

  /**
   * Retorna uma tool pelo nome
   */
  getTool(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  /**
   * Retorna todas as tools registradas
   */
  getAllTools(): AgentTool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Retorna tools no formato Gemini Function Declarations
   */
  getGeminiFunctionDeclarations(): any[] {
    return this.getAllTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }))
  }

  /**
   * Executa uma tool com error handling e retry
   */
  async executeTool(
    toolCall: ToolCall,
    context: ToolContext,
    options: {
      maxRetries?: number
      retryDelay?: number
    } = {}
  ): Promise<ToolResult> {
    const { maxRetries = 3, retryDelay = 1000 } = options
    const startTime = Date.now()

    const tool = this.getTool(toolCall.name)

    if (!tool) {
      const error = `Tool "${toolCall.name}" not found in registry`
      logger.error('[ToolRegistry] Tool not found', {
        toolName: toolCall.name,
        availableTools: Array.from(this.tools.keys()),
      })

      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        status: 'error',
        result: null,
        error,
        executionTime: Date.now() - startTime,
        timestamp: Date.now(),
      }
    }

    // Validar parâmetros
    try {
      this.validateParameters(tool, toolCall.parameters)
    } catch (validationError: any) {
      logger.error('[ToolRegistry] Parameter validation failed', {
        toolName: toolCall.name,
        error: validationError.message,
        parameters: toolCall.parameters,
      })

      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        status: 'error',
        result: null,
        error: `Parameter validation failed: ${validationError.message}`,
        executionTime: Date.now() - startTime,
        timestamp: Date.now(),
      }
    }

    // Executar com retry
    let lastError: Error | null = null
    let attempt = 0

    while (attempt < maxRetries) {
      attempt++

      try {
        logger.info('[ToolRegistry] Executing tool', {
          toolName: toolCall.name,
          attempt,
          maxRetries,
          parameters: toolCall.parameters,
        })

        const result = await tool.execute(toolCall.parameters, context)

        const executionTime = Date.now() - startTime

        // Atualizar estatísticas
        this.updateStats(toolCall.name, true, executionTime)

        logger.info('[ToolRegistry] Tool executed successfully', {
          toolName: toolCall.name,
          executionTime,
          resultSize: JSON.stringify(result).length,
        })

        return {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          status: 'success',
          result,
          error: null,
          executionTime,
          timestamp: Date.now(),
        }
      } catch (error: any) {
        lastError = error

        logger.warn('[ToolRegistry] Tool execution failed', {
          toolName: toolCall.name,
          attempt,
          maxRetries,
          error: error.message,
        })

        // Verificar se é erro retryable
        if (!this.isRetryableError(error)) {
          break
        }

        // Aguardar antes de retry
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1) // Exponential backoff
          logger.info('[ToolRegistry] Retrying after delay', {
            toolName: toolCall.name,
            delay,
          })
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    // Falha após todas as tentativas
    const executionTime = Date.now() - startTime
    this.updateStats(toolCall.name, false, executionTime)

    logger.error('[ToolRegistry] Tool execution failed after all retries', {
      toolName: toolCall.name,
      attempts: attempt,
      error: lastError?.message,
    })

    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      status: 'error',
      result: null,
      error: lastError?.message || 'Unknown error',
      executionTime,
      timestamp: Date.now(),
    }
  }

  /**
   * Executa múltiplas tools em paralelo
   */
  async executeToolsParallel(
    toolCalls: ToolCall[],
    context: ToolContext
  ): Promise<ToolResult[]> {
    logger.info('[ToolRegistry] Executing tools in parallel', {
      count: toolCalls.length,
      tools: toolCalls.map((tc) => tc.name),
    })

    const results = await Promise.all(
      toolCalls.map((toolCall) => this.executeTool(toolCall, context))
    )

    const successCount = results.filter((r) => r.status === 'success').length
    const errorCount = results.filter((r) => r.status === 'error').length

    logger.info('[ToolRegistry] Parallel execution completed', {
      total: results.length,
      successful: successCount,
      failed: errorCount,
    })

    return results
  }

  /**
   * Valida parâmetros contra schema da tool
   */
  private validateParameters(tool: AgentTool, parameters: Record<string, any>): void {
    const schema = tool.parameters

    // Verificar required fields
    for (const requiredField of schema.required) {
      if (!(requiredField in parameters)) {
        throw new Error(`Missing required parameter: ${requiredField}`)
      }
    }

    // Validar tipos dos parâmetros
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const paramSchema = schema.properties[paramName]

      if (!paramSchema) {
        logger.warn('[ToolRegistry] Unknown parameter', {
          toolName: tool.name,
          paramName,
        })
        continue
      }

      // Validação básica de tipo
      const actualType = typeof paramValue
      const expectedType = paramSchema.type

      if (expectedType === 'string' && actualType !== 'string') {
        throw new Error(`Parameter "${paramName}" must be a string, got ${actualType}`)
      }

      if (expectedType === 'number' && actualType !== 'number') {
        throw new Error(`Parameter "${paramName}" must be a number, got ${actualType}`)
      }

      if (expectedType === 'boolean' && actualType !== 'boolean') {
        throw new Error(`Parameter "${paramName}" must be a boolean, got ${actualType}`)
      }

      if (expectedType === 'array' && !Array.isArray(paramValue)) {
        throw new Error(`Parameter "${paramName}" must be an array`)
      }

      // Validar enum
      if (paramSchema.enum && !paramSchema.enum.includes(paramValue)) {
        throw new Error(
          `Parameter "${paramName}" must be one of: ${paramSchema.enum.join(', ')}`
        )
      }
    }
  }

  /**
   * Determina se um erro é retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableCodes = [429, 500, 502, 503, 504]
    const retryableMessages = ['timeout', 'network', 'econnrefused', 'rate limit']

    // Verificar código de status
    if (error.status && retryableCodes.includes(error.status)) {
      return true
    }

    // Verificar mensagem de erro
    const errorMessage = error.message?.toLowerCase() || ''
    return retryableMessages.some((msg) => errorMessage.includes(msg))
  }

  /**
   * Atualiza estatísticas de execução
   */
  private updateStats(toolName: string, success: boolean, executionTime: number): void {
    const stats = this.executionStats.get(toolName)

    if (!stats) return

    stats.totalExecutions++

    if (success) {
      stats.successfulExecutions++
    } else {
      stats.failedExecutions++
    }

    stats.totalExecutionTime += executionTime
    stats.lastExecutedAt = new Date()

    this.executionStats.set(toolName, stats)
  }

  /**
   * Retorna estatísticas de uma tool específica
   */
  getToolStats(toolName: string): ToolExecutionStats | null {
    return this.executionStats.get(toolName) || null
  }

  /**
   * Retorna estatísticas de todas as tools
   */
  getAllStats(): Map<string, ToolExecutionStats> {
    return new Map(this.executionStats)
  }

  /**
   * Limpa estatísticas
   */
  clearStats(): void {
    for (const toolName of this.tools.keys()) {
      this.executionStats.set(toolName, {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalExecutionTime: 0,
        lastExecutedAt: null,
      })
    }

    logger.info('[ToolRegistry] Stats cleared')
  }
}

/**
 * Estatísticas de execução de tool
 */
interface ToolExecutionStats {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  totalExecutionTime: number
  lastExecutedAt: Date | null
}

// Export singleton instance
export const toolRegistry = new ToolRegistry()
