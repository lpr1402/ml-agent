#!/bin/bash

# ML Agent Monitor Script
# Checks health and auto-restarts if needed

LOG_FILE="/root/ml-agent/logs/monitor.log"
mkdir -p /root/ml-agent/logs

check_health() {
    curl -f -s -o /dev/null -w "%{http_code}" http://localhost:3007/api/health
}

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check if app is healthy
HTTP_STATUS=$(check_health)

if [ "$HTTP_STATUS" != "200" ]; then
    log_message "ERROR: Health check failed with status $HTTP_STATUS"
    
    # Try to restart
    log_message "Attempting to restart ML Agent..."
    
    # Check if PM2 process exists
    if pm2 show ml-agent > /dev/null 2>&1; then
        pm2 restart ml-agent
        log_message "PM2 restart command executed"
    else
        # Start with ecosystem config
        cd /root/ml-agent
        pm2 start ecosystem.config.js --only ml-agent
        log_message "PM2 start command executed"
    fi
    
    # Wait for startup
    sleep 10
    
    # Check again
    HTTP_STATUS=$(check_health)
    if [ "$HTTP_STATUS" = "200" ]; then
        log_message "SUCCESS: ML Agent recovered and is healthy"
    else
        log_message "CRITICAL: ML Agent failed to recover"
    fi
else
    log_message "INFO: Health check passed"
fi