/**
 * Logger Service
 * Sistema de logging estruturado para produção
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

class Logger {
  private logLevel: LogLevel
  
  constructor() {
    this.logLevel = (process.env['LOG_LEVEL'] as LogLevel) || 'info'
  }
  
  private shouldLog(level: LogLevel): boolean {
    // Disable all logging during build phase
    if (process.env['NEXT_PHASE'] === 'phase-production-build' ||
        process.env['DISABLE_BUILD_LOGS'] === 'true') {
      return false
    }

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentIndex = levels.indexOf(this.logLevel)
    const targetIndex = levels.indexOf(level)
    return targetIndex >= currentIndex
  }
  
  private safeStringify(obj: any, depth = 0, maxDepth = 3): string {
    // Prevenir recursão infinita
    if (depth > maxDepth) {
      return '[Max Depth Reached]'
    }
    
    // Tipos primitivos
    if (obj === null) return 'null'
    if (obj === undefined) return 'undefined'
    if (typeof obj !== 'object') return String(obj)
    
    // Arrays
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]'
      const items = obj.slice(0, 10).map(item => 
        this.safeStringify(item, depth + 1, maxDepth)
      )
      if (obj.length > 10) items.push('...')
      return `[${items.join(', ')}]`
    }
    
    // Objetos
    try {
      const seen = new Set()
      const replacer = (key: string, value: any) => {
        // Ignorar funções
        if (typeof value === 'function') return '[Function]'
        
        // Detectar referências circulares
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]'
          seen.add(value)
        }
        
        // Limitar strings grandes
        if (typeof value === 'string' && value.length > 500) {
          return value.substring(0, 500) + '...[truncated]'
        }
        
        // Sanitizar dados sensíveis
        if (key && typeof key === 'string') {
          const lowerKey = key.toLowerCase()
          if (lowerKey.includes('password') || 
              lowerKey.includes('secret') || 
              lowerKey.includes('token') ||
              lowerKey.includes('key')) {
            return '[REDACTED]'
          }
        }
        
        return value
      }
      
      return JSON.stringify(obj, replacer, 2)
    } catch (_error) {
      return '[Stringify Error]'
    }
  }
  
  private format(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    
    // Construir log básico
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`
    
    // Adicionar contexto se existir
    if (context && Object.keys(context).length > 0) {
      const contextStr = this.safeStringify(context)
      logMessage += ` ${contextStr}`
    }
    
    return logMessage
  }
  
  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return
    
    const formattedMessage = this.format(level, message, context)
    
    // Output baseado no nível
    switch (level) {
      case 'debug':
      case 'info':
        console.log(formattedMessage)
        break
      case 'warn':
        console.warn(formattedMessage)
        break
      case 'error':
        console.error(formattedMessage)
        break
    }
  }
  
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }
  
  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }
  
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }
  
  error(message: string, context?: LogContext): void {
    this.log('error', message, context)
  }
}

// Singleton instance
export const logger = new Logger()

// Helper function para sanitização
export function sanitizeForLogs(data: any): any {
  if (!data) return data
  
  if (typeof data === 'string') {
    // Remover tokens e segredos de strings
    return data
      .replace(/Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g, 'Bearer [REDACTED]')
      .replace(/[a-f0-9]{64}/gi, '[HASH_REDACTED]')
      .replace(/[A-Za-z0-9+\/]{40,}/g, '[TOKEN_REDACTED]')
  }
  
  if (typeof data === 'object') {
    const sanitized: any = Array.isArray(data) ? [] : {}
    
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        const lowerKey = String(key).toLowerCase()
        
        // Pular campos sensíveis
        if (lowerKey.includes('password') || 
            lowerKey.includes('secret') || 
            lowerKey.includes('token') ||
            lowerKey.includes('key') ||
            lowerKey.includes('authorization')) {
          sanitized[key] = '[REDACTED]'
        } else {
          sanitized[key] = sanitizeForLogs(data[key])
        }
      }
    }
    
    return sanitized
  }
  
  return data
}