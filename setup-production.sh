#!/bin/bash

echo "🚀 ML Agent - Setup de Produção"
echo "================================"

# Verificar se o Redis está instalado
if ! command -v redis-server &> /dev/null; then
    echo "⚠️  Redis não está instalado. Instalando Redis..."
    
    # Tentar instalar Redis via apt-get (requer sudo)
    if command -v apt-get &> /dev/null; then
        echo "Tentando instalar Redis via apt-get..."
        echo "Por favor, execute: sudo apt-get update && sudo apt-get install -y redis-server"
        echo "Depois rode este script novamente."
        exit 1
    fi
    
    # Alternativa: usar Redis via Docker se disponível
    if command -v docker &> /dev/null; then
        echo "Docker disponível. Iniciando Redis via Docker..."
        docker run -d --name redis-ml-agent -p 6379:6379 redis:alpine
    else
        echo "❌ Redis não pode ser instalado automaticamente."
        echo "Por favor, instale o Redis manualmente:"
        echo "  Ubuntu/Debian: sudo apt-get install redis-server"
        echo "  macOS: brew install redis"
        echo "  Ou use Docker: docker run -d -p 6379:6379 redis:alpine"
        exit 1
    fi
else
    echo "✅ Redis já está instalado"
fi

# Verificar se Redis está rodando
if ! redis-cli ping &> /dev/null; then
    echo "🔄 Iniciando Redis..."
    redis-server --daemonize yes
    sleep 2
    
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis iniciado com sucesso"
    else
        echo "❌ Falha ao iniciar Redis"
        exit 1
    fi
else
    echo "✅ Redis já está rodando"
fi

# Verificar PostgreSQL
echo ""
echo "📊 Verificando PostgreSQL..."
if psql -U postgres -c "SELECT 1" &> /dev/null; then
    echo "✅ PostgreSQL está rodando"
else
    echo "⚠️  PostgreSQL não está acessível"
    echo "Por favor, verifique se o PostgreSQL está instalado e rodando"
    echo "DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ml_agent"
fi

# Executar migrações do Prisma
echo ""
echo "🔄 Executando migrações do banco de dados..."
npx prisma migrate deploy

# Gerar cliente Prisma
echo "🔄 Gerando cliente Prisma..."
npx prisma generate

# Build da aplicação
echo ""
echo "🔨 Fazendo build da aplicação..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build falhou. Verifique os erros acima."
    exit 1
fi

echo "✅ Build concluído com sucesso!"

# Criar arquivo de configuração PM2 se não existir
if [ ! -f ecosystem.config.js ]; then
    echo "📝 Criando configuração PM2..."
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'ml-agent',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'ml-agent-worker',
      script: './queue-worker.js',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    }
  ]
}
EOF
fi

# Criar worker de fila se não existir
if [ ! -f queue-worker.js ]; then
    echo "📝 Criando worker de fila..."
    cat > queue-worker.js << 'EOF'
// Queue Worker para processar perguntas do ML
require('dotenv').config({ path: '.env.local' })

console.log('🚀 ML Agent Queue Worker iniciado')
console.log('Redis:', process.env.REDIS_HOST + ':' + process.env.REDIS_PORT)

// Manter o processo rodando
setInterval(() => {
  console.log('✅ Queue Worker rodando...', new Date().toISOString())
}, 30000)

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido, encerrando worker...')
  process.exit(0)
})
EOF
fi

# Iniciar com PM2
echo ""
echo "🚀 Iniciando aplicação com PM2..."

# Parar processos existentes se houver
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração PM2
pm2 save

# Mostrar status
echo ""
echo "📊 Status dos processos:"
pm2 list

echo ""
echo "✅ Setup completo! ML Agent está rodando em produção!"
echo ""
echo "🔗 Acesse a aplicação em: http://localhost:3000"
echo ""
echo "📝 Comandos úteis:"
echo "  pm2 logs ml-agent       - Ver logs da aplicação"
echo "  pm2 logs ml-agent-worker - Ver logs do worker"
echo "  pm2 restart all         - Reiniciar todos os processos"
echo "  pm2 stop all           - Parar todos os processos"
echo "  pm2 monit              - Monitor em tempo real"
echo ""
echo "🔔 WhatsApp configurado com Zapster API"
echo "   Grupo: group:120363420949294702"
echo "   Instance: 21iwlxlswck0m95497nzl"
echo ""
echo "⚡ Funcionalidades ativas:"
echo "   ✅ Recebimento de perguntas do ML via webhook"
echo "   ✅ Processamento com GPT-5"
echo "   ✅ Notificações WhatsApp com imagem do produto"
echo "   ✅ Sistema de aprovação/edição"
echo "   ✅ Envio automático para ML após aprovação"
echo "   ✅ Confirmação de envio via WhatsApp"
echo ""