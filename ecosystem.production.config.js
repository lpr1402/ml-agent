module.exports = {
  apps: [
    {
      name: "ml-agent",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      env: {
        PORT: 3007,
        NODE_ENV: "production"
      },
      watch: false,
      max_memory_restart: "1G",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      time: true,
      wait_ready: false
    }
  ]
}