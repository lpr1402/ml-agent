import type { Config } from 'jest'

const config: Config = {
  displayName: 'Production E2E Tests',
  testEnvironment: 'node',
  testMatch: [
    '**/e2e/**/*.test.ts',
    '**/e2e/**/*.spec.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.production.setup.ts'],
  testTimeout: 60000, // 1 minute for E2E tests
  maxWorkers: 1, // Run tests sequentially for E2E
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  collectCoverage: false, // No coverage for E2E tests
  verbose: true,
  bail: true // Stop on first failure for production tests
}

export default config