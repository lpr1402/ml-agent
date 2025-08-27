# ML Agent Platform - Guia de Instalação

## Requisitos
- Node.js 18+ 
- PostgreSQL 15+
- NPM ou Yarn

## Instalação Passo a Passo

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Banco de Dados PostgreSQL

Criar banco e usuário:
```sql
CREATE DATABASE mlagent_db;
CREATE USER mlagent WITH PASSWORD 'nandao10';
GRANT ALL PRIVILEGES ON DATABASE mlagent_db TO mlagent;
```

### 3. Configurar Variáveis de Ambiente

O arquivo `.env.local` já está configurado com:
- Credenciais do Mercado Livre
- URL do banco de dados
- Tokens de APIs

### 4. Executar Migrations do Prisma
```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Iniciar o Projeto

Desenvolvimento:
```bash
npm run dev
```

Produção:
```bash
npm run build
npm start
```

## URLs Configuradas

- **Local:** http://localhost:3000
- **Túnel Cloudflare:** https://arabic-breeding-greatly-citizens.trycloudflare.com

Para gerar novo túnel:
```bash
npx cloudflared tunnel --url http://localhost:3000
```

## Estrutura do Projeto

```
ml-agent-platform/
├── app/                 # Páginas e rotas Next.js
│   ├── api/            # Endpoints da API
│   ├── agente/         # Interface do agente
│   └── anuncios/       # Gestão de anúncios
├── components/          # Componentes React
├── lib/                # Utilitários e serviços
├── prisma/             # Schema do banco de dados
├── public/             # Arquivos estáticos
└── scripts/            # Scripts auxiliares
```

## Credenciais Importantes

**Mercado Livre App:**
- Client ID: 8077330788571096
- Client Secret: jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha

**Banco de Dados:**
- Host: localhost
- Port: 5432
- Database: mlagent_db
- User: mlagent
- Password: nandao10

## Comandos Úteis

```bash
# Verificar status do banco
npx prisma studio

# Limpar cache e rebuild
rm -rf .next node_modules
npm install
npm run build

# Logs em tempo real
npm run dev
```

## Suporte
Em caso de dúvidas, verifique os logs em:
- Console do navegador (F12)
- Terminal do servidor (npm run dev)
- Logs do PostgreSQL

---
Projeto ML Agent Platform - 2025