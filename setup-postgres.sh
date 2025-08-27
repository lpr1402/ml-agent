#!/bin/bash

echo "🐘 Configurando PostgreSQL para ML Agent"
echo "========================================"

# Verificar se PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL não está instalado."
    echo "Para instalar:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
    echo "  macOS: brew install postgresql"
    echo ""
    echo "Usando Docker como alternativa..."
    
    # Tentar usar Docker
    if command -v docker &> /dev/null; then
        echo "Iniciando PostgreSQL via Docker..."
        docker run -d \
            --name ml-agent-postgres \
            -e POSTGRES_USER=postgres \
            -e POSTGRES_PASSWORD=postgres \
            -e POSTGRES_DB=ml_agent \
            -p 5432:5432 \
            postgres:15-alpine
        
        if [ $? -eq 0 ]; then
            echo "✅ PostgreSQL iniciado via Docker"
            sleep 5
        else
            echo "❌ Erro ao iniciar PostgreSQL"
            exit 1
        fi
    else
        echo "❌ Docker também não está disponível"
        exit 1
    fi
else
    echo "✅ PostgreSQL está instalado"
    
    # Verificar se o serviço está rodando
    if ! pg_isready -h localhost -p 5432 &> /dev/null; then
        echo "PostgreSQL não está rodando. Tentando iniciar..."
        sudo service postgresql start 2>/dev/null || \
        pg_ctl -D /usr/local/var/postgres start 2>/dev/null || \
        brew services start postgresql 2>/dev/null || \
        echo "Não foi possível iniciar PostgreSQL automaticamente"
    fi
fi

# Criar banco de dados se não existir
echo "Criando banco de dados ml_agent..."
createdb -h localhost -U postgres ml_agent 2>/dev/null || echo "Banco já existe ou erro ao criar"

echo ""
echo "✅ PostgreSQL configurado!"
echo "DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ml_agent"
echo ""