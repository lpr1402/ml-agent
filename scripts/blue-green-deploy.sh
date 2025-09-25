#!/bin/bash

# Blue-Green Deployment Script
# Zero-downtime deployment for ML Agent

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
NGINX_CONFIG="/etc/nginx/sites-available/ml-agent"
NGINX_BLUE_UPSTREAM="127.0.0.1:3007"
NGINX_GREEN_UPSTREAM="127.0.0.1:3008"
HEALTH_CHECK_URL_BLUE="http://127.0.0.1:3007/api/health"
HEALTH_CHECK_URL_GREEN="http://127.0.0.1:3008/api/health"
MAX_HEALTH_CHECKS=30
HEALTH_CHECK_INTERVAL=2

# Function to check which environment is active
get_active_environment() {
    if grep -q "proxy_pass.*:3007" "$NGINX_CONFIG" 2>/dev/null; then
        echo "blue"
    elif grep -q "proxy_pass.*:3008" "$NGINX_CONFIG" 2>/dev/null; then
        echo "green"
    else
        echo "unknown"
    fi
}

# Function to check health endpoint
check_health() {
    local url=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" == "200" ]; then
        return 0
    else
        return 1
    fi
}

# Function to wait for health check
wait_for_health() {
    local url=$1
    local environment=$2
    local count=0
    
    echo -e "${YELLOW}Waiting for $environment environment to be healthy...${NC}"
    
    while [ $count -lt $MAX_HEALTH_CHECKS ]; do
        if check_health "$url"; then
            echo -e "${GREEN}$environment environment is healthy!${NC}"
            return 0
        fi
        
        count=$((count + 1))
        echo -n "."
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    echo -e "${RED}$environment environment failed health check${NC}"
    return 1
}

# Function to deploy to environment
deploy_to_environment() {
    local environment=$1
    local config_file="ecosystem.${environment}.config.js"
    
    echo -e "${BLUE}Deploying to $environment environment...${NC}"
    
    # Pull latest code
    echo "Pulling latest code..."
    git pull origin main
    
    # Install dependencies
    echo "Installing dependencies..."
    npm ci --production
    
    # Build application
    echo "Building application..."
    npm run build
    
    # Run production tests
    echo "Running production tests..."
    npm run test:production || {
        echo -e "${RED}Production tests failed!${NC}"
        return 1
    }
    
    # Start/reload PM2 process
    echo "Starting $environment environment..."
    pm2 delete "$config_file" 2>/dev/null || true
    pm2 start "$config_file" --env production
    
    # Wait for environment to be healthy
    if [ "$environment" == "blue" ]; then
        wait_for_health "$HEALTH_CHECK_URL_BLUE" "$environment"
    else
        wait_for_health "$HEALTH_CHECK_URL_GREEN" "$environment"
    fi
}

# Function to switch traffic
switch_traffic() {
    local new_environment=$1
    local old_environment=$2
    
    echo -e "${YELLOW}Switching traffic from $old_environment to $new_environment...${NC}"
    
    # Create backup of current nginx config
    cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup"
    
    # Update nginx configuration
    if [ "$new_environment" == "blue" ]; then
        sed -i "s|proxy_pass.*|proxy_pass http://${NGINX_BLUE_UPSTREAM};|g" "$NGINX_CONFIG"
    else
        sed -i "s|proxy_pass.*|proxy_pass http://${NGINX_GREEN_UPSTREAM};|g" "$NGINX_CONFIG"
    fi
    
    # Test nginx configuration
    nginx -t || {
        echo -e "${RED}Nginx configuration test failed!${NC}"
        cp "${NGINX_CONFIG}.backup" "$NGINX_CONFIG"
        return 1
    }
    
    # Reload nginx
    nginx -s reload
    
    echo -e "${GREEN}Traffic switched to $new_environment environment${NC}"
}

# Function to cleanup old environment
cleanup_old_environment() {
    local environment=$1
    
    echo -e "${YELLOW}Cleaning up $environment environment...${NC}"
    
    # Wait for existing connections to drain (30 seconds)
    echo "Waiting for connections to drain..."
    sleep 30
    
    # Stop old environment
    pm2 delete "ecosystem.${environment}.config.js" 2>/dev/null || true
    
    echo -e "${GREEN}$environment environment cleaned up${NC}"
}

# Function to rollback deployment
rollback() {
    local environment=$1
    
    echo -e "${RED}Rolling back to $environment environment...${NC}"
    
    # Restore nginx configuration
    if [ -f "${NGINX_CONFIG}.backup" ]; then
        cp "${NGINX_CONFIG}.backup" "$NGINX_CONFIG"
        nginx -s reload
    fi
    
    # Ensure old environment is running
    pm2 start "ecosystem.${environment}.config.js" --env production
    
    echo -e "${YELLOW}Rollback completed${NC}"
}

# Main deployment flow
main() {
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}ML Agent Blue-Green Deployment${NC}"
    echo -e "${BLUE}=====================================${NC}"
    
    # Get current active environment
    ACTIVE_ENV=$(get_active_environment)
    
    if [ "$ACTIVE_ENV" == "unknown" ]; then
        echo -e "${YELLOW}No active environment detected. Deploying to blue...${NC}"
        TARGET_ENV="blue"
        OLD_ENV="green"
    elif [ "$ACTIVE_ENV" == "blue" ]; then
        TARGET_ENV="green"
        OLD_ENV="blue"
    else
        TARGET_ENV="blue"
        OLD_ENV="green"
    fi
    
    echo -e "${BLUE}Current active: $ACTIVE_ENV${NC}"
    echo -e "${BLUE}Deploying to: $TARGET_ENV${NC}"
    
    # Deploy to target environment
    if ! deploy_to_environment "$TARGET_ENV"; then
        echo -e "${RED}Deployment failed!${NC}"
        exit 1
    fi
    
    # Run smoke tests
    echo -e "${YELLOW}Running smoke tests...${NC}"
    if [ "$TARGET_ENV" == "blue" ]; then
        TEST_URL="http://127.0.0.1:3007"
    else
        TEST_URL="http://127.0.0.1:3008"
    fi
    
    # Basic smoke test
    if ! curl -f "$TEST_URL/api/health" > /dev/null 2>&1; then
        echo -e "${RED}Smoke tests failed!${NC}"
        rollback "$OLD_ENV"
        exit 1
    fi
    
    echo -e "${GREEN}Smoke tests passed${NC}"
    
    # Switch traffic to new environment
    if ! switch_traffic "$TARGET_ENV" "$OLD_ENV"; then
        echo -e "${RED}Traffic switch failed!${NC}"
        rollback "$OLD_ENV"
        exit 1
    fi
    
    # Monitor new environment for 60 seconds
    echo -e "${YELLOW}Monitoring new environment for 60 seconds...${NC}"
    MONITOR_COUNT=0
    MONITOR_MAX=6
    
    while [ $MONITOR_COUNT -lt $MONITOR_MAX ]; do
        if [ "$TARGET_ENV" == "blue" ]; then
            if ! check_health "$HEALTH_CHECK_URL_BLUE"; then
                echo -e "${RED}Health check failed during monitoring!${NC}"
                rollback "$OLD_ENV"
                exit 1
            fi
        else
            if ! check_health "$HEALTH_CHECK_URL_GREEN"; then
                echo -e "${RED}Health check failed during monitoring!${NC}"
                rollback "$OLD_ENV"
                exit 1
            fi
        fi
        
        MONITOR_COUNT=$((MONITOR_COUNT + 1))
        sleep 10
    done
    
    echo -e "${GREEN}New environment stable${NC}"
    
    # Cleanup old environment
    read -p "Do you want to cleanup the old $OLD_ENV environment? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cleanup_old_environment "$OLD_ENV"
    else
        echo -e "${YELLOW}Keeping $OLD_ENV environment running${NC}"
    fi
    
    echo -e "${GREEN}=====================================${NC}"
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo -e "${GREEN}Active environment: $TARGET_ENV${NC}"
    echo -e "${GREEN}=====================================${NC}"
}

# Run main function
main "$@"