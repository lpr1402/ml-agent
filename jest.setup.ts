import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder as any
global.TextDecoder = TextDecoder as any

// Mock environment variables
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test'
process.env['NEXTAUTH_SECRET'] = 'test-secret'
process.env['ML_CLIENT_ID'] = 'test-client-id'
process.env['ML_CLIENT_SECRET'] = 'test-client-secret'
process.env['ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-long'

// Mock fetch globally
global.fetch = jest.fn()

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock Prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    $disconnect: jest.fn(),
    organization: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    mLAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    question: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

// Setup test utilities
beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.restoreAllMocks()
})