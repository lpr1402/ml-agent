# ML Agent - Production System

**SETEMBRO 2025 | PRODUÇÃO: https://gugaleo.axnexlabs.com.br**

## 🎯 CORE PRINCIPLES

### Code Quality
- **SEMPRE** executar `npm run lint` e `npm run typecheck` antes de commits
- **NUNCA** alterar funcionalidades não solicitadas
- **SEMPRE** tratar edge cases e exceções

### Mercado Livre Integration
- Consultar MCP tools antes de implementar features ML
- Client ID: `8077330788571096`
- Client Secret: `jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha`
- Rate limit: 2000 req/hora total (500/conta)

### Security
- Tokens criptografados (AES-256-GCM)
- Webhooks validados
- Logs sem dados sensíveis

## 🔧 MCP MERCADO LIVRE CONNECTION

### Available Tools
- `mcp__mercadolibre-mcp-server__search_documentation`
- `mcp__mercadolibre-mcp-server__get_documentation_page`

### Reconnection Process
1. **Get Token**: Login at https://gugaleo.axnexlabs.com.br → Run `npx tsx get-real-token.ts`
2. **Configure MCP**:
```bash
claude mcp remove mercadolibre-mcp-server
claude mcp add mercadolibre-mcp-server -- npx -y mcp-remote https://mcp.mercadolibre.com/mcp --header "Authorization:Bearer TOKEN_HERE"
```
3. **Verify**: `claude mcp list` should show ✓ Connected

⚠️ **Note**: Tokens expire in 6 hours. OAuth only works on production domain.

## 🏗️ TECH STACK

### Core
- **Next.js 15.5.3** - React framework with App Router
- **TypeScript 5.x** - Type safety
- **Tailwind CSS** - Styling
- **PostgreSQL 16** - Primary database
- **Prisma ORM 5.x** - Database client with connection pooling
- **Redis** - Cache & session store

### Infrastructure
- **PM2** - Process management (cluster mode)
- **Nginx** - Reverse proxy
- **Docker** - Containerization
- **Bull** - Queue processing
- **ioredis** - Redis client

### Integrations
- **Mercado Livre OAuth2** - PKCE flow authentication
- **Mercado Livre API** - Product/order management
- **WhatsApp (Zapster)** - Notifications
- **N8N** - Workflow automation

## 📦 DEPLOYMENT

### Production Setup
```bash
# Build and start
npm run build
NODE_ENV=production pm2 start ecosystem.single-tenant.config.js --env production

# Monitor
pm2 status
pm2 logs --lines 100
```

### Configuration
- **URL**: https://gugaleo.axnexlabs.com.br
- **Port**: 3007
- **Instances**: 2x Next.js (cluster) + 1x Queue Worker + 1x ML Worker
- **DB Pool**: 20 connections (supports 10 ML accounts)
- **Memory**: ~1GB total
- **Rate Limit**: 500 req/hour per account

### Critical Environment Variables
```env
NODE_ENV=production
DATABASE_URL=postgresql://mlagent:mlagent2025@localhost:5432/mlagent_db
REDIS_URL=redis://localhost:6379
ML_CLIENT_ID=8077330788571096
ML_CLIENT_SECRET=jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha
ML_REDIRECT_URI=https://gugaleo.axnexlabs.com.br/api/auth/callback/mercadolibre
ENCRYPTION_KEY=[32-byte hex string required]
```

## 🎯 PROJECT GOALS

Build a production-ready SaaS that:
- Scales seamlessly with user growth
- Maintains 99.9% uptime
- Integrates flawlessly with Mercado Livre APIs
- Operates autonomously 24/7
- Supports 10+ ML accounts per organization