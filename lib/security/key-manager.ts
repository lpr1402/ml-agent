/**
 * Key Manager - Gerenciamento Seguro de Chaves de Criptografia
 * Implementa rotação automática e derivação segura de chaves
 * Production-ready para Setembro 2025
 */

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

// @ts-expect-error - Interface defined for future use
interface _KeyVersion {
  version: number
  key: string
  createdAt: Date
  expiresAt: Date
  isActive: boolean
}

export class KeyManager {
  private static instance: KeyManager
  private currentKey: Buffer | null = null
  private keyVersions: Map<number, Buffer> = new Map()
  private keyRotationInterval = 30 * 24 * 60 * 60 * 1000 // 30 dias
  private keyFilePath = path.join(process.cwd(), '.keys', 'master.key')
  
  private constructor() {}
  
  static getInstance(): KeyManager {
    if (!KeyManager.instance) {
      KeyManager.instance = new KeyManager()
    }
    return KeyManager.instance
  }
  
  /**
   * Inicializa o gerenciador de chaves
   */
  async initialize(): Promise<void> {
    try {
      // Garante que o diretório de chaves existe
      await this.ensureKeyDirectory()
      
      // Carrega ou gera a master key
      await this.loadOrGenerateMasterKey()
      
      // Carrega versões de chaves do banco
      await this.loadKeyVersions()
      
      // Inicia rotação automática
      this.scheduleKeyRotation()
      
      logger.info('[KeyManager] Initialized successfully')
    } catch (_error) {
      logger.error('[KeyManager] Initialization failed', { error: _error })
      throw _error
    }
  }
  
  /**
   * Garante que o diretório de chaves existe e tem permissões corretas
   */
  private async ensureKeyDirectory(): Promise<void> {
    const keyDir = path.dirname(this.keyFilePath)
    
    try {
      await fs.access(keyDir)
    } catch {
      // Diretório não existe, criar com permissões restritas
      await fs.mkdir(keyDir, { recursive: true, mode: 0o700 })
      logger.info('[KeyManager] Created secure key directory')
    }
    
    // Adiciona .gitignore para garantir que chaves nunca sejam commitadas
    const gitignorePath = path.join(keyDir, '.gitignore')
    await fs.writeFile(gitignorePath, '*\n!.gitignore\n', 'utf-8')
  }
  
  /**
   * Carrega ou gera a master key
   */
  private async loadOrGenerateMasterKey(): Promise<void> {
    try {
      // Tenta carregar chave existente
      const keyData = await fs.readFile(this.keyFilePath, 'utf-8')
      const keyJson = JSON.parse(keyData)
      
      // Valida formato da chave
      if (!keyJson.key || !keyJson.created) {
        throw new Error('Invalid key format')
      }
      
      // Deriva a chave atual usando PBKDF2
      this.currentKey = await this.deriveKey(keyJson.key)
      
      logger.info('[KeyManager] Master key loaded', {
        created: keyJson.created,
        age: Math.floor((Date.now() - new Date(keyJson.created).getTime()) / (1000 * 60 * 60 * 24)) + ' days'
      })
      
    } catch (_error) {
      // Chave não existe ou é inválida, gerar nova
      logger.warn('[KeyManager] Generating new master key')
      
      const newKey = crypto.randomBytes(64).toString('base64')
      const keyData = {
        key: newKey,
        created: new Date().toISOString(),
        algorithm: 'aes-256-gcm',
        derivation: 'pbkdf2-sha512'
      }
      
      // Salva com permissões restritas
      await fs.writeFile(
        this.keyFilePath,
        JSON.stringify(keyData, null, 2),
        { mode: 0o600 }
      )
      
      this.currentKey = await this.deriveKey(newKey)
      
      logger.info('[KeyManager] New master key generated and saved')
    }
  }
  
  /**
   * Deriva uma chave usando PBKDF2
   */
  private async deriveKey(masterKey: string): Promise<Buffer> {
    const salt = process.env['ENCRYPTION_SALT'] || 'ml-agent-2025'
    const iterations = 100000
    const keyLength = 32 // 256 bits para AES-256
    
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(masterKey, salt, iterations, keyLength, 'sha512', (err, derivedKey) => {
        if (err) reject(err)
        else resolve(derivedKey)
      })
    })
  }
  
  /**
   * Carrega versões de chaves do banco de dados
   */
  private async loadKeyVersions(): Promise<void> {
    try {
      // Busca configuração de chaves no banco
      const keyConfigs = await prisma.$queryRaw<any[]>`
        SELECT * FROM "KeyRotation" 
        WHERE "isActive" = true 
        ORDER BY version DESC
      `.catch(() => []) // Tabela pode não existir ainda
      
      for (const config of keyConfigs) {
        const derivedKey = await this.deriveKey(config.keyHash)
        this.keyVersions.set(config.version, derivedKey)
      }
      
      logger.info('[KeyManager] Loaded key versions', {
        versions: Array.from(this.keyVersions.keys())
      })
    } catch (_error) {
      logger.warn('[KeyManager] No key versions in database yet')
    }
  }
  
  /**
   * Obtém a chave atual para criptografia
   */
  getCurrentKey(): Buffer {
    if (!this.currentKey) {
      throw new Error('KeyManager not initialized')
    }
    return this.currentKey
  }
  
  /**
   * Obtém uma chave específica por versão (para descriptografia)
   */
  getKeyByVersion(version: number): Buffer {
    // Versão 0 é sempre a chave atual
    if (version === 0 || !this.keyVersions.has(version)) {
      return this.getCurrentKey()
    }
    
    const key = this.keyVersions.get(version)
    if (!key) {
      throw new Error(`Key version ${version} not found`)
    }
    
    return key
  }
  
  /**
   * Rotaciona a chave master
   */
  async rotateKey(): Promise<void> {
    try {
      logger.info('[KeyManager] Starting key rotation')
      
      // Gera nova chave
      const newKey = crypto.randomBytes(64).toString('base64')
      const newDerivedKey = await this.deriveKey(newKey)
      
      // Salva versão anterior
      const currentVersion = this.keyVersions.size + 1
      this.keyVersions.set(currentVersion, this.currentKey!)
      
      // Atualiza chave atual
      this.currentKey = newDerivedKey
      
      // Salva nova chave master
      const keyData = {
        key: newKey,
        created: new Date().toISOString(),
        algorithm: 'aes-256-gcm',
        derivation: 'pbkdf2-sha512',
        version: currentVersion + 1,
        rotatedFrom: currentVersion
      }
      
      await fs.writeFile(
        this.keyFilePath,
        JSON.stringify(keyData, null, 2),
        { mode: 0o600 }
      )
      
      // Registra rotação no banco
      await this.recordKeyRotation(currentVersion + 1)
      
      logger.info('[KeyManager] Key rotation completed', {
        newVersion: currentVersion + 1,
        totalVersions: this.keyVersions.size
      })
      
      // Re-criptografa dados críticos em background
      this.reencryptDataAsync().catch(err => {
        logger.error('[KeyManager] Re-encryption failed', { error: err })
      })
      
    } catch (_error) {
      logger.error('[KeyManager] Key rotation failed', { error: _error })
      throw _error
    }
  }
  
  /**
   * Registra rotação de chave no banco
   */
  private async recordKeyRotation(version: number): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO "KeyRotation" (version, "rotatedAt", "isActive")
        VALUES (${version}, ${new Date()}, true)
        ON CONFLICT (version) DO UPDATE
        SET "isActive" = true, "rotatedAt" = ${new Date()}
      `
    } catch (_error) {
      logger.warn('[KeyManager] Could not record rotation in database', { error: _error })
    }
  }
  
  /**
   * Re-criptografa dados com a nova chave (async)
   */
  private async reencryptDataAsync(): Promise<void> {
    // Esta é uma operação complexa que deve ser feita em background
    // Por ora, apenas marca tokens para re-criptografia na próxima vez que forem usados
    logger.info('[KeyManager] Marking data for re-encryption')
    
    try {
      await prisma.$executeRaw`
        UPDATE "MLAccount" 
        SET "needsReencryption" = true
        WHERE "needsReencryption" IS NULL OR "needsReencryption" = false
      `
    } catch {
      // Campo pode não existir ainda
    }
  }
  
  /**
   * Agenda rotação automática de chaves
   */
  private scheduleKeyRotation(): void {
    // Rotação a cada 30 dias
    setInterval(async () => {
      try {
        await this.rotateKey()
      } catch (_error) {
        logger.error('[KeyManager] Scheduled rotation failed', { error: _error })
      }
    }, this.keyRotationInterval)
    
    logger.info('[KeyManager] Key rotation scheduled', {
      interval: '30 days'
    })
  }
  
  /**
   * Criptografa dados com versionamento de chave
   */
  encrypt(text: string): { encrypted: string; iv: string; authTag: string; keyVersion: number } {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getCurrentKey(), iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      keyVersion: this.keyVersions.size + 1 // Versão atual
    }
  }
  
  /**
   * Descriptografa dados usando a versão correta da chave
   */
  decrypt(data: { 
    encrypted: string; 
    iv: string; 
    authTag: string; 
    keyVersion?: number 
  }): string {
    const key = data.keyVersion 
      ? this.getKeyByVersion(data.keyVersion)
      : this.getCurrentKey()
    
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(data.iv, 'hex')
    )
    
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'))
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
  
  /**
   * Verifica saúde do sistema de chaves
   */
  async healthCheck(): Promise<{
    healthy: boolean
    currentVersion: number
    totalVersions: number
    lastRotation?: Date
  }> {
    try {
      const stats = await fs.stat(this.keyFilePath)
      
      return {
        healthy: true,
        currentVersion: this.keyVersions.size + 1,
        totalVersions: this.keyVersions.size,
        lastRotation: stats.mtime
      }
    } catch (_error) {
      return {
        healthy: false,
        currentVersion: 0,
        totalVersions: 0
      }
    }
  }
}

// Singleton export
export const keyManager = KeyManager.getInstance()

// Auto-inicialização em produção
if (process.env.NODE_ENV === 'production') {
  keyManager.initialize().catch(err => {
    logger.error('[KeyManager] Failed to auto-initialize', { error: err })
  })
}