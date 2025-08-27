#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  🚀 ML AGENT - PRODUÇÃO                      ║"
echo "║              Sistema Inteligente de Atendimento              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ .env.local file not found!${NC}"
    echo "Please copy .env.example to .env.local and configure it."
    exit 1
fi

echo -e "${GREEN}✅ Environment file found${NC}"

# Start Docker services
echo -e "${BLUE}🐳 Starting Docker services...${NC}"
docker-compose up -d
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker services started${NC}"
    sleep 5
else
    echo -e "${RED}❌ Failed to start Docker services${NC}"
    exit 1
fi

# Verify Redis
echo -e "${BLUE}🔍 Verifying Redis...${NC}"
if docker exec ml-agent-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is running${NC}"
else
    echo -e "${RED}❌ Redis is not responding${NC}"
    exit 1
fi

# Verify PostgreSQL
echo -e "${BLUE}🔍 Verifying PostgreSQL...${NC}"
if docker exec ml-agent-postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not responding${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Generate Prisma Client
echo -e "${YELLOW}🔧 Generating Prisma Client...${NC}"
npx prisma generate

# Run migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
npx prisma migrate deploy
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migrations completed${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi

# Build the application
echo -e "${YELLOW}🏗️  Building application for production...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build completed${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Start with PM2
echo -e "${BLUE}🚀 Starting application with PM2...${NC}"
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  ✅ SISTEMA PRONTO PARA USO!                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "🔗 Aplicação: http://localhost:3000"
echo ""
echo "📱 WhatsApp Zapster:"
echo "   • Botões: [✅ Aprovar] [✏️ Editar]"
echo "   • Imagens de produtos incluídas"
echo ""
echo "⚙️ Funcionalidades:"
echo "   ✅ Webhook ML ativo"
echo "   ✅ GPT-5 Turbo configurado"
echo "   ✅ WhatsApp com botões interativos"
echo "   ✅ Aprovação rápida via botão"
echo ""
echo "📝 Comandos:"
echo "   pm2 logs        - Ver logs"
echo "   pm2 monit       - Monitor"
echo "   pm2 restart all - Reiniciar"
echo ""