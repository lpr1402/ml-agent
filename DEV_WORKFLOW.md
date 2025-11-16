# 🚀 Workflow de Desenvolvimento - Next.js 16 + React 19.2

## ✅ Ambiente Configurado

- **Next.js**: 16.0.3
- **React**: 19.2.0
- **Turbopack**: Estável (5-10x mais rápido)
- **Domínio**: https://gugaleo.axnexlabs.com.br (dev e produção)
- **Nginx**: Já configurado com WebSocket (hot reload funcionando)

## 📦 Modo Desenvolvimento (Hot Reload)

### 1. Parar Produção
```bash
pm2 stop ml-agent
# OU parar todos os processos:
pm2 stop all
```

### 2. Iniciar Dev Server
```bash
npm run dev
```

**O que acontece:**
- Next.js 16 com Turbopack inicia na porta 3007
- Hot reload INSTANTÂNEO via WebSocket
- Nginx proxy reverso: `https://gugaleo.axnexlabs.com.br` → `localhost:3007`
- Mudanças no código aparecem em **< 1 segundo** no browser

### 3. Acessar
```
https://gugaleo.axnexlabs.com.br
```

### 4. Desenvolver
- Edite arquivos em `app/`, `components/`, etc
- Salve (Ctrl+S)
- Browser atualiza AUTOMATICAMENTE
- **NÃO precisa dar build!**

## 🔄 Voltar para Produção

### 1. Parar Dev Server
```bash
# No terminal onde rodou npm run dev:
Ctrl + C
```

### 2. Build
```bash
npm run build
```

### 3. Iniciar Produção
```bash
NODE_ENV=production pm2 start ecosystem.single-tenant.config.js --env production
```

## 🎯 Scripts Disponíveis

```bash
# Desenvolvimento (hot reload)
npm run dev              # Dev server na porta 3007

# Debug mode (logs detalhados)
npm run dev:debug        # Dev com debug habilitado

# Produção
npm run build            # Build otimizado
npm start                # Start produção (porta 3007)

# Qualidade de código
npm run lint             # ESLint
npm run typecheck        # TypeScript check
npm run check            # Lint + TypeCheck + Tests
```

## 🚀 Next.js 16 Features Habilitadas

### Turbopack (Estável)
- 5-10x Fast Refresh mais rápido
- 2-5x builds mais rápidos
- **Ativado automaticamente** em `npm run dev`

### React 19.2 Features
```typescript
// ✅ useEffectEvent (novo hook)
import { useEffectEvent } from 'react';

function MyComponent() {
  const onSomething = useEffectEvent(() => {
    // Lógica não-reativa
  });
}

// ✅ Activity Component (pre-rendering)
<Activity mode="visible">
  <Content />
</Activity>
```

### Partial Pre-rendering (PPR)
```typescript
// experimental.ppr = 'incremental' habilitado
// Páginas com loading.tsx usam PPR automaticamente
```

### React Compiler
```typescript
// experimental.reactCompiler = true
// Otimizações automáticas de performance
```

## ⚡ Performance Tips

### Hot Reload Instantâneo
- **Cache filesystem**: 7 dias em dev
- **Watch nativo**: Sem polling (mais rápido)
- **Debounce**: 300ms (ideal)

### Headers de Segurança
- **Dev**: CSP permissivo (com `unsafe-eval` para hot reload)
- **Prod**: CSP restritivo (sem `unsafe-eval`)

### Compressão
- **Dev**: Desabilitada (velocidade)
- **Prod**: Habilitada (performance)

## 🐛 Troubleshooting

### Hot reload não funciona?
```bash
# 1. Verificar se dev server está rodando
ps aux | grep "next dev"

# 2. Verificar logs do Nginx
sudo tail -f /var/log/nginx/gugaleo.error.log

# 3. Verificar se WebSocket conecta (no browser console):
# Deve ver: [HMR] connected
```

### Erro de conexão WebSocket?
```bash
# Verificar se Nginx está rodando
sudo systemctl status nginx

# Se precisar reiniciar:
sudo systemctl restart nginx
```

### Build dá erro após atualizar?
```bash
# Limpar cache e reinstalar
npm run clean:full
```

## 📊 Comparação Dev vs Prod

| Aspecto | Dev (npm run dev) | Prod (pm2 start) |
|---------|------------------|------------------|
| Port | 3007 | 3007 |
| URL | https://gugaleo.axnexlabs.com.br | https://gugaleo.axnexlabs.com.br |
| Hot Reload | ✅ Sim | ❌ Não |
| Build | ❌ Não precisa | ✅ Sim (npm run build) |
| Performance | 🐢 Mais lento | 🚀 Otimizado |
| Source Maps | ✅ Sim | ❌ Não |
| CSP | Permissivo | Restritivo |
| Cache | Desabilitado | Habilitado |

## 🎨 Exemplo de Workflow Típico

```bash
# 1. Manhã - Começar desenvolvimento
pm2 stop ml-agent
npm run dev

# 2. Desenvolver durante o dia
# Editar arquivos → Salvar → Ver mudanças instantaneamente

# 3. Fim do dia - Deploy produção
Ctrl+C  # Parar dev server
npm run build
npm run lint && npm run typecheck  # Verificar qualidade
NODE_ENV=production pm2 start ecosystem.single-tenant.config.js --env production
pm2 save
```

## ⚠️ Importante

- **Nginx**: NÃO precisa alterar configuração (já tem WebSocket)
- **PM2**: Parar antes de iniciar dev server (conflito de porta 3007)
- **Database**: Mesma em dev e prod (cuidado com dados)
- **Redis**: Mesmo em dev e prod (sessões compartilhadas)

---

**Última atualização**: 13/11/2025 - Next.js 16.0.3 + React 19.2.0
