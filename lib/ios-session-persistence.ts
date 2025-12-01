/**
 * iOS PWA Session Persistence - Production 2025
 *
 * Garante que a sessão do usuário persista mesmo quando:
 * - O app iOS é fechado e reaberto
 * - O dispositivo é reiniciado
 * - A conexão com internet é perdida temporariamente
 *
 * Usa IndexedDB como storage primário (mais confiável no iOS)
 * com localStorage como fallback.
 */

const DB_NAME = 'ml-agent-session'
const DB_VERSION = 1
const STORE_NAME = 'session'
const SESSION_KEY = 'current-session'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 dias

interface CachedSession {
  user: {
    id: string
    nickname: string
    email?: string
    siteId: string
  }
  organization: {
    id: string
    subscriptionStatus: string
    trialEndsAt?: string
    subscriptionEndsAt?: string
  }
  timestamp: number
  expiresAt: number
}

// IndexedDB helpers
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

async function getFromIndexedDB<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  } catch {
    return null
  }
}

async function setInIndexedDB<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(value, key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } catch {
    // Fallback silencioso
  }
}

async function deleteFromIndexedDB(key: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } catch {
    // Fallback silencioso
  }
}

// LocalStorage fallback
function getFromLocalStorage<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

function setInLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full ou não disponível
  }
}

function deleteFromLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignorar erros
  }
}

/**
 * Salva a sessão do usuário para persistência iOS
 */
export async function saveSession(session: Omit<CachedSession, 'timestamp' | 'expiresAt'>): Promise<void> {
  const cachedSession: CachedSession = {
    ...session,
    timestamp: Date.now(),
    expiresAt: Date.now() + SESSION_MAX_AGE
  }

  // Salvar em ambos os storages para redundância
  await setInIndexedDB(SESSION_KEY, cachedSession)
  setInLocalStorage(SESSION_KEY, cachedSession)

  console.log('[Session] ✅ Session saved for iOS persistence')
}

/**
 * Recupera a sessão salva (se ainda válida)
 */
export async function getSession(): Promise<CachedSession | null> {
  // Tentar IndexedDB primeiro (mais confiável no iOS)
  let session = await getFromIndexedDB<CachedSession>(SESSION_KEY)

  // Fallback para localStorage
  if (!session) {
    session = getFromLocalStorage<CachedSession>(SESSION_KEY)
  }

  // Verificar se sessão existe e não expirou
  if (session && session.expiresAt > Date.now()) {
    console.log('[Session] ✅ Valid cached session found')
    return session
  }

  // Sessão expirada ou não existe
  if (session) {
    console.log('[Session] ⚠️ Session expired, clearing cache')
    await clearSession()
  }

  return null
}

/**
 * Limpa a sessão salva (logout)
 */
export async function clearSession(): Promise<void> {
  await deleteFromIndexedDB(SESSION_KEY)
  deleteFromLocalStorage(SESSION_KEY)
  console.log('[Session] 🗑️ Session cleared')
}

/**
 * Atualiza o timestamp da sessão (keep-alive)
 */
export async function touchSession(): Promise<void> {
  const session = await getSession()
  if (session) {
    session.timestamp = Date.now()
    session.expiresAt = Date.now() + SESSION_MAX_AGE
    await setInIndexedDB(SESSION_KEY, session)
    setInLocalStorage(SESSION_KEY, session)
  }
}

/**
 * Verifica se é iOS PWA standalone
 */
export function isIOSStandalone(): boolean {
  if (typeof window === 'undefined') return false

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone === true

  return isIOS && isStandalone
}

/**
 * Registra event listeners para manter sessão viva
 */
export function setupSessionKeepAlive(): () => void {
  if (typeof window === 'undefined') return () => {}

  // Touch session a cada 5 minutos quando app está ativo
  const intervalId = setInterval(() => {
    touchSession()
  }, 5 * 60 * 1000)

  // Touch session quando app volta do background
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('[Session] 👁️ App became visible, touching session')
      touchSession()
    }
  }

  // Touch session quando app ganha foco
  const handleFocus = () => {
    console.log('[Session] 🎯 App focused, touching session')
    touchSession()
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleFocus)

  // Cleanup function
  return () => {
    clearInterval(intervalId)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', handleFocus)
  }
}
