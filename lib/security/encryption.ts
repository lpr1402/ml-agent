/**
 * Sistema de Criptografia para Tokens do Mercado Livre
 * Obrigatório para segurança segundo documentação ML
 * Usa AES-256-GCM com autenticação
 */

import { logger } from '@/lib/logger'
import crypto from 'crypto'
// import { keyManager } - unused from './key-manager'

// A chave deve ter exatamente 32 bytes para AES-256
const ALGORITHM = 'aes-256-gcm'

// Usa KeyManager para obter chaves seguras com rotação automática
let KEY: Buffer | null = null

// Inicializa a chave na primeira vez que for usada
function ensureKeyInitialized(): Buffer {
  if (!KEY) {
    // Usa diretamente a chave do ambiente
    KEY = deriveKeyFromEnvironment()
  }
  return KEY
}

// Fallback: deriva chave do ambiente (para compatibilidade)
function deriveKeyFromEnvironment(): Buffer {
  const envKey = process.env['ENCRYPTION_KEY']
  
  if (!envKey) {
    // Em desenvolvimento, gera uma chave temporária
    if (process.env.NODE_ENV === 'development') {
      logger.warn('[Encryption] Using temporary development key')
      return crypto.scryptSync('dev-key-2025', 'ml-agent-salt', 32)
    }
    throw new Error('ENCRYPTION_KEY environment variable is required for security')
  }
  
  // Valida força da chave
  if (envKey.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long')
  }
  
  // Deriva chave usando scrypt
  const SALT = process.env['ENCRYPTION_SALT'] || 'ml-agent-salt-2025'
  return crypto.scryptSync(envKey, SALT, 32)
}

export interface EncryptedData {
  encrypted: string
  iv: string
  authTag: string
}

/**
 * Criptografa um token usando AES-256-GCM
 * @param text Token em texto plano
 * @returns Objeto com token criptografado, IV e tag de autenticação
 */
export function encryptToken(text: string): EncryptedData {
  // Garante que a chave está inicializada
  const encryptionKey = ensureKeyInitialized()
  
  // Gera um IV aleatório de 16 bytes
  const iv = crypto.randomBytes(16)
  
  // Cria o cipher
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey!, iv)
  
  // Criptografa o texto
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  // Obtém a tag de autenticação (garante integridade)
  const authTag = cipher.getAuthTag()
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  }
}

/**
 * Descriptografa um token usando AES-256-GCM
 * @param data Objeto com token criptografado, IV e authTag
 * @returns Token em texto plano
 */
export function decryptToken(data: { encrypted: string, iv: string, authTag: string }): string {
  try {
    // Garante que a chave está inicializada
    const encryptionKey = ensureKeyInitialized()
    
    const { encrypted, iv, authTag } = data
    
    // Cria o decipher
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      encryptionKey,
      Buffer.from(iv, 'hex')
    )
    
    // Define a tag de autenticação
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    
    // Descriptografa o texto
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    logger.error('[Encryption] Failed to decrypt token:', { error })
    throw new Error('Invalid token or corrupted data')
  }
}

/**
 * Gera um hash seguro para senhas
 * @param password Senha em texto plano
 * @returns Hash da senha
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

/**
 * Verifica uma senha contra seu hash
 * @param password Senha em texto plano
 * @param hashedPassword Hash armazenado
 * @returns true se a senha está correta
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const parts = hashedPassword.split(':')
  if (!parts[0] || !parts[1]) {
    return false
  }
  const verifyHash = crypto.pbkdf2Sync(password, parts[0], 100000, 64, 'sha512').toString('hex')
  return parts[1] === verifyHash
}

/**
 * Gera um token seguro aleatório
 * @param length Tamanho do token em bytes
 * @returns Token em formato hex
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Gera um code verifier para PKCE (OAuth 2.0)
 * @returns Code verifier em base64url
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Gera um code challenge a partir do verifier (PKCE)
 * @param verifier Code verifier
 * @returns Code challenge em base64url
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url')
}

/**
 * Valida a assinatura de um webhook do Mercado Livre
 * @param payload Payload do webhook
 * @param signature Assinatura recebida (pode ter prefixo 'sha256=')
 * @param secret Secret do webhook
 * @returns true se a assinatura é válida
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Remove prefixo 'sha256=' se presente (formato do ML)
  const cleanSignature = signature.replace(/^sha256=/, '')
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  // Comparação segura contra timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(cleanSignature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Mascara informações sensíveis para logs
 * @param token Token ou informação sensível
 * @returns Token mascarado
 */
export function maskSensitiveData(token: string): string {
  if (!token || token.length < 8) return '***'
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}