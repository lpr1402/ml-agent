#!/bin/sh
# Fix WebhookQueue Redis connection
sed -i "s/127.0.0.1/host.docker.internal/g" /app/lib/queue/webhook-queue.js 2>/dev/null || true

# Disable APM metrics if causing issues
export ENABLE_METRICS=false

# Start the application
exec npm run start
