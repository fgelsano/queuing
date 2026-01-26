module.exports = {
  apps: [{
    name: 'queing-backend',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5002
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    // Prevent restart loops
    max_restarts: 10,
    min_uptime: '10s',
    // Kill timeout to prevent hanging processes
    kill_timeout: 5000,
    // Wait for graceful shutdown
    shutdown_with_message: true
  }]
};
