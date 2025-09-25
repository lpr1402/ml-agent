/**
 * Sentry Server Configuration
 * Usa configuração centralizada para produção
 */

import { initSentry } from '@/lib/monitoring/sentry-config'

// Initialize Sentry for server-side
initSentry(false)