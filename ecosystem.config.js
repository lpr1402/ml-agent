module.exports = {
  apps: [
    {
      name: 'ml-agent',
      script: 'npm',
      args: 'start',
      instances: 'max', // Usa todos os cores disponíveis
      exec_mode: 'cluster', // Modo cluster para load balancing
      autorestart: true,
      watch: false,
      max_memory_restart: '4G', // Aumentado para 10k+ usuários
      node_args: '--max-old-space-size=4096 --optimize-for-size',
      env: {
        NODE_ENV: 'production',
        PORT: 3007,
        // Performance optimizations
        NODE_OPTIONS: '--max-old-space-size=4096',
        UV_THREADPOOL_SIZE: '128',
        // Database optimizations - Optimized for production
        DB_POOL_SIZE: '50', // Optimized: 50 connections per instance
        DB_POOL_TIMEOUT: '5000', // 5 seconds timeout
        DB_STATEMENT_TIMEOUT: '10000', // 10 seconds statement timeout
        DB_IDLE_TIMEOUT: '30000', // 30 seconds idle timeout
        DB_CONNECTION_TIMEOUT: '5000', // 5 seconds to connect
        // Disable console.log in production
        CONSOLE_LOG_DISABLE: 'true',
        LOG_LEVEL: 'warn'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Performance tuning
      min_uptime: '30s', // Aumentado de 10s
      max_restarts: 5, // Reduzido de 10
      restart_delay: 4000, // 4s entre restarts
      // Graceful shutdown
      kill_timeout: 30000, // Aumentado para 30s
      shutdown_with_message: true,
      wait_ready: true,
      listen_timeout: 10000,
      // Health monitoring
      instance_var: 'INSTANCE_ID'
    },
    {
      name: 'ml-agent-queue',
      script: './queue-worker.js',
      instances: 2, // Múltiplos workers para processar queue
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G', // Aumentado para melhor performance
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/queue-err.log',
      out_file: './logs/queue-out.log',
      log_file: './logs/queue-combined.log',
      time: true,
      merge_logs: true
    },
    {
      name: 'ml-agent-worker',
      script: 'worker-simple.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      instances: 2, // Múltiplos workers para processar webhooks
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G', // Aumentado para melhor performance
      env: {
        NODE_ENV: 'production'
        // Environment variables loaded from .env file
      },
      error_file: './logs/worker-err.log',
      out_file: './logs/worker-out.log',
      log_file: './logs/worker-combined.log',
      time: true,
      merge_logs: true,
      // Performance
      min_uptime: '10s',
      max_restarts: 10
    }
  ],
  
  // Deploy configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'gugaleo.axnexlabs.com.br',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/ml-agent.git',
      path: '/var/www/ml-agent',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': '',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
}