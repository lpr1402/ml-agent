/**
 * Cliente OAuth2 do Mercado Livre com PKCE (RFC 7636)
 * Implementação 100% aderente à documentação oficial ML
 * Production-ready com segurança máxima
 * @version 3.0 - Reconstruído com ULTRA-HIGH reasoning
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { encryptToken, decryptToken } from '@/lib/security/encryption'
import { auditLog, type AuditLogData } from '@/lib/audit/audit-logger'
import { generateCodeVerifier, generateCodeChallenge } from './pkce-generator'
import crypto from 'crypto'

/**
 * Interface para resultado do refresh token
 */
export interface TokenRefreshResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  expiresAt?: Date
  error?: string
}

/**
 * Interface para resposta do token ML
 */
interface MLTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  user_id: number
  refresh_token: string
}

/**
 * Interface para parâmetros de autorização
 */
export interface AuthorizationParams {
  organizationId?: string
  isPrimaryLogin?: boolean
  redirectUri: string
}

/**
 * Gera token seguro para state (CSRF protection)
 */
function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url')
}

/**
 * Cliente OAuth2 do Mercado Livre
 * Singleton pattern para garantir única instância
 */
class MLOAuthClient {
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly authUrl = 'https://auth.mercadolivre.com.br/authorization'
  private readonly tokenUrl = 'https://api.mercadolibre.com/oauth/token'
  
  constructor() {
    const clientId = process.env['ML_CLIENT_ID']
    const clientSecret = process.env['ML_CLIENT_SECRET']
    
    if (!clientId || !clientSecret) {
      throw new Error('ML_CLIENT_ID and ML_CLIENT_SECRET must be configured')
    }
    
    this.clientId = clientId
    this.clientSecret = clientSecret
  }
  
  /**
   * Inicia fluxo de autorização OAuth2 com PKCE
   * Segue 100% a documentação ML
   */
  async initiateAuthorization(params: AuthorizationParams): Promise<string> {
    const { organizationId, redirectUri } = params
    
    // Gera PKCE pair (code_verifier e code_challenge)
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    
    // Gera state seguro (obrigatório contra CSRF)
    const state = generateSecureToken(32)
    
    // Armazena no banco para validação posterior
    await prisma.oAuthState.create({
      data: {
        state,
        codeVerifier,
        organizationId: organizationId ?? null, // Convert undefined to null for Prisma
        isPrimaryLogin: !organizationId, // Se não tem organização, é login primário
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutos
      }
    })
    
    // Audit log
    const auditData: AuditLogData = {
      action: 'oauth.initiated',
      entityType: 'ml_account',
      entityId: 'system',
      metadata: {
        clientId: this.clientId
      }
    }
    
    // Adiciona organizationId apenas se existir
    if (organizationId) {
      auditData.organizationId = organizationId
    }
    
    await auditLog(auditData)
    
    // Constrói URL de autorização seguindo documentação ML
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256' // ML recomenda S256 para máxima segurança
    })
    
    const authorizationUrl = `${this.authUrl}?${authParams.toString()}`
    
    const logContext: any = {
      isPrimaryLogin: !organizationId,
      state
    }
    if (organizationId) {
      logContext.organizationId = organizationId
    }
    
    logger.info('[OAuth] Authorization URL generated', logContext)
    
    return authorizationUrl
  }
  
  /**
   * Troca código de autorização por access token
   * Implementa PKCE validation
   */
  async exchangeCodeForToken(code: string, state: string, redirectUri: string): Promise<MLTokenResponse> {
    try {
      // Busca e valida state do banco
      const oauthState = await prisma.oAuthState.findUnique({
        where: { state }
      })
      
      if (!oauthState) {
        throw new Error('Invalid state - possible CSRF attack')
      }
      
      // Verifica expiração
      if (new Date() > oauthState.expiresAt) {
        await prisma.oAuthState.delete({ where: { state } })
        throw new Error('State expired - please try again')
      }
      
      // Prepara body da requisição seguindo documentação ML
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: oauthState.codeVerifier // PKCE verification
      })
      
      // Faz requisição para trocar code por token
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: tokenBody.toString()
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        logger.error('[OAuth] Token exchange failed', { 
          status: response.status,
          error: data 
        })
        
        // Limpa state usado
        await prisma.oAuthState.delete({ where: { state } })
        
        throw new Error(data.error_description || 'Token exchange failed')
      }
      
      // Limpa state após uso bem-sucedido
      await prisma.oAuthState.delete({ where: { state } })
      
      logger.info('[OAuth] Token exchange successful', {
        userId: data.user_id,
        scope: data.scope,
        expiresIn: data.expires_in
      })
      
      return data as MLTokenResponse
    } catch (error) {
      logger.error('[OAuth] Token exchange error', { error })
      throw error
    }
  }
  
  /**
   * Refresh access token usando refresh_token
   * Seguindo documentação ML 100%
   */
  async refreshAccessToken(mlAccountId: string): Promise<string> {
    try {
      // Busca conta com tokens criptografados
      const account = await prisma.mLAccount.findUnique({
        where: { id: mlAccountId },
        select: {
          id: true,
          mlUserId: true,
          nickname: true,
          refreshToken: true,
          refreshTokenIV: true,
          refreshTokenTag: true,
          organizationId: true
        }
      })
      
      if (!account || !account.refreshToken) {
        throw new Error('No refresh token available')
      }
      
      // Descriptografa refresh token
      const refreshToken = decryptToken({
        encrypted: account.refreshToken,
        iv: account.refreshTokenIV!,
        authTag: account.refreshTokenTag!
      })
      
      // Prepara body seguindo documentação ML
      const refreshBody = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken
      })
      
      // Faz requisição de refresh
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: refreshBody.toString()
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        logger.error('[OAuth] Token refresh failed', {
          status: response.status,
          error: data,
          mlAccountId
        })
        
        // Se refresh falhou, marca conta como inativa
        await prisma.mLAccount.update({
          where: { id: mlAccountId },
          data: { 
            isActive: false,
            connectionError: data.error_description || 'Token refresh failed'
          }
        })
        
        throw new Error(data.error_description || 'Token refresh failed')
      }
      
      // Criptografa novos tokens
      const encryptedAccess = encryptToken(data.access_token)
      const encryptedRefresh = encryptToken(data.refresh_token)
      
      // Atualiza tokens no banco
      await prisma.mLAccount.update({
        where: { id: mlAccountId },
        data: {
          accessToken: encryptedAccess.encrypted,
          accessTokenIV: encryptedAccess.iv,
          accessTokenTag: encryptedAccess.authTag,
          refreshToken: encryptedRefresh.encrypted,
          refreshTokenIV: encryptedRefresh.iv,
          refreshTokenTag: encryptedRefresh.authTag,
          tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
          isActive: true,
          connectionError: null
        }
      })
      
      // Audit log
      await auditLog({
        action: 'oauth.token_refreshed',
        entityType: 'ml_account',
        entityId: mlAccountId,
        organizationId: account.organizationId,
        metadata: {
          mlUserId: account.mlUserId,
          nickname: account.nickname,
          expiresIn: data.expires_in
        }
      })
      
      logger.info('[OAuth] Token refreshed successfully', {
        mlAccountId,
        expiresIn: data.expires_in
      })
      
      return data.access_token
    } catch (error) {
      logger.error('[OAuth] Refresh token error', { 
        error,
        mlAccountId 
      })
      throw error
    }
  }
  
  /**
   * Salva tokens de uma nova conta ML
   */
  async saveTokens(
    tokenData: MLTokenResponse,
    organizationId: string,
    isPrimary: boolean = false
  ): Promise<string> {
    try {
      // Busca informações do usuário
      const userResponse = await fetch('https://api.mercadolibre.com/users/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      })
      
      if (!userResponse.ok) {
        throw new Error('Failed to fetch user info')
      }
      
      const userInfo = await userResponse.json()
      
      // Criptografa tokens
      const encryptedAccess = encryptToken(tokenData.access_token)
      const encryptedRefresh = encryptToken(tokenData.refresh_token)
      
      // Busca conta existente
      const existingAccount = await prisma.mLAccount.findFirst({
        where: {
          mlUserId: userInfo.id.toString(),
          organizationId
        }
      })
      
      // Cria ou atualiza conta ML
      const mlAccount = existingAccount 
        ? await prisma.mLAccount.update({
            where: { id: existingAccount.id },
            data: {
              nickname: userInfo.nickname,
              email: userInfo.email,
              accessToken: encryptedAccess.encrypted,
              accessTokenIV: encryptedAccess.iv,
              accessTokenTag: encryptedAccess.authTag,
              refreshToken: encryptedRefresh.encrypted,
              refreshTokenIV: encryptedRefresh.iv,
              refreshTokenTag: encryptedRefresh.authTag,
              tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
              isPrimary,
              isActive: true,
              thumbnail: userInfo.thumbnail?.picture_url || null,
              permalink: userInfo.permalink,
              siteId: userInfo.site_id,
              connectionError: null
            }
          })
        : await prisma.mLAccount.create({
            data: {
          mlUserId: userInfo.id.toString(),
          nickname: userInfo.nickname,
          email: userInfo.email,
          organizationId,
          accessToken: encryptedAccess.encrypted,
          accessTokenIV: encryptedAccess.iv,
          accessTokenTag: encryptedAccess.authTag,
          refreshToken: encryptedRefresh.encrypted,
          refreshTokenIV: encryptedRefresh.iv,
          refreshTokenTag: encryptedRefresh.authTag,
          tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          isPrimary,
          isActive: true,
          thumbnail: userInfo.thumbnail?.picture_url || null,
          permalink: userInfo.permalink,
          siteId: userInfo.site_id
        }
      })
      
      // Audit log
      await auditLog({
        action: 'oauth.account_connected',
        entityType: 'ml_account',
        entityId: mlAccount.id,
        organizationId,
        metadata: {
          mlUserId: userInfo.id,
          nickname: userInfo.nickname,
          isPrimary
        }
      })
      
      logger.info('[OAuth] ML account saved', {
        mlAccountId: mlAccount.id,
        mlUserId: userInfo.id,
        nickname: userInfo.nickname,
        isPrimary
      })
      
      return mlAccount.id
    } catch (error) {
      logger.error('[OAuth] Save tokens error', { error })
      throw error
    }
  }
  
  /**
   * Revoga autorização de uma conta ML
   */
  async revokeAuthorization(mlAccountId: string): Promise<void> {
    try {
      const account = await prisma.mLAccount.findUnique({
        where: { id: mlAccountId }
      })
      
      if (!account) {
        throw new Error('ML account not found')
      }
      
      // Marca como inativa
      await prisma.mLAccount.update({
        where: { id: mlAccountId },
        data: {
          isActive: false,
          connectionError: 'Authorization revoked'
        }
      })
      
      // Audit log
      await auditLog({
        action: 'oauth.authorization_revoked',
        entityType: 'ml_account',
        entityId: mlAccountId,
        organizationId: account.organizationId,
        metadata: {
          mlUserId: account.mlUserId,
          nickname: account.nickname
        }
      })
      
      logger.info('[OAuth] Authorization revoked', {
        mlAccountId,
        mlUserId: account.mlUserId
      })
    } catch (error) {
      logger.error('[OAuth] Revoke authorization error', { 
        error,
        mlAccountId 
      })
      throw error
    }
  }
}

// Exporta instância única (Singleton)
export const mlOAuth = new MLOAuthClient()

// Exporta tipos para uso externo
export type { MLTokenResponse }