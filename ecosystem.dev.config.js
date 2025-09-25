module.exports = {
  apps: [
    {
      name: 'ml-agent-dev',
      script: 'npm',
      args: 'run dev',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: true,
      watch_delay: 1000,
      ignore_watch: [
        'node_modules',
        'logs',
        '.next',
        '.git',
        'prisma/migrations',
        'public/uploads',
        '*.log'
      ],
      max_memory_restart: '4G',
      node_args: '--max-old-space-size=4096',
      env: {
        // Override apenas o NODE_ENV para development
        // Todas outras variáveis vêm do arquivo .env
        NODE_ENV: 'development',
        PORT: 3007,
        // Redis local para desenvolvimento
        REDIS_URL: 'redis://localhost:6379',
        REDIS_HOST: 'localhost',
        // Desabilitar métricas em dev para evitar erros
        ENABLE_METRICS: 'false',
        // Log level debug para desenvolvimento
        LOG_LEVEL: 'debug',
        // Performance settings para dev
        NODE_OPTIONS: '--max-old-space-size=4096',
        UV_THREADPOOL_SIZE: '128',
        // Database optimizations para dev
        DB_POOL_SIZE: '20',
        DB_POOL_TIMEOUT: '5000',
        DB_STATEMENT_TIMEOUT: '10000',
        DB_IDLE_TIMEOUT: '30000',
        DB_CONNECTION_TIMEOUT: '5000',
        // Development helpers
        NEXT_TELEMETRY_DISABLED: '1',
        ANALYZE: 'false'
      },
      error_file: './logs/dev-err.log',
      out_file: './logs/dev-out.log',
      log_file: './logs/dev-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Graceful shutdown
      kill_timeout: 10000,
      shutdown_with_message: true,
      wait_ready: true,
      listen_timeout: 10000
    },
    {
      name: 'ml-agent-queue-dev',
      script: './queue-worker.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'development',
        REDIS_URL: 'redis://localhost:6379',
        LOG_LEVEL: 'debug'
      },
      error_file: './logs/queue-dev-err.log',
      out_file: './logs/queue-dev-out.log',
      log_file: './logs/queue-dev-combined.log',
      time: true,
      merge_logs: true
    }
  ]
}