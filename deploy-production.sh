#!/bin/bash

echo "======================================"
echo "   ML Agent Platform - Deploy Completo"
echo "   Domínio: gugaleo.axnexlabs.com.br"
echo "======================================"

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Diretório do projeto
PROJECT_DIR="/mnt/c/Users/ti/Documents/ml-agent-platform"
cd $PROJECT_DIR

# 1. Parar processos anteriores
echo -e "${BLUE}🛑 Parando processos anteriores...${NC}"
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# 2. Configurar ambiente de produção
echo -e "${BLUE}📝 Configurando ambiente de produção...${NC}"
cp .env.production .env.local

# 3. Build do projeto
echo -e "${BLUE}🔨 Fazendo build do projeto...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro no build! Verifique os logs acima.${NC}"
    exit 1
fi

# 4. Iniciar com PM2
echo -e "${BLUE}🚀 Iniciando aplicação com PM2...${NC}"
pm2 start ecosystem.config.js --env production

# 5. Salvar configuração PM2
echo -e "${BLUE}💾 Salvando configuração PM2...${NC}"
pm2 save
pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

# 6. Verificar status
echo -e "${GREEN}✅ Deploy concluído!${NC}"
echo ""
pm2 status

echo ""
echo -e "${YELLOW}📌 Informações importantes:${NC}"
echo "======================================"
echo -e "🌐 URL Local: ${GREEN}http://localhost:3000${NC}"
echo -e "🌐 URL Produção: ${GREEN}https://gugaleo.axnexlabs.com.br${NC}"
echo -e "📊 IP para DNS: ${GREEN}201.68.84.247${NC}"
echo ""
echo -e "${YELLOW}⚠️  Certifique-se de que:${NC}"
echo "1. O DNS está apontando para 201.68.84.247"
echo "2. O Nginx está configurado e rodando"
echo "3. O PostgreSQL está rodando"
echo "4. O Redis está rodando (opcional)"
echo ""
echo -e "${YELLOW}📝 Comandos úteis:${NC}"
echo "  pm2 logs ml-agent    - Ver logs da aplicação"
echo "  pm2 restart ml-agent - Reiniciar aplicação"
echo "  pm2 monit           - Monitor de recursos"
echo "======================================"