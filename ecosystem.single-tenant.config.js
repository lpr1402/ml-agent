/**
 * Configuração PM2 Otimizada para Single-Tenant
 * Para uso com até 10 contas ML em uma única organização
 * Usa variáveis do .env.production com otimizações de recursos
 */

module.exports = {
  apps: [
    {
      name: 'ml-agent',
      script: 'npm',
      args: 'start',
      instances: 1, // Next.js não suporta cluster mode nativamente
      exec_mode: 'fork', // Usar fork mode para Next.js
      autorestart: true,
      watch: false,
      max_memory_restart: '1G', // Otimizado: 1G suficiente para single-tenant
      node_args: '--max-old-space-size=1024 --optimize-for-size',
      env_production: {
        // Core
        NODE_ENV: 'production',
        PORT: 3007,
        HOST: '0.0.0.0',

        // Performance optimizations
        NODE_OPTIONS: '--max-old-space-size=1024',
        UV_THREADPOOL_SIZE: '16', // Otimizado: 16 threads para 10 contas

        // Database - Otimizado para single-tenant
        DATABASE_URL: 'postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public',
        DB_POOL_SIZE: '20', // Otimizado: 20 conexões (2 por conta)
        DB_POOL_TIMEOUT: '5000',
        DB_STATEMENT_TIMEOUT: '10000',
        DB_IDLE_TIMEOUT: '30000',
        DB_CONNECTION_TIMEOUT: '5000',

        // Redis
        REDIS_URL: 'redis://localhost:6379',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',

        // Auth & URLs
        NEXTAUTH_URL: 'https://gugaleo.axnexlabs.com.br',
        NEXTAUTH_SECRET: 'ml-agent-secret-key-development-2025-super-secure',
        NEXT_PUBLIC_APP_URL: 'https://gugaleo.axnexlabs.com.br',
        NEXT_PUBLIC_API_URL: 'https://gugaleo.axnexlabs.com.br/api',
        NEXT_PUBLIC_WS_URL: 'wss://gugaleo.axnexlabs.com.br:3008',

        // Mercado Livre OAuth
        ML_CLIENT_ID: '8077330788571096',
        ML_CLIENT_SECRET: 'jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha',
        ML_REDIRECT_URI: 'https://gugaleo.axnexlabs.com.br/api/auth/callback/mercadolibre',
        ML_API_BASE_URL: 'https://api.mercadolibre.com',

        // ML Rate Limiting - Otimizado para 10 contas
        ML_API_RATE_LIMIT: '500', // 500 req/hora por conta (5000 total, mas ML limita em 2000)
        ML_API_RATE_WINDOW: '3600', // Janela de 1 hora
        ML_WEBHOOK_SECRET: 'webhook-secret-ml-2025',

        // Encryption
        ENCRYPTION_KEY: 'e771911b5c648a1a460e7af26633009d7445fe688f8845f7e63324b29de95dce',
        ENCRYPTION_SALT: 'ml-agent-salt-2025',

        // Session
        SESSION_SECRET: 'ml-agent-session-secret-2025',
        SESSION_MAX_AGE: '604800',

        // Cache TTL - Otimizado
        CACHE_TTL_USER: '3600',
        CACHE_TTL_ITEMS: '300',
        CACHE_TTL_METRICS: '300',
        CACHE_TTL_QUESTIONS: '60',

        // Queue Config
        QUEUE_CONCURRENCY: '5', // Otimizado: 5 jobs simultâneos
        QUEUE_MAX_RETRIES: '3',
        QUEUE_RETRY_DELAY: '5000',

        // WhatsApp APIs
        ZAPSTER_API_URL: 'https://api.zapsterapi.com/v1/wa/messages',
        ZAPSTER_API_TOKEN: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MzgyOTM3NzgsImlzcyI6InphcHN0ZXJhcGkiLCJzdWIiOiJlMzRkYzc5Zi02OGZhLTRmMzEtOTgxNi04MmQzNTY1NmY2ZmQiLCJqdGkiOiJkYWU5MDQ0ZS05ZTk3LTRkNGItOWRlZS0yYmNjOWRjYjQwOTEifQ.XwA4vJrTG65TBWqEJ_5oo_-cr-BhOzp3C2XgJOh0NnY',
        ZAPSTER_INSTANCE_ID: '21iwlxlswck0m95497nzl',
        ZAPSTER_GROUP_ID: 'group:120363420949294702',

        // N8N Webhooks
        N8N_WEBHOOK_URL: 'https://dashboard.axnexlabs.com.br/webhook/processamento',
        N8N_WEBHOOK_EDIT_URL: 'https://dashboard.axnexlabs.com.br/webhook/editar',
        N8N_WEBHOOK_SECRET: 'n8n-webhook-secret',

        // Feature Flags
        ENABLE_WEBHOOK_PROCESSING: 'true',
        ENABLE_AUTO_ANSWER: 'true',
        ENABLE_CACHE: 'true',
        ENABLE_RATE_LIMIT: 'true',

        // Logs
        LOG_LEVEL: 'warn',
        CONSOLE_LOG_DISABLE: 'true',

        // Monitoring
        ENABLE_METRICS: 'false', // Desabilita APM para evitar erros
        SENTRY_DSN: '' // Vazio para desabilitar
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Performance tuning
      min_uptime: '60s', // Tempo mínimo aumentado para estabilidade
      max_restarts: 5, // Reduzir max restarts para detectar problemas
      restart_delay: 10000, // Aumentar delay entre restarts
      // Graceful shutdown
      kill_timeout: 15000,
      shutdown_with_message: true,
      // wait_ready: true, // Removido - causa problemas com Next.js
      // listen_timeout: 5000, // Removido - não necessário sem wait_ready
      // Health monitoring
      instance_var: 'INSTANCE_ID'
    },
    {
      name: 'ml-agent-queue',
      script: './queue-worker.js',
      instances: 1, // Otimizado: 1 worker para 10 contas
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M', // Otimizado: 512M suficiente
      env_production: {
        NODE_ENV: 'production',
        // Herda configurações essenciais
        DATABASE_URL: 'postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public',
        REDIS_URL: 'redis://localhost:6379',
        ENCRYPTION_KEY: 'e771911b5c648a1a460e7af26633009d7445fe688f8845f7e63324b29de95dce',
        // Queue settings otimizadas
        QUEUE_CONCURRENCY: '5', // 5 jobs simultâneos
        QUEUE_MAX_RETRIES: '3',
        QUEUE_RETRY_DELAY: '5000',
        LOG_LEVEL: 'warn',
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
      instances: 1, // Otimizado: 1 worker para webhooks
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M', // Otimizado: 512M suficiente
      env_production: {
        NODE_ENV: 'production',
        // Herda configurações essenciais
        DATABASE_URL: 'postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public',
        REDIS_URL: 'redis://localhost:6379',
        ENCRYPTION_KEY: 'e771911b5c648a1a460e7af26633009d7445fe688f8845f7e63324b29de95dce',
        ML_WEBHOOK_SECRET: 'webhook-secret-ml-2025',
        // Worker settings otimizadas
        WORKER_CONCURRENCY: '5', // 5 webhooks simultâneos
        WEBHOOK_TIMEOUT: '5000', // 5 segundos timeout
        LOG_LEVEL: 'warn',
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
      instances: 1, // WebSocket server único
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M', // Aumentado para maior estabilidade
      env_production: {
        NODE_ENV: 'production',
        WS_PORT: '3008',
        // Herda configurações essenciais
        DATABASE_URL: 'postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db?schema=public',
        REDIS_URL: 'redis://localhost:6379',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        ENCRYPTION_KEY: 'e771911b5c648a1a460e7af26633009d7445fe688f8845f7e63324b29de95dce',
        SESSION_SECRET: 'ml-agent-session-secret-2025',
        NEXTAUTH_SECRET: 'ml-agent-secret-key-development-2025-super-secure',
        // URLs necessárias
        NEXT_PUBLIC_APP_URL: 'https://gugaleo.axnexlabs.com.br',
        // WebSocket settings
        WS_MAX_CONNECTIONS: '100', // 10 orgs × 10 usuários máximo
        WS_HEARTBEAT_INTERVAL: '30000', // 30 segundos
        WS_PING_TIMEOUT: '60000', // 1 minuto
        WS_RECONNECT_INTERVAL: '5000', // 5 segundos para reconexão
        LOG_LEVEL: 'info', // Mudado para info para debug
        ENABLE_METRICS: 'false',
        // Tokens ML
        ML_CLIENT_ID: '8077330788571096',
        ML_CLIENT_SECRET: 'jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha',
        ML_REDIRECT_URI: 'https://gugaleo.axnexlabs.com.br/api/auth/callback/mercadolibre'
      },
      error_file: './logs/websocket-err.log',
      out_file: './logs/websocket-out.log',
      log_file: './logs/websocket-combined.log',
      time: true,
      merge_logs: true,
      min_uptime: '30s', // Aumentado para evitar restarts rápidos
      max_restarts: 10, // Mais tentativas antes de desistir
      restart_delay: 5000, // 5 segundos entre restarts
      kill_timeout: 15000, // 15 segundos para graceful shutdown
      wait_ready: true,
      listen_timeout: 10000, // 10 segundos para aguardar o ready signal
      instance_var: 'INSTANCE_ID'
    }
  ],

  // Deploy configuration simplificada
  deploy: {
    production: {
      user: 'root',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/ml-agent.git',
      path: '/root/ml-agent',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.single-tenant.config.js --env production',
      'pre-deploy-local': '',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
}