/**
 * Constantes globais do sistema
 * CRÍTICO: Sempre usar estas constantes, NUNCA hardcode URLs!
 */

// DOMÍNIO PRINCIPAL - NUNCA USAR LOCALHOST!
export const APP_DOMAIN = 'https://gugaleo.axnexlabs.com.br'

// URLs da aplicação
export const APP_URLS = {
  // Base
  HOME: APP_DOMAIN,
  DASHBOARD: `${APP_DOMAIN}/dashboard`,
  
  // Auth
  LOGIN: `${APP_DOMAIN}/auth/login`,
  LOGOUT: `${APP_DOMAIN}/auth/logout`,
  ERROR: `${APP_DOMAIN}/auth/error`,
  SUCCESS: `${APP_DOMAIN}/auth/success`,
  CALLBACK: `${APP_DOMAIN}/api/auth/callback/mercadolibre`,
  
  // Dashboard
  ACCOUNTS: `${APP_DOMAIN}/dashboard/accounts`,
  SETTINGS: `${APP_DOMAIN}/dashboard/settings`,
  BILLING: `${APP_DOMAIN}/dashboard/billing`,
  
  // API
  API_BASE: `${APP_DOMAIN}/api`,
  API_AUTH_LOGIN: `${APP_DOMAIN}/api/auth/login`,
  API_ML_ACCOUNTS: `${APP_DOMAIN}/api/ml-accounts`,
  API_PAYMENTS: `${APP_DOMAIN}/api/payments`,
} as const

// Mercado Livre URLs
export const ML_URLS = {
  AUTH: 'https://auth.mercadolivre.com.br',
  API: 'https://api.mercadolibre.com',
} as const

// Configurações de segurança
export const SECURITY = {
  SESSION_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 dias
  TOKEN_BUFFER: 5 * 60 * 1000, // 5 minutos antes de expirar
  OAUTH_STATE_DURATION: 10 * 60 * 1000, // 10 minutos
  MAX_LOGIN_ATTEMPTS: 5,
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minuto
} as const

// Pagamento PIX
export const PAYMENT = {
  AMOUNT: 500.00,
  CURRENCY: 'BRL',
  PIX_CODE: '00020101021126330014br.gov.bcb.pix0111496118808555204000053039865406500.005802BR5925LUIS FERNANDO PEREIRA ROD6009SAO PAULO622905251K3PC743YN7DR3JGS3EXE3RPW630449B9',
  PIX_KEY: '496118808-55',
  QR_URL: 'https://www.dropbox.com/scl/fi/r6zrsjvz2pbo6pgc0tlgw/IMG_3881.jpeg?rlkey=yyrtf2n0nz4zt6ogqx2a8870h&st=q3rhjrkk&raw=1',
  RECIPIENT: 'LUIS FERNANDO PEREIRA ROD',
} as const

// Planos
export const PLANS = {
  TRIAL: {
    name: 'Trial',
    duration: 7 * 24 * 60 * 60 * 1000, // 7 dias
    accounts: 1,
  },
  PREMIUM: {
    name: 'Premium',
    duration: 30 * 24 * 60 * 60 * 1000, // 30 dias
    accounts: -1, // Ilimitado
    price: 500.00,
  },
} as const