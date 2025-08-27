#!/bin/bash

echo "🚀 Iniciando ML Agent Platform em produção"
echo "=========================================="

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Garantir que estamos na pasta correta
cd /mnt/c/Users/ti/Documents/ml-agent-platform

# Copiar arquivo de produção
echo -e "${BLUE}📝 Configurando variáveis de ambiente...${NC}"
cp .env.production .env.local

# Verificar se o build existe
if [ ! -d ".next" ]; then
    echo -e "${BLUE}🔨 Build não encontrado. Fazendo build...${NC}"
    npm run build
fi

# Iniciar aplicação diretamente na porta 3000
echo -e "${BLUE}🚀 Iniciando aplicação na porta 3000...${NC}"
PORT=3000 npm start