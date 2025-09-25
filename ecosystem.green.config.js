/**
 * PM2 Green Environment Configuration
 * Production deployment with zero-downtime switching
 */

module.exports = {
  apps: [
    {
      name: 'ml-agent-green',
      script: 'npm',
      args: 'start',
      instances: 'max',
      exec_mode: 'cluster',
      
      // Green environment on port 3008
      env: {
        NODE_ENV: 'production',
        PORT: 3008,
        DEPLOYMENT: 'green',
        
        // Database Configuration
        DB_POOL_SIZE: 50,
        DB_POOL_TIMEOUT: 5000,
        DB_STATEMENT_TIMEOUT: 10000,
        DB_IDLE_TIMEOUT: 30000,
        DB_CONNECTION_TIMEOUT: 5000,
        
        // Redis Configuration
        REDIS_MAX_RETRIES: 3,
        REDIS_RETRY_DELAY: 1000,
        
        // Performance
        NODE_OPTIONS: '--max-old-space-size=4096',
        
        // Monitoring
        MONITOR_ENABLED: true,
        HEALTH_CHECK_INTERVAL: 30000
      },
      
      // PM2 Plus monitoring
      pmx: true,
      
      // Auto restart
      autorestart: true,
      watch: false,
      max_memory_restart: '4G',
      
      // Graceful shutdown
      kill_timeout: 30000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Logs
      error_file: './logs/green-error.log',
      out_file: './logs/green-out.log',
      merge_logs: true,
      time: true,
      
      // Deployment
      min_uptime: '10s',
      max_restarts: 10,
      
      // Health check
      health_check: {
        interval: 30,
        path: '/api/health',
        port: 3008
      }
    },
    
    // Queue Worker for Green
    {
      name: 'queue-worker-green',
      script: './queue-worker.js',
      instances: 2,
      exec_mode: 'cluster',
      
      env: {
        NODE_ENV: 'production',
        DEPLOYMENT: 'green',
        WORKER_TYPE: 'queue',
        WORKER_CONCURRENCY: 10,
        NODE_OPTIONS: '--max-old-space-size=2048'
      },
      
      autorestart: true,
      max_memory_restart: '2G',
      kill_timeout: 30000,
      
      error_file: './logs/green-queue-error.log',
      out_file: './logs/green-queue-out.log',
      merge_logs: true
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'gugaleo.axnexlabs.com.br',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/ml-agent.git',
      path: '/var/www/ml-agent-green',
      'pre-deploy': 'npm run test:production',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.green.config.js --env production',
      'pre-setup': 'mkdir -p /var/www/ml-agent-green',
      env: {
        NODE_ENV: 'production',
        DEPLOYMENT: 'green'
      }
    }
  }
}