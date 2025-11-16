/**
 * Profile Sync Worker - Enterprise Grade
 * Verifica e atualiza perfis desatualizados (> 6h)
 * Executa via PM2 scheduler ou cron
 */

import { profileRefreshManager } from '../lib/ml-api/profile-refresh-manager'

async function runProfileSync() {
  try {
    console.log('\n' + '='.repeat(60))
    console.log('🔄 PROFILE SYNC WORKER STARTED')
    console.log('Time: ' + new Date().toLocaleString('pt-BR'))
    console.log('='.repeat(60) + '\n')

    // Executar check e refresh de contas stale
    await profileRefreshManager.checkAndRefreshStaleAccounts()

    console.log('\n' + '='.repeat(60))
    console.log('✅ PROFILE SYNC WORKER COMPLETED')
    console.log('Finished at: ' + new Date().toLocaleString('pt-BR'))
    console.log('='.repeat(60) + '\n')

    // Manter processo vivo para PM2
    // Worker executa a cada 1 hora via PM2 cron
    process.exit(0)

  } catch (error: any) {
    console.error('❌ PROFILE SYNC WORKER FATAL ERROR')
    console.error(error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

runProfileSync()
