/**
 * Configuração PM2 para Desenvolvimento HÍBRIDO
 * - Next.js: Roda FORA do PM2 em modo DEV (hot reload)
 * - Workers: Rodam via PM2 em modo PRODUÇÃO (processamento real)
 */

module.exports = {
  apps: [
    // ============================================
    // WORKERS EM PRODUÇÃO
    // ============================================

    {
      name: 'ml-agent-queue',
      script: './queue-worker.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public&pool_timeout=0&connection_limit=30',
        REDIS_URL: 'redis://localhost:6379',
        ENCRYPTION_KEY: 'e771911b5c648a1a460e7af26633009d7445fe688f8845f7e63324b29de95dce',
        QUEUE_CONCURRENCY: '20',
        QUEUE_MAX_RETRIES: '3',
        QUEUE_RETRY_DELAY: '5000',
        LOG_LEVEL: 'info',
        ENABLE_METRICS: 'false'
      },
      error_file: './logs/queue-err.log',
      out_file: './logs/queue-out.log',
      log_file: './logs/queue-combined.log',
      time: true,
      merge_logs: true,
      min_uptime: '5s',
      max_restarts: 5,
      restart_delay: 2000
    },

    {
      name: 'ml-agent-worker',
      script: 'worker-simple.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public',
        REDIS_URL: 'redis://localhost:6379',
        ENCRYPTION_KEY: 'e771911b5c648a1a460e7af26633009d7445fe688f8845f7e63324b29de95dce',
        ML_WEBHOOK_SECRET: 'webhook-secret-ml-2025',
        NEXT_PUBLIC_APP_URL: 'https://gugaleo.axnexlabs.com.br',
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'BFDQNvQB1cWQbPHStt5S6mRtVCGldecWfKMDWfyBx2HTPhvitpZdVE7kMIAQPpGawd5GN7XrzMnvfMq3n7NOM0g',
        VAPID_PRIVATE_KEY: 'XqWkLgd7DvUVAd3jxglkrrqEubb2DxQm0cz5o_PnE10',
        WORKER_CONCURRENCY: '5',
        WEBHOOK_TIMEOUT: '5000',
        LOG_LEVEL: 'info',
        ENABLE_METRICS: 'false'
      },
      error_file: './logs/worker-err.log',
      out_file: './logs/worker-out.log',
      log_file: './logs/worker-combined.log',
      time: true,
      merge_logs: true,
      min_uptime: '5s',
      max_restarts: 5,
      restart_delay: 2000
    },

    {
      name: 'ml-agent-websocket',
      script: './websocket-server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        WS_PORT: '3008',
        DATABASE_URL: 'postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public',
        REDIS_URL: 'redis://localhost:6379',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        ENCRYPTION_KEY: 'e771911b5c648a1a460e7af26633009d7445fe688f8845f7e63324b29de95dce',
        SESSION_SECRET: 'ml-agent-session-secret-2025',
        NEXTAUTH_SECRET: 'ml-agent-secret-key-development-2025-super-secure',
        NEXT_PUBLIC_APP_URL: 'https://gugaleo.axnexlabs.com.br',
        WS_MAX_CONNECTIONS: '100',
        WS_HEARTBEAT_INTERVAL: '30000',
        WS_PING_TIMEOUT: '60000',
        WS_RECONNECT_INTERVAL: '5000',
        LOG_LEVEL: 'info',
        ENABLE_METRICS: 'false',
        ML_CLIENT_ID: '8077330788571096',
        ML_CLIENT_SECRET: 'jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha',
        ML_REDIRECT_URI: 'https://gugaleo.axnexlabs.com.br/api/auth/callback/mercadolibre'
      },
      error_file: './logs/websocket-err.log',
      out_file: './logs/websocket-out.log',
      log_file: './logs/websocket-combined.log',
      time: true,
      merge_logs: true,
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 15000,
      wait_ready: true,
      listen_timeout: 10000,
      instance_var: 'INSTANCE_ID'
    },

    {
      name: 'ml-agent-token-maintenance',
      script: 'workers/token-maintenance-worker.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public',
        REDIS_URL: 'redis://localhost:6379',
        ENCRYPTION_KEY: 'e771911b5c648a1a460e7af26633009d7445fe688f8845f7e63324b29de95dce',
        ML_CLIENT_ID: '8077330788571096',
        ML_CLIENT_SECRET: 'jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha',
        LOG_LEVEL: 'info'
      },
      error_file: './logs/token-maintenance-err.log',
      out_file: './logs/token-maintenance-out.log',
      log_file: './logs/token-maintenance-combined.log',
      time: true,
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 10000
    },

    {
      name: 'ml-system-orchestrator',
      script: 'workers/ml-system-orchestrator.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public&pool_timeout=0&connection_limit=30',
        REDIS_URL: 'redis://localhost:6379',
        ENCRYPTION_KEY: 'e771911b5c648a1a460e7af26633009d7445fe688f8845f7e63324b29de95dce',
        ML_CLIENT_ID: '8077330788571096',
        ML_CLIENT_SECRET: 'jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha',
        ML_REDIRECT_URI: 'https://gugaleo.axnexlabs.com.br/api/auth/callback/mercadolibre',
        LOG_LEVEL: 'info',
        AUTO_SYNC_ENABLED: 'true',
        SYNC_INTERVAL_HOURS: '6',
        METRICS_ENABLED: 'true'
      },
      error_file: './logs/orchestrator-err.log',
      out_file: './logs/orchestrator-out.log',
      log_file: './logs/orchestrator-combined.log',
      time: true,
      merge_logs: true,
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 10000,
      kill_timeout: 30000
    },

    {
      name: 'ml-agent-reconciliation',
      script: 'workers/question-reconciliation-worker.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public&pool_timeout=0&connection_limit=30',
        REDIS_URL: 'redis://localhost:6379',
        ENCRYPTION_KEY: 'e771911b5c648a1a460e7af26633009d7445fe688f8845f7e63324b29de95dce',
        ML_CLIENT_ID: '8077330788571096',
        ML_CLIENT_SECRET: 'jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha',
        LOG_LEVEL: 'info',
        RECONCILIATION_INTERVAL_MS: '1800000', // 30 minutos
        RECONCILIATION_BATCH_SIZE: '50',
        RECONCILIATION_MIN_AGE_MS: '300000', // 5 minutos
        RECONCILIATION_VERBOSE: 'false'
      },
      error_file: './logs/reconciliation-err.log',
      out_file: './logs/reconciliation-out.log',
      log_file: './logs/reconciliation-combined.log',
      time: true,
      merge_logs: true,
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 10000,
      kill_timeout: 30000
    },

    {
      name: 'ml-agent-profile-sync',
      script: 'workers/profile-sync-worker.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false, // Cron job
      cron_restart: '0 */6 * * *', // A cada 6 horas
      watch: false,
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public',
        REDIS_URL: 'redis://localhost:6379',
        ENCRYPTION_KEY: 'e771911b5c648a1a460e7af26633009d7445fe688f8845f7e63324b29de95dce',
        LOG_LEVEL: 'info'
      },
      error_file: './logs/profile-sync-err.log',
      out_file: './logs/profile-sync-out.log',
      log_file: './logs/profile-sync-combined.log',
      time: true,
      merge_logs: true
    },

    {
      name: 'ml-agent-push-cleanup',
      script: 'lib/push/subscription-cleaner.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false, // Cron job
      cron_restart: '0 3 * * *', // Diariamente às 3AM
      watch: false,
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public',
        LOG_LEVEL: 'info'
      },
      error_file: './logs/push-cleanup-err.log',
      out_file: './logs/push-cleanup-out.log',
      log_file: './logs/push-cleanup-combined.log',
      time: true,
      merge_logs: true
    }
  ]
}
