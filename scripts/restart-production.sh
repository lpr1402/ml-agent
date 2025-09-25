#!/bin/bash

echo "🔄 Restarting ML Agent in Production..."

# Navigate to project directory
cd /root/ml-agent

# Pull latest changes if using git
# git pull origin main

# Install dependencies if package.json changed
npm ci --production

# Build the application
echo "📦 Building application..."
npm run build

# Restart PM2 process
echo "🚀 Restarting PM2 process..."
pm2 restart ecosystem.config.js --only ml-agent

# Save PM2 configuration
pm2 save

# Check health after 10 seconds
sleep 10
curl -f http://localhost:3007/api/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ ML Agent restarted successfully and is healthy!"
else
    echo "⚠️ Warning: Health check failed after restart"
fi

echo "📊 Current PM2 status:"
pm2 status