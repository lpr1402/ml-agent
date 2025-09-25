/**
 * Sanitizador de logs para remover informações sensíveis
 * CRÍTICO: Previne exposição de tokens, senhas e dados sensíveis
 */

const SENSITIVE_PATTERNS = [
  // Bearer tokens
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, replacement: 'Bearer [REDACTED]' },
  // APP tokens do ML
  { pattern: /APP_USR-\d+-[a-f0-9-]+/g, replacement: 'APP_USR-[REDACTED]' },
  // TG tokens do ML
  { pattern: /TG-[a-f0-9-]+/g, replacement: 'TG-[REDACTED]' },
  // Passwords em JSON
  { pattern: /["']password["']\s*:\s*["'][^"']+["']/gi, replacement: '"password":"[REDACTED]"' },
  // Access tokens
  { pattern: /["']access_token["']\s*:\s*["'][^"']+["']/gi, replacement: '"access_token":"[REDACTED]"' },
  // Refresh tokens
  { pattern: /["']refresh_token["']\s*:\s*["'][^"']+["']/gi, replacement: '"refresh_token":"[REDACTED]"' },
  // API keys
  { pattern: /["']api_key["']\s*:\s*["'][^"']+["']/gi, replacement: '"api_key":"[REDACTED]"' },
  // Client secrets
  { pattern: /["']client_secret["']\s*:\s*["'][^"']+["']/gi, replacement: '"client_secret":"[REDACTED]"' },
  // OAuth codes
  { pattern: /code=[a-zA-Z0-9_\-]+/g, replacement: 'code=[REDACTED]' },
  // Email addresses (opcional, depende do contexto)
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
  // CPF/CNPJ (dados brasileiros)
  { pattern: /\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, replacement: '[DOC_REDACTED]' }
]

const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'api_key',
  'apiKey',
  'client_secret',
  'clientSecret',
  'authorization',
  'auth',
  'cookie',
  'session',
  'sessionToken',
  'private_key',
  'privateKey',
  'encryption_key',
  'encryptionKey',
  'salt',
  'hash',
  'signature',
  'certificate',
  'ssn',
  'cpf',
  'cnpj',
  'credit_card',
  'creditCard',
  'card_number',
  'cardNumber',
  'cvv',
  'pin'
]

/**
 * Sanitiza strings removendo padrões sensíveis
 */
function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') return str
  
  let sanitized = str
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement)
  }
  
  return sanitized
}

/**
 * Verifica se uma chave é sensível
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase()
  return SENSITIVE_KEYS.some(sensitiveKey => 
    lowerKey.includes(sensitiveKey.toLowerCase())
  )
}

/**
 * Sanitiza objetos recursivamente
 */
function sanitizeObject(obj: any, depth = 0, maxDepth = 10): any {
  // Previne recursão infinita
  if (depth > maxDepth) {
    return '[MAX_DEPTH_REACHED]'
  }
  
  if (obj === null || obj === undefined) {
    return obj
  }
  
  // Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogs(item, depth + 1))
  }
  
  // Objetos Date, RegExp, etc
  if (obj instanceof Date || obj instanceof RegExp) {
    return obj
  }
  
  // Objetos simples
  if (typeof obj === 'object') {
    const sanitized: any = {}
    
    for (const [key, value] of Object.entries(obj)) {
      // Redact valores de chaves sensíveis
      if (isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value)
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeForLogs(value, depth + 1)
      } else {
        sanitized[key] = value
      }
    }
    
    return sanitized
  }
  
  return obj
}

/**
 * Função principal de sanitização
 * @param data - Dados a serem sanitizados
 * @param depth - Profundidade atual (usado internamente)
 * @returns Dados sanitizados
 */
export function sanitizeForLogs(data: any, depth = 0): any {
  try {
    // Strings
    if (typeof data === 'string') {
      return sanitizeString(data)
    }
    
    // Objetos e arrays
    if (typeof data === 'object' && data !== null) {
      return sanitizeObject(data, depth)
    }
    
    // Primitivos (numbers, booleans, etc)
    return data
  } catch (_error) {
    // Em caso de erro, retorna indicação segura
    return '[SANITIZATION_ERROR]'
  }
}

/**
 * Máscara parcial para IDs e códigos (mostra início e fim)
 * @param value - Valor a ser mascarado
 * @param showChars - Quantos caracteres mostrar no início e fim
 */
export function maskSensitiveData(value: string | number, showChars = 4): string {
  const str = String(value)
  
  if (str.length <= showChars * 2) {
    return '*'.repeat(str.length)
  }
  
  const start = str.slice(0, showChars)
  const end = str.slice(-showChars)
  const middle = '*'.repeat(Math.max(4, str.length - showChars * 2))
  
  return `${start}${middle}${end}`
}

/**
 * Remove completamente campos sensíveis de um objeto
 * Útil para respostas públicas
 */
export function removeSensitiveFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  
  const cleaned = { ...obj }
  
  for (const key of Object.keys(cleaned)) {
    if (isSensitiveKey(key)) {
      delete cleaned[key]
    } else if (typeof cleaned[key] === 'object' && cleaned[key] !== null) {
      cleaned[key] = removeSensitiveFields(cleaned[key])
    }
  }
  
  return cleaned
}

/**
 * Cria um logger seguro que sanitiza automaticamente
 */
export function createSafeLogger(baseLogger: any) {
  return {
    debug: (message: string, data?: any) => 
      baseLogger.debug(message, sanitizeForLogs(data)),
    
    info: (message: string, data?: any) => 
      baseLogger.info(message, sanitizeForLogs(data)),
    
    warn: (message: string, data?: any) => 
      baseLogger.warn(message, sanitizeForLogs(data)),
    
    error: (message: string, data?: any) => 
      baseLogger.error(message, sanitizeForLogs(data))
  }
}

// Exporta um conjunto de utilitários para uso em todo o sistema
export const LogSanitizer = {
  sanitize: sanitizeForLogs,
  mask: maskSensitiveData,
  removeFields: removeSensitiveFields,
  createSafeLogger,
  isSensitiveKey
}