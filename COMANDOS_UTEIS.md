# 🚀 COMANDOS ÚTEIS - SISTEMA ML API

## 🧪 VERIFICAÇÃO E TESTES

### Verificar sistema completo
```bash
npx tsx verify-system.ts
```

### Testar sincronização Full
```bash
npx tsx test-full-sync.ts
```

### TypeCheck
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

## 📊 MÉTRICAS E MONITORAMENTO

### Dashboard completo
```bash
curl https://gugaleo.axnexlabs.com.br/api/ml-metrics?format=dashboard | jq
```

### Status da fila
```bash
curl https://gugaleo.axnexlabs.com.br/api/ml-metrics?format=queue | jq
```

### Alertas ativos
```bash
curl https://gugaleo.axnexlabs.com.br/api/ml-metrics?format=alerts\&active=true | jq
```

### Histórico de métricas
```bash
curl "https://gugaleo.axnexlabs.com.br/api/ml-metrics?format=history&limit=100" | jq
```

### Exportar métricas CSV
```bash
curl "https://gugaleo.axnexlabs.com.br/api/ml-metrics?format=export&exportFormat=csv" > metricas.csv
```

## 🔄 SINCRONIZAÇÃO

### Status da última sync
```bash
curl https://gugaleo.axnexlabs.com.br/api/stock/sync-full | jq
```

### Forçar sincronização
```bash
curl -X POST https://gugaleo.axnexlabs.com.br/api/stock/sync-full \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### Sincronizar conta específica
```bash
curl -X POST https://gugaleo.axnexlabs.com.br/api/stock/sync-full \
  -H "Content-Type: application/json" \
  -d '{"mlAccountIds": ["ACCOUNT_ID"], "force": true}'
```

## 📦 PM2

### Status
```bash
pm2 status
```

### Logs gerais
```bash
pm2 logs --lines 100
```

### Logs do Orchestrator
```bash
pm2 logs ml-system-orchestrator --lines 50
```

### Logs de webhooks
```bash
pm2 logs ml-agent | grep -i webhook
```

### Logs de stock
```bash
pm2 logs ml-agent | grep -i stock
```

### Restart tudo
```bash
pm2 restart all
```

### Reiniciar apenas Orchestrator
```bash
pm2 restart ml-system-orchestrator
```

## 🔍 DATABASE QUERIES

### Contar snapshots
```bash
npx tsx -e "
import { prisma } from './lib/prisma'
const count = await prisma.fullStockSnapshot.count()
console.log('Snapshots:', count)
await prisma.\$disconnect()
"
```

### Ver última operação de estoque
```bash
npx tsx -e "
import { prisma } from './lib/prisma'
const op = await prisma.stockOperation.findFirst({
  orderBy: { dateCreated: 'desc' },
  include: { snapshot: { select: { itemTitle: true } } }
})
console.log('Última operação:', op?.operationType, op?.snapshot.itemTitle)
await prisma.\$disconnect()
"
```

### Ver contas ML
```bash
npx tsx -e "
import { prisma } from './lib/prisma'
const accounts = await prisma.mLAccount.findMany({
  where: { isActive: true },
  select: { nickname: true, siteId: true }
})
console.log('Contas:', accounts)
await prisma.\$disconnect()
"
```

## 🔧 TROUBLESHOOTING

### Limpar fila (emergência)
```bash
curl -X POST https://gugaleo.axnexlabs.com.br/api/ml-metrics \
  -H "Content-Type: application/json" \
  -d '{"action": "clear_queue"}'
```

### Reset métricas
```bash
curl -X POST https://gugaleo.axnexlabs.com.br/api/ml-metrics \
  -H "Content-Type: application/json" \
  -d '{"action": "reset_metrics"}'
```

### Verificar Redis
```bash
redis-cli ping
redis-cli dbsize
```

### Verificar PostgreSQL
```bash
psql -U mlagent -d mlagent_db -c "SELECT COUNT(*) FROM \"FullStockSnapshot\";"
```

## 🚀 DEPLOY

### Build
```bash
npm run build
```

### Deploy completo
```bash
pm2 kill
NODE_ENV=production pm2 start ecosystem.single-tenant.config.js --env production
pm2 save
```

### Ver variáveis de ambiente
```bash
pm2 env ml-system-orchestrator
```

## 📈 PERFORMANCE

### Monitor em tempo real
```bash
pm2 monit
```

### Uso de memória
```bash
pm2 list | grep -E "memory|ml-"
```

### CPU usage
```bash
top -p $(pm2 pid ml-agent)
```

---

**✅ Sistema pronto para produção 24/7!**
