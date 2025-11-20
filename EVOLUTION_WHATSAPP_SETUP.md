# 📱 Evolution API WhatsApp - Configuração e Documentação

**Data de Migração**: 19 de Novembro de 2025
**Status**: ✅ **PRODUÇÃO ATIVA**

## 🎯 Resumo da Migração

Migração completa de **Zapster API** (serviço externo, instância desconectada) para **Evolution API** (self-hosted, rodando em `evolution.axnexlabs.com.br`).

### Benefícios da Migração

✅ **Custo Zero** - Self-hosted na nossa infraestrutura
✅ **Controle Total** - API open-source sob nosso controle
✅ **Mais Confiável** - Sem dependência de serviços externos
✅ **Mais Recursos** - Suporte completo para mídia, botões, listas, etc
✅ **Melhor Performance** - Mesma infraestrutura, latência zero

---

## 🔧 Configuração Evolution API

### Servidor Evolution API

- **URL**: `https://evolution.axnexlabs.com.br`
- **Porta Local**: `8021`
- **Versão**: `2.3.6`
- **Database**: PostgreSQL (evolution_api)
- **Cache**: Redis (database 7)
- **Documentação Oficial**: https://doc.evolution-api.com/v2

### Instância WhatsApp Conectada

- **Nome**: `AxnexLabs`
- **Status**: ✅ **CONECTADO** (`open`)
- **Número**: `5519996734345`
- **Profile**: `AXNEXLabs`
- **Grupo de Notificações**: `120363420949294702@g.us`

---

## ⚙️ Variáveis de Ambiente

Configuradas em `.env.production`:

```bash
# Evolution API - WhatsApp (Production Self-Hosted)
EVOLUTION_API_URL="https://evolution.axnexlabs.com.br"
EVOLUTION_API_KEY="Ev0lut10n@AxnexLabs2025!"
EVOLUTION_INSTANCE_NAME="AxnexLabs"
EVOLUTION_GROUP_ID="120363420949294702@g.us"
```

**⚠️ IMPORTANTE**: O formato de grupo na Evolution API é `{group_id}@g.us`, diferente do Zapster que usava `group:{group_id}`.

---

## 📤 Tipos de Notificações Enviadas

### 1. Nova Pergunta Recebida

**Arquivo**: `app/api/n8n/response/route.ts`
**Trigger**: Quando o N8N processa uma pergunta e gera resposta da IA
**Formato**:

```
*PERGUNTA - 12/1911*
*Conta:* ELITESAUDEANIMAL

*Pergunta do Cliente:*
_Este produto está disponível para entrega imediata?_

*Produto:* iPhone 15 Pro Max 256GB
*Preço:* R$ 8.999,90

*📱 Abrir ML Agent:*
https://gugaleo.axnexlabs.com.br/agente?source=whatsapp&utm_medium=notification

_💡 Clique no link para abrir direto no app e responder todas as perguntas pendentes_
```

### 2. Resposta Enviada ao Cliente

**Arquivos**:
- `app/api/agent/approve-question/route.ts` (endpoint principal)
- `app/api/public/approve/[questionId]/route.ts` (aprovação via link)
- `app/api/agent/quick-approve/[questionId]/route.ts` (quick approve)
- `app/api/answer/approve/route.ts` (aprovação por token)
- `app/api/secure/approve-with-token/route.ts` (token seguro)

**Trigger**: Após resposta ser enviada com sucesso ao Mercado Livre
**Formato**:

```
✅ *RESPOSTA ENVIADA - 12/1911*
*Conta:* ELITESAUDEANIMAL

_Confirmado: Resposta entregue ao cliente no Mercado Livre_
```

### 3. Erro no Processamento *(disponível mas não usado)*

**Método**: `evolutionWhatsAppService.sendErrorNotification()`

```
⚠️ *ERRO NA PERGUNTA #12346*

❌ *Erro:* Token expirado

🔄 *Reprocessar:*
https://gugaleo.axnexlabs.com.br/agente

_Por favor, verifique manualmente no Mercado Livre._
```

### 4. Métricas Diárias *(disponível mas não usado)*

**Método**: `evolutionWhatsAppService.sendDailyMetrics()`

```
📊 *RESUMO DIÁRIO - ML AGENT*

📈 *Métricas de Hoje:*
• Total de Perguntas: 150
• Perguntas Respondidas: 148
• Tempo Médio de Resposta: 12 minutos
• Taxa de Aprovação Automática: 95.5%

💪 Continue o excelente trabalho!
```

---

## 🔍 Validações Implementadas

### ✅ Sequential ID Correto

**ANTES (ERRADO)**:
```typescript
sequentialId: parseInt(question.id.slice(-6), 16) || 0  // ❌ Calculado, não persiste
```

**DEPOIS (CORRETO)**:
```typescript
sequentialId: question.sequentialId || '00/0000'  // ✅ Do banco de dados
```

O `sequentialId` é gerado UMA VEZ quando a pergunta é recebida e NUNCA muda. Isso garante que a mesma pergunta tenha o mesmo ID nas notificações de "recebida" e "enviada".

### ✅ Parâmetros Completos

Todos os pontos de envio validados:
- ✅ `sequentialId`: Do banco (campo `question.sequentialId`)
- ✅ `questionText`: Texto da pergunta
- ✅ `productTitle`: Título do produto
- ✅ `productPrice`: Preço (opcional)
- ✅ `sellerName`: Nome da conta ML (`mlAccount.nickname`)
- ✅ `finalAnswer`: Resposta enviada
- ✅ `approved`: Boolean (sempre true nas confirmações)

---

## 🧪 Testes Realizados

### Script de Teste

**Arquivo**: `scripts/test-evolution.ts`
**Comando**: `npx tsx scripts/test-evolution.ts`

**Resultado**: ✅ **TODOS OS TESTES PASSARAM (5/5)**

```
✅ 1. Conexão com Evolution API
✅ 2. Notificação de nova pergunta
✅ 3. Notificação de confirmação de resposta
✅ 4. Notificação de erro
✅ 5. Notificação de métricas diárias
```

Todas as 5 mensagens foram enviadas com sucesso para o grupo WhatsApp.

---

## 📁 Arquivos Modificados

### Criados

- ✅ `lib/services/evolution-whatsapp.ts` - Serviço principal
- ✅ `scripts/test-evolution.ts` - Script de testes

### Atualizados

- ✅ `.env.production` - Variáveis de ambiente
- ✅ `app/api/agent/approve-question/route.ts`
- ✅ `app/api/public/approve/[questionId]/route.ts`
- ✅ `app/api/agent/quick-approve/[questionId]/route.ts`
- ✅ `app/api/answer/approve/route.ts`
- ✅ `app/api/n8n/response/route.ts`
- ✅ `app/api/secure/approve-with-token/route.ts`
- ✅ `app/api/agent/webhook/route.ts`

### Removidos

- ❌ `lib/services/zapster-whatsapp.ts` (substituído)
- ❌ `scripts/test-zapster.ts` (substituído)

---

## 🚀 Deploy e Produção

### Build e Restart

```bash
# Build da aplicação
npm run build

# Restart PM2
pm2 restart ml-agent ml-agent-queue ml-agent-worker

# Verificar status
pm2 status | grep ml-agent
pm2 logs ml-agent --lines 50
```

### Status Atual (19/11/2025 - 22:00)

```
✅ ml-agent              - online (PID 55782)
✅ ml-agent-queue        - online (PID 55783)
✅ ml-agent-worker       - online (PID 55796)
✅ ml-agent-websocket    - online (PID 55802)
✅ ml-agent-token-m...   - online (PID 55817)
✅ ml-system-orch...     - online (PID 55828)
✅ ml-agent-reconc...    - online (PID 55917)
```

**Todos os serviços rodando perfeitamente!** 🎉

---

## 📡 Evolution API - Endpoints Utilizados

### Enviar Mensagem de Texto

```http
POST https://evolution.axnexlabs.com.br/message/sendText/AxnexLabs
Headers:
  apikey: Ev0lut10n@AxnexLabs2025!
  Content-Type: application/json

Body:
{
  "number": "120363420949294702@g.us",
  "text": "Mensagem aqui",
  "linkPreview": true,
  "delay": 0
}
```

**Resposta** (201 Created):
```json
{
  "key": {
    "remoteJid": "120363420949294702@g.us",
    "fromMe": true,
    "id": "3EB0CD091D080A60834099"
  },
  "message": { ... },
  "messageTimestamp": "1732053482",
  "status": "PENDING"
}
```

### Verificar Status da Instância

```http
GET https://evolution.axnexlabs.com.br/instance/connectionState/AxnexLabs
Headers:
  apikey: Ev0lut10n@AxnexLabs2025!
```

---

## 🔐 Segurança

- ✅ API Key armazenada em variável de ambiente
- ✅ Não commitada no repositório
- ✅ Logs não expõem credenciais completas
- ✅ Self-hosted (sem terceiros com acesso aos dados)
- ✅ SSL/TLS (HTTPS) em todas as comunicações

---

## 📊 Monitoramento

### Logs de Produção

```bash
# Ver logs em tempo real
pm2 logs ml-agent

# Ver apenas Evolution API logs
pm2 logs ml-agent | grep Evolution

# Ver últimas 100 linhas
pm2 logs ml-agent --lines 100
```

### Métricas

- **Taxa de Sucesso**: Monitorada via logs `[Evolution] ✅`
- **Falhas**: Logadas como `[Evolution] ❌`
- **Erros Críticos**: `[Evolution] ERRO CRÍTICO`

---

## 🐛 Troubleshooting

### Mensagem não enviada

1. **Verificar instância Evolution API**:
```bash
sudo -u postgres psql -d evolution_api -c "SELECT name, \"connectionStatus\" FROM \"Instance\" WHERE name='AxnexLabs';"
```

2. **Verificar logs**:
```bash
pm2 logs ml-agent | grep "Evolution"
```

3. **Testar manualmente**:
```bash
npx tsx scripts/test-evolution.ts
```

### Evolution API desconectada

1. **Verificar status do PM2**:
```bash
pm2 status | grep evolution
```

2. **Restart Evolution API**:
```bash
cd /root/evolution-api
pm2 restart evolution-api
```

3. **Verificar logs Evolution**:
```bash
pm2 logs evolution-api --lines 50
```

---

## 📞 Contatos e Suporte

- **Evolution API Documentation**: https://doc.evolution-api.com/v2
- **Evolution API GitHub**: https://github.com/EvolutionAPI/evolution-api
- **WhatsApp Grupo**: Verificar mensagens de teste enviadas

---

## ✅ Checklist de Produção

- [x] Variáveis de ambiente configuradas
- [x] Serviço Evolution WhatsApp criado
- [x] Todas as referências Zapster removidas
- [x] Sequential ID corrigido em todos os pontos
- [x] Logs atualizados para "Evolution"
- [x] Build de produção executado
- [x] PM2 restartado com sucesso
- [x] Testes de envio realizados (5/5 ✅)
- [x] Documentação completa criada
- [x] Sistema em produção ativo

---

**🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!**

*Documento criado em: 19/11/2025 - 22:00*
*Última atualização: 19/11/2025 - 22:00*
