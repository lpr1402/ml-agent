#!/bin/bash

echo "🚀 Deploy ML Agent Platform"
echo "================================"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parar processos PM2 existentes
echo -e "${BLUE}🔄 Parando processos existentes...${NC}"
pm2 stop all 2>/dev/null || true

# Copiar arquivo de ambiente de produção
echo -e "${BLUE}📝 Configurando variáveis de ambiente...${NC}"
cp .env.production .env.local

# Build do projeto
echo -e "${BLUE}🔨 Fazendo build do projeto...${NC}"
npm run build

# Iniciar com PM2
echo -e "${BLUE}🚀 Iniciando aplicação com PM2...${NC}"
pm2 start ecosystem.config.js --env production

# Salvar configuração PM2
echo -e "${BLUE}💾 Salvando configuração PM2...${NC}"
pm2 save

# Configurar PM2 para iniciar no boot
echo -e "${BLUE}⚙️ Configurando PM2 para iniciar no boot...${NC}"
pm2 startup systemd -u $USER --hp $HOME

# Status
echo -e "${GREEN}✅ Deploy concluído!${NC}"
echo ""
echo -e "${YELLOW}📌 Informações importantes:${NC}"
echo "--------------------------------"
echo -e "🌐 URL: ${GREEN}https://gugaleo.axnexlabs.com.br${NC}"
echo -e "📊 IP para DNS: ${GREEN}201.68.84.247${NC}"
echo ""
echo -e "${YELLOW}📝 Comandos úteis:${NC}"
echo "  pm2 status    - Ver status dos processos"
echo "  pm2 logs      - Ver logs em tempo real"
echo "  pm2 restart all - Reiniciar aplicação"
echo "  pm2 monit     - Monitor de recursos"
echo ""