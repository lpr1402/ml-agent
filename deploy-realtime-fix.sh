#!/bin/bash

# Script de Deploy - Correções Real-Time ML Agent
# Aplica todas as correções e reinicia os serviços

echo "🚀 ML Agent - Aplicando correções de real-time e WebSocket"
echo "=================================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar sucesso
check_success() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1 concluído com sucesso${NC}"
    else
        echo -e "${RED}✗ Erro em $1${NC}"
        exit 1
    fi
}

# 1. Parar todos os processos PM2
echo -e "${YELLOW}📦 Parando processos PM2...${NC}"
pm2 stop all
check_success "Stop PM2"

# 2. Limpar logs antigos
echo -e "${YELLOW}🧹 Limpando logs antigos...${NC}"
rm -f logs/*.log
mkdir -p logs
check_success "Limpar logs"

# 3. Instalar dependências necessárias
echo -e "${YELLOW}📦 Verificando dependências...${NC}"
npm list jsonwebtoken &>/dev/null || npm install jsonwebtoken
npm list ioredis &>/dev/null || npm install ioredis
check_success "Dependências"

# 4. Build da aplicação (se necessário)
if [ "$NODE_ENV" = "production" ]; then
    echo -e "${YELLOW}🔨 Building aplicação...${NC}"
    npm run build
    check_success "Build"
fi

# 5. Verificar Redis
echo -e "${YELLOW}🔍 Verificando Redis...${NC}"
redis-cli ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Redis está rodando${NC}"
else
    echo -e "${YELLOW}⚠️ Redis não está rodando, tentando iniciar...${NC}"
    sudo systemctl start redis || redis-server --daemonize yes
    sleep 2
    redis-cli ping > /dev/null 2>&1
    check_success "Iniciar Redis"
fi

# 6. Verificar PostgreSQL
echo -e "${YELLOW}🔍 Verificando PostgreSQL...${NC}"
pg_isready > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PostgreSQL está rodando${NC}"
else
    echo -e "${RED}✗ PostgreSQL não está acessível${NC}"
    exit 1
fi

# 7. Aplicar migrations do Prisma (se houver)
echo -e "${YELLOW}📊 Verificando migrations...${NC}"
npx prisma migrate deploy 2>/dev/null || echo "Sem migrations pendentes"
npx prisma generate
check_success "Prisma"

# 8. Recarregar Nginx
echo -e "${YELLOW}🔄 Recarregando Nginx...${NC}"
sudo nginx -t
if [ $? -eq 0 ]; then
    sudo nginx -s reload
    echo -e "${GREEN}✓ Nginx recarregado${NC}"
else
    echo -e "${RED}✗ Erro na configuração do Nginx${NC}"
    exit 1
fi

# 9. Deletar processos PM2 antigos
echo -e "${YELLOW}🗑️ Removendo processos PM2 antigos...${NC}"
pm2 delete all 2>/dev/null || true

# 10. Iniciar com nova configuração
echo -e "${YELLOW}🚀 Iniciando ML Agent com configuração otimizada...${NC}"
if [ "$NODE_ENV" = "production" ]; then
    NODE_ENV=production pm2 start ecosystem.single-tenant.config.js --env production
else
    pm2 start ecosystem.single-tenant.config.js
fi
check_success "PM2 start"

# 11. Salvar configuração do PM2
echo -e "${YELLOW}💾 Salvando configuração PM2...${NC}"
pm2 save
check_success "PM2 save"

# 12. Aguardar serviços iniciarem
echo -e "${YELLOW}⏳ Aguardando serviços iniciarem...${NC}"
sleep 5

# 13. Verificar status dos serviços
echo -e "${YELLOW}📊 Verificando status dos serviços...${NC}"
echo ""
pm2 list

# 14. Testar WebSocket
echo ""
echo -e "${YELLOW}🔍 Testando WebSocket Server...${NC}"
curl -s http://localhost:3008/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ WebSocket Server está respondendo${NC}"
    curl -s http://localhost:3008/health | jq . 2>/dev/null || curl -s http://localhost:3008/health
else
    echo -e "${RED}⚠️ WebSocket Server não está respondendo${NC}"
fi

# 15. Testar aplicação principal
echo ""
echo -e "${YELLOW}🔍 Testando aplicação principal...${NC}"
curl -s http://localhost:3007 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Aplicação está respondendo${NC}"
else
    echo -e "${RED}⚠️ Aplicação não está respondendo${NC}"
fi

# 16. Mostrar logs em tempo real
echo ""
echo -e "${GREEN}✨ Deploy concluído com sucesso!${NC}"
echo ""
echo "📝 Comandos úteis:"
echo "  pm2 status        - Ver status dos processos"
echo "  pm2 logs          - Ver todos os logs"
echo "  pm2 logs ml-agent-websocket - Ver logs do WebSocket"
echo "  pm2 monit         - Monitor em tempo real"
echo ""
echo -e "${YELLOW}📡 Monitorando logs do WebSocket (Ctrl+C para sair)...${NC}"
echo ""

# Mostrar últimas linhas dos logs
pm2 logs ml-agent-websocket --lines 50