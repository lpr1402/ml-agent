#!/bin/bash
# ML Agent - Development Mode Manager
# Next.js roda diretamente (sem PM2) para melhor hot reload
# Workers essenciais rodam via PM2

set -e

ECOSYSTEM_DEV="ecosystem.dev.config.js"
ECOSYSTEM_PROD="ecosystem.single-tenant.config.js"
NEXT_PID_FILE=".next-dev.pid"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

case "$1" in
  start)
    echo -e "${BLUE}🚀 Iniciando ML Agent em modo HÍBRIDO...${NC}"
    echo -e "${YELLOW}   Frontend: DEV | Workers: PRODUÇÃO${NC}"
    echo ""

    # 1. Parar processos de produção se estiverem rodando
    echo -e "${YELLOW}📋 Limpando processos anteriores...${NC}"
    pm2 delete ml-agent ml-agent-queue ml-agent-worker ml-agent-websocket \
               ml-agent-token-maintenance ml-system-orchestrator \
               ml-agent-reconciliation ml-agent-profile-sync ml-agent-push-cleanup 2>/dev/null || true

    # 2. Matar processos órfãos do Next.js
    echo -e "${YELLOW}🧹 Limpando processos órfãos do Next.js...${NC}"
    pkill -f "ml-agent/node_modules/next/dist/compiled/jest-worker" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true

    # 3. Remover PID file antigo
    rm -f $NEXT_PID_FILE

    # 4. Iniciar TODOS os workers em PRODUÇÃO via PM2
    echo -e "${BLUE}⚙️  Iniciando workers em modo PRODUÇÃO via PM2...${NC}"
    pm2 start $ECOSYSTEM_DEV

    # 5. Aguardar workers iniciarem
    sleep 3

    # 6. Iniciar Next.js diretamente em modo DEV (sem PM2) em background
    echo -e "${GREEN}🚀 Iniciando Next.js Frontend em modo DEV (hot reload ativo)...${NC}"
    echo ""

    # Rodar Next.js em background e salvar PID
    NODE_ENV=development PORT=3007 HOST=0.0.0.0 npm run dev > ./logs/nextjs-dev.log 2>&1 &
    echo $! > $NEXT_PID_FILE

    echo ""
    echo -e "${GREEN}✅ Ambiente HÍBRIDO iniciado com sucesso!${NC}"
    echo ""
    echo -e "${BLUE}📍 Aplicação:${NC} https://gugaleo.axnexlabs.com.br"
    echo -e "${BLUE}📍 Local:${NC} http://localhost:3007"
    echo ""
    echo -e "${GREEN}🎯 Configuração Atual:${NC}"
    echo "   - Next.js Frontend: ${YELLOW}DESENVOLVIMENTO${NC} (hot reload ativo)"
    echo "   - Workers Backend: ${GREEN}PRODUÇÃO${NC} (processamento real)"
    echo ""
    echo -e "${YELLOW}💡 Dicas:${NC}"
    echo "   - Hot reload do frontend está ATIVO"
    echo "   - Workers processando dados REAIS de produção"
    echo "   - Logs Next.js: tail -f ./logs/nextjs-dev.log"
    echo "   - Logs Workers: pm2 logs"
    echo "   - Parar: ./dev.sh stop"
    echo "   - Status: ./dev.sh status"
    echo "   - Voltar produção completa: ./dev.sh prod"
    echo ""
    ;;

  stop)
    echo -e "${YELLOW}🛑 Parando ambiente de desenvolvimento...${NC}"

    # Parar Next.js
    if [ -f $NEXT_PID_FILE ]; then
      NEXT_PID=$(cat $NEXT_PID_FILE)
      if kill -0 $NEXT_PID 2>/dev/null; then
        echo "Parando Next.js (PID: $NEXT_PID)..."
        kill $NEXT_PID 2>/dev/null || true
        sleep 2
        kill -9 $NEXT_PID 2>/dev/null || true
      fi
      rm -f $NEXT_PID_FILE
    fi

    # Matar qualquer processo Next.js que ainda esteja rodando
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "ml-agent/node_modules/next/dist/compiled/jest-worker" 2>/dev/null || true

    # Parar TODOS os workers PM2
    pm2 delete ml-agent-queue ml-agent-worker ml-agent-websocket \
               ml-agent-token-maintenance ml-system-orchestrator \
               ml-agent-reconciliation ml-agent-profile-sync \
               ml-agent-push-cleanup 2>/dev/null || true

    echo -e "${GREEN}✅ Ambiente de desenvolvimento parado!${NC}"
    ;;

  restart)
    echo -e "${BLUE}🔄 Reiniciando ambiente de desenvolvimento...${NC}"
    $0 stop
    sleep 2
    $0 start
    ;;

  logs)
    if [ "$2" == "next" ] || [ -z "$2" ]; then
      echo -e "${BLUE}📋 Logs do Next.js (pressione Ctrl+C para sair)...${NC}"
      tail -f ./logs/nextjs-dev.log
    elif [ "$2" == "workers" ]; then
      echo -e "${BLUE}📋 Logs dos Workers PM2...${NC}"
      pm2 logs --lines 100
    else
      echo -e "${RED}Uso: ./dev.sh logs [next|workers]${NC}"
    fi
    ;;

  status)
    echo -e "${BLUE}📊 Status do ambiente HÍBRIDO:${NC}"
    echo ""

    # Status Next.js
    echo -e "${YELLOW}Frontend (DEV):${NC}"
    if [ -f $NEXT_PID_FILE ]; then
      NEXT_PID=$(cat $NEXT_PID_FILE)
      if kill -0 $NEXT_PID 2>/dev/null; then
        echo -e "  ${GREEN}✓ Next.js:${NC} Rodando em modo DEV (PID: $NEXT_PID)"
      else
        echo -e "  ${RED}✗ Next.js:${NC} Parado (PID file existe mas processo morto)"
      fi
    else
      echo -e "  ${RED}✗ Next.js:${NC} Não iniciado"
    fi

    echo ""
    echo -e "${YELLOW}Workers (PRODUÇÃO):${NC}"
    pm2 list | grep -E "(ml-agent|id|─)" || echo "  Nenhum worker rodando"
    ;;

  prod)
    echo -e "${BLUE}🔧 Voltando para modo PRODUÇÃO...${NC}"
    echo ""

    # Parar desenvolvimento
    $0 stop

    # Build de produção
    echo -e "${BLUE}📦 Fazendo build de produção...${NC}"
    npm run build

    echo ""
    echo -e "${BLUE}🚀 Iniciando ambiente de produção...${NC}"
    NODE_ENV=production pm2 start $ECOSYSTEM_PROD --env production

    echo ""
    echo -e "${GREEN}✅ Ambiente de PRODUÇÃO iniciado!${NC}"
    echo -e "${BLUE}📍 Aplicação:${NC} https://gugaleo.axnexlabs.com.br"
    ;;

  *)
    echo -e "${BLUE}ML Agent - Hybrid Development Mode Manager${NC}"
    echo ""
    echo -e "${GREEN}🎯 Modo HÍBRIDO:${NC}"
    echo "   - Frontend Next.js: ${YELLOW}DESENVOLVIMENTO${NC} (hot reload)"
    echo "   - Workers Backend: ${GREEN}PRODUÇÃO${NC} (processamento real)"
    echo ""
    echo -e "${YELLOW}Uso:${NC} ./dev.sh [comando]"
    echo ""
    echo -e "${YELLOW}Comandos disponíveis:${NC}"
    echo "  start           - Inicia modo híbrido (Frontend DEV + Workers PROD)"
    echo "  stop            - Para ambiente híbrido"
    echo "  restart         - Reinicia ambiente híbrido"
    echo "  logs [tipo]     - Mostra logs (next ou workers)"
    echo "  status          - Mostra status dos processos"
    echo "  prod            - Volta para modo produção completo (com build)"
    echo ""
    echo -e "${YELLOW}Exemplos:${NC}"
    echo "  ./dev.sh start          # Inicia modo híbrido"
    echo "  ./dev.sh logs next      # Ver logs do Next.js (frontend)"
    echo "  ./dev.sh logs workers   # Ver logs dos workers (backend)"
    echo "  ./dev.sh status         # Ver status completo"
    echo "  ./dev.sh prod           # Voltar para produção 100%"
    echo ""
    ;;
esac
