# 🚀 Guia de Deploy - ML Agent Platform

## 📌 Configuração DNS

**Configure o seguinte registro no seu provedor DNS:**
- **Tipo:** A
- **Nome:** gugaleo (ou @ se for o domínio principal)
- **Valor:** `201.68.84.247`
- **TTL:** 300 (5 minutos)

## 🔧 Passos para Deploy

### 1. Execute os scripts na seguinte ordem:

```bash
# 1. Configurar Nginx (execute com sudo)
sudo bash setup-nginx.sh

# 2. Build e deploy da aplicação
bash deploy.sh

# 3. Configurar SSL (execute com sudo após o DNS propagar)
sudo bash setup-ssl.sh
```

### 2. Verificar se está funcionando:

```bash
# Verificar status dos processos
pm2 status

# Ver logs em tempo real
pm2 logs

# Testar localmente
curl http://localhost:3000
```

## 📊 Monitoramento

### Comandos PM2:
```bash
pm2 status         # Ver status dos processos
pm2 logs          # Ver todos os logs
pm2 logs ml-agent # Ver logs específicos
pm2 monit         # Monitor de recursos
pm2 restart all   # Reiniciar tudo
pm2 stop all      # Parar tudo
```

### Logs Nginx:
```bash
# Logs de acesso
tail -f /var/log/nginx/gugaleo.access.log

# Logs de erro
tail -f /var/log/nginx/gugaleo.error.log
```

## 🔒 Segurança

### Firewall (ufw):
```bash
# Permitir portas necessárias
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

## 🔄 Atualizações

Para atualizar o código:
```bash
git pull origin main
npm install
npm run build
pm2 restart all
```

## 🆘 Troubleshooting

### Se o site não carregar:
1. Verifique o DNS: `nslookup gugaleo.axnexlabs.com.br`
2. Verifique Nginx: `sudo systemctl status nginx`
3. Verifique PM2: `pm2 status`
4. Verifique logs: `pm2 logs`

### Se houver erro 502:
1. Verifique se a aplicação está rodando: `pm2 status`
2. Reinicie: `pm2 restart all`
3. Verifique logs: `pm2 logs --lines 50`

## 📋 Checklist Final

- [ ] DNS configurado e propagado
- [ ] Nginx instalado e configurado
- [ ] Build do projeto concluído
- [ ] PM2 rodando a aplicação
- [ ] SSL/HTTPS funcionando
- [ ] Firewall configurado
- [ ] Backup configurado

---
**URL Final:** https://gugaleo.axnexlabs.com.br