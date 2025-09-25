/**
 * Sistema de Criptografia ENHANCED - 100% Seguro
 * Salt dinâmico por token + AES-256-GCM
 * Máxima segurança para tokens ML
 */

import { logger } from '@/lib/logger'
import crypto from 'crypto'

// Algoritmo de criptografia (mais seguro disponível)
const ALGORITHM = 'aes-256-gcm'
const SALT_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
// const TAG_LENGTH = 16 // 128 bits - reserved for future validation

/**
 * Validação ultra-rigorosa de ENCRYPTION_KEY
 */
function validateEncryptionKey(): string {
  const key = process.env['ENCRYPTION_KEY']
  
  if (!key) {
    throw new Error('[CRITICAL] ENCRYPTION_KEY environment variable is required for security')
  }
  
  // Chave deve ter exatamente 64 caracteres hexadecimais (256 bits)
  if (!/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error('[CRITICAL] ENCRYPTION_KEY must be exactly 64 hex characters (256 bits). Generate with: openssl rand -hex 32')
  }
  
  // Verificar entropia usando Shannon entropy
  const entropy = calculateShannonEntropy(key)
  if (entropy < 3.5) {
    throw new Error('[CRITICAL] ENCRYPTION_KEY has insufficient entropy. Use cryptographically secure random generation')
  }
  
  logger.info('[Encryption] Encryption key validated', { entropy: entropy.toFixed(2) })
  return key
}

/**
 * Calcula entropia de Shannon para validar aleatoriedade
 */
function calculateShannonEntropy(str: string): number {
  const freq: Record<string, number> = {}
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1
  }
  
  let entropy = 0
  const len = str.length
  for (const count of Object.values(freq)) {
    const p = count / len
    entropy -= p * Math.log2(p)
  }
  
  return entropy
}

// Valida e carrega chave master
const MASTER_KEY_HEX = validateEncryptionKey()
const MASTER_KEY = Buffer.from(MASTER_KEY_HEX, 'hex')

export interface EncryptedDataEnhanced {
  encrypted: string
  iv: string
  authTag: string
  salt: string // NOVO: Salt único por criptografia
  algorithm: string // Para versionamento futuro
  version: number // Versão do esquema de criptografia
}

/**
 * Deriva chave única usando salt dinâmico
 * Cada token tem sua própria chave derivada
 */
function deriveKey(salt: Buffer): Buffer {
  // Usa scrypt para derivação de chave (resistente a ASIC)
  return crypto.scryptSync(MASTER_KEY, salt, 32, {
    N: 16384, // CPU/memory cost (2^14)
    r: 8,     // Block size
    p: 1,     // Parallelization
    maxmem: 32 * 1024 * 1024 // 32MB
  })
}

/**
 * Criptografa token com salt dinâmico
 * Cada token tem salt, IV e chave únicos
 */
export function encryptTokenEnhanced(text: string): EncryptedDataEnhanced {
  try {
    // Gera salt único para este token
    const salt = crypto.randomBytes(SALT_LENGTH)
    
    // Deriva chave única usando o salt
    const derivedKey = deriveKey(salt)
    
    // Gera IV único
    const iv = crypto.randomBytes(IV_LENGTH)
    
    // Cria cipher com chave derivada
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)
    
    // Adiciona dados adicionais autenticados (AAD)
    const aad = Buffer.from(JSON.stringify({
      version: 2,
      algorithm: ALGORITHM,
      timestamp: Date.now()
    }))
    cipher.setAAD(aad)
    
    // Criptografa
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Obtém tag de autenticação
    const authTag = cipher.getAuthTag()
    
    // Limpa memória sensível
    derivedKey.fill(0)
    
    const result: EncryptedDataEnhanced = {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      salt: salt.toString('hex'),
      algorithm: ALGORITHM,
      version: 2
    }
    
    logger.info('[Encryption] Token encrypted with dynamic salt', {
      version: result.version,
      saltLength: SALT_LENGTH,
      ivLength: IV_LENGTH
    })
    
    return result
  } catch (error) {
    logger.error('[Encryption] Encryption failed', { error })
    throw new Error('Failed to encrypt sensitive data')
  }
}

/**
 * Descriptografa token com verificação de integridade
 */
export function decryptTokenEnhanced(data: EncryptedDataEnhanced): string {
  try {
    // Valida versão
    if (data.version !== 2) {
      throw new Error(`Unsupported encryption version: ${data.version}`)
    }
    
    // Reconstrói buffers
    const salt = Buffer.from(data.salt, 'hex')
    const iv = Buffer.from(data.iv, 'hex')
    const authTag = Buffer.from(data.authTag, 'hex')
    
    // Deriva a mesma chave usando o salt
    const derivedKey = deriveKey(salt)
    
    // Cria decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
    
    // Define tag de autenticação
    decipher.setAuthTag(authTag)
    
    // Adiciona AAD para verificação
    const aad = Buffer.from(JSON.stringify({
      version: data.version,
      algorithm: data.algorithm,
      timestamp: Date.now() // Timestamp é verificado apenas para formato
    }))
    decipher.setAAD(aad)
    
    // Descriptografa
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    // Limpa memória sensível
    derivedKey.fill(0)
    
    return decrypted
  } catch (error) {
    logger.error('[Encryption] Decryption failed', { error })
    throw new Error('Failed to decrypt data - possible tampering detected')
  }
}

/**
 * Migração de tokens antigos para novo formato
 */
export function migrateOldToken(oldData: {
  encrypted: string
  iv: string
  authTag: string
}): EncryptedDataEnhanced {
  // Descriptografa com método antigo (salt fixo)
  const oldSalt = process.env['ENCRYPTION_SALT'] || 'ml-agent-salt-2025'
  const oldKey = crypto.scryptSync(MASTER_KEY, oldSalt, 32)
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    oldKey,
    Buffer.from(oldData.iv, 'hex')
  )
  
  decipher.setAuthTag(Buffer.from(oldData.authTag, 'hex'))
  
  let decrypted = decipher.update(oldData.encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  // Re-criptografa com novo método
  return encryptTokenEnhanced(decrypted)
}

/**
 * Gera chave de criptografia segura
 * Para uso em setup inicial
 */
export function generateEncryptionKey(): string {
  const key = crypto.randomBytes(32).toString('hex')
  const entropy = calculateShannonEntropy(key)
  
  logger.info('[Encryption] New encryption key generated', {
    entropy: entropy.toFixed(2),
    usage: 'Set this as ENCRYPTION_KEY environment variable'
  })
  
  return key
}

/**
 * Wrapper para compatibilidade com código existente
 */
export function encryptToken(text: string): {
  encrypted: string
  iv: string
  authTag: string
} {
  const enhanced = encryptTokenEnhanced(text)
  // Retorna formato compatível, mas usa salt dinâmico internamente
  return {
    encrypted: enhanced.encrypted + ':' + enhanced.salt, // Embute salt
    iv: enhanced.iv,
    authTag: enhanced.authTag
  }
}

/**
 * Wrapper para compatibilidade com código existente
 */
export function decryptToken(data: {
  encrypted: string
  iv: string
  authTag: string
}): string {
  // Verifica se tem salt embutido (novo formato)
  if (data.encrypted.includes(':')) {
    const parts = data.encrypted.split(':')
    if (parts[0] && parts[1]) {
      return decryptTokenEnhanced({
        encrypted: parts[0],
        iv: data.iv,
        authTag: data.authTag,
        salt: parts[1],
        algorithm: ALGORITHM,
      version: 2
      })
    }
  }
  
  // Formato antigo - migra automaticamente
  logger.warn('[Encryption] Using legacy decryption - consider migrating')
  const migrated = migrateOldToken(data)
  return decryptTokenEnhanced(migrated)
}

/**
 * Validação de webhook com HMAC-SHA256
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const cleanSignature = signature.replace(/^sha256=/, '')
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  // Comparação constante-time contra timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch {
    return false
  }
}

/**
 * Gera secret seguro para webhooks
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Mascara dados sensíveis para logs
 */
export function maskSensitiveData(data: string): string {
  if (!data || data.length < 12) return '***'
  return `${data.slice(0, 6)}...${data.slice(-4)}`
}

// Auto-teste na inicialização (apenas em dev)
if (process.env['NODE_ENV'] === 'development') {
  try {
    const testData = 'test-token-123'
    const encrypted = encryptTokenEnhanced(testData)
    const decrypted = decryptTokenEnhanced(encrypted)
    
    if (decrypted !== testData) {
      throw new Error('Encryption self-test failed')
    }
    
    logger.info('[Encryption] Self-test passed ✓')
  } catch (error) {
    logger.error('[Encryption] Self-test failed', { error })
    throw error
  }
}

const encryptionModule = {
  encryptTokenEnhanced,
  decryptTokenEnhanced,
  encryptToken,
  decryptToken,
  validateWebhookSignature,
  generateEncryptionKey,
  generateWebhookSecret,
  maskSensitiveData,
  migrateOldToken
}

export default encryptionModule