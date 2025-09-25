/**
 * Sentry Client Configuration
 * Usa configuração centralizada para produção
 */

import { initSentry } from '@/lib/monitoring/sentry-config'

// Initialize Sentry for client-side
initSentry(true)