# ML Agent - Produção

## Status: ✅ RODANDO EM PRODUÇÃO

**URL:** https://gugaleo.axnexlabs.com.br  
**IP VPS:** 69.62.97.134  
**Porta:** 3007

## Arquitetura

```
Internet → Traefik (443/80) → Nginx Proxy Container → PM2 → ML Agent (3007)
```

## Componentes Instalados

### 1. Aplicação Principal
- **PM2 Process:** ml-agent
- **Porta:** 3007
- **Auto-restart:** Configurado
- **Logs:** `/root/.pm2/logs/`

### 2. Banco de Dados
- **PostgreSQL:** mlagent_db
- **Usuário:** mlagent
- **Senha:** mlagent2025

### 3. Proxy & SSL
- **Container:** ml-agent-proxy (nginx)
- **Traefik:** Gerencia certificado SSL (auto-renovação)
- **Domínio:** gugaleo.axnexlabs.com.br

## Comandos Úteis

### Verificar Status
```bash
pm2 status                    # Ver processos PM2
pm2 logs ml-agent --lines 50  # Ver logs
docker ps | grep ml-agent     # Ver container proxy
```

### Restart/Start
```bash
pm2 restart ml-agent          # Restart rápido
pm2 start ecosystem.config.js --only ml-agent  # Start completo
/root/ml-agent/scripts/restart-production.sh   # Rebuild e restart
```

### Health Check
```bash
curl http://localhost:3007/api/health  # Check local
curl https://gugaleo.axnexlabs.com.br/api/health  # Check público
```

### Monitoramento
```bash
pm2 monit                     # Monitor em tempo real
tail -f /root/ml-agent/logs/monitor.log  # Ver logs do monitor
```

### Backup
```bash
/root/ml-agent/scripts/backup.sh  # Backup manual
```

## Configurações de Produção

### Environment (.env)
- Configurado para produção
- URLs apontando para gugaleo.axnexlabs.com.br
- Credenciais do Mercado Livre configuradas

### Auto-Recovery
- **PM2:** Auto-restart em caso de crash
- **Cron Monitor:** Verifica saúde a cada 5 minutos
- **Health Endpoint:** `/api/health`

### Segurança
- Apenas porta 3007 exposta localmente
- SSL/TLS gerenciado pelo Traefik
- Banco de dados apenas localhost

## Manutenção

### Atualizar Código
```bash
cd /root/ml-agent
git pull origin main
npm install
npm run build
pm2 restart ml-agent
```

### Ver Logs de Erro
```bash
pm2 logs ml-agent --err --lines 100
```

### Limpar Logs
```bash
pm2 flush ml-agent
```

### Backup Database
```bash
/root/ml-agent/scripts/backup.sh
```

## Troubleshooting

### Se o site não responder:
1. `pm2 status` - Verificar se está rodando
2. `pm2 restart ml-agent` - Tentar restart
3. `docker ps | grep ml-agent` - Verificar proxy
4. `docker restart ml-agent-proxy` - Restart proxy

### Se der erro 502:
1. Aplicação pode estar iniciando (aguarde 30s)
2. `pm2 logs ml-agent --err` - Ver erros
3. `curl http://localhost:3007` - Testar local

### Para recriar tudo:
```bash
cd /root/ml-agent
pm2 delete ml-agent
pm2 start ecosystem.config.js --only ml-agent
docker-compose -f /root/docker-compose.ml-agent.yml restart
```

## Contatos e Credenciais

Todas as credenciais estão em:
- `/root/ml-agent/.env`
- `/root/ml-agent/.env.production`

---
Sistema configurado em 27/08/2025 com as melhores práticas de produção.