module.exports = {
  apps: [
    {
      name: 'ml-agent',
      script: 'npm',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    },
    {
      name: 'ml-agent-queue',
      script: './queue-worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/queue-err.log',
      out_file: './logs/queue-out.log',
      log_file: './logs/queue-combined.log',
      time: true
    },
    {
      name: 'ml-agent-worker',
      script: 'worker-simple.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://mlagent:nandao10@localhost:5432/mlagent_db?schema=public',
        OPENAI_API_KEY: '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',
        REDIS_URL: 'redis://localhost:6379',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        ZAPSTER_API_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MzgyOTM3NzgsImlzcyI6InphcHN0ZXJhcGkiLCJzdWIiOiJlMzRkYzc5Zi02OGZhLTRmMzEtOTgxNi04MmQzNTY1NmY2ZmQiLCJqdGkiOiJkYWU5MDQ0ZS05ZTk3LTRkNGItOWRlZS0yYmNjOWRjYjQwOTEifQ.XwA4vJrTG65TBWqEJ_5oo_-cr-BhOzp3C2XgJOh0NnY',
        ZAPSTER_INSTANCE_ID: '21iwlxlswck0m95497nzl',
        ZAPSTER_GROUP_ID: 'group:120363420949294702'
      },
      error_file: './logs/worker-err.log',
      out_file: './logs/worker-out.log',
      log_file: './logs/worker-combined.log',
      time: true
    }
  ]
}