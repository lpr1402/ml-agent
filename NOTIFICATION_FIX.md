# 🔔 Correções de Notificações e Aprovação ML

## ✅ Correções Implementadas

### 1. **Notificações do Browser (SSE)**
- ✅ Adicionado tipo `browser:notification` ao EventManager
- ✅ Corrigido listener SSE para processar eventos customizados
- ✅ Adicionado logs detalhados para debug de eventos SSE
- ✅ Corrigido URL de aprovação nas notificações

### 2. **Envio de Respostas ao Mercado Livre**
- ✅ Adicionado logs detalhados em todo fluxo de aprovação
- ✅ Melhorado tratamento de erros da API do ML
- ✅ Implementado reconhecimento de perguntas já respondidas

## 🧪 Como Testar

### 1. Testar Notificações do Browser

```bash
# Simula chegada de resposta do N8N
npx tsx test-n8n-response.ts
```

**O que acontece:**
1. Busca uma pergunta pendente no banco
2. Simula resposta da IA via endpoint `/api/n8n/response`
3. Dispara evento SSE para notificar browser
4. Você deve ver a notificação aparecer no browser

**Requisitos:**
- Browser aberto em https://gugaleo.axnexlabs.com.br/agente
- Notificações permitidas no browser
- Estar logado na plataforma

### 2. Testar Envio ao Mercado Livre

```bash
# Testa aprovação e envio ao ML
npx tsx test-ml-approval.ts
```

**O que acontece:**
1. Busca pergunta com status AWAITING_APPROVAL
2. Descriptografa token da conta ML
3. Envia resposta diretamente à API do ML
4. Mostra resultado detalhado com logs

## 🔍 Monitoramento

### Ver Logs em Tempo Real
```bash
# Logs da aplicação
pm2 logs ml-agent --lines 100

# Logs específicos de notificações
pm2 logs ml-agent | grep -i "sse\|notification\|browser"

# Logs específicos de aprovação ML
pm2 logs ml-agent | grep -i "ml api\|approve"
```

### Debug no Browser
Abra o Console do navegador (F12) e verifique:
- `[SSENotifications]` - Eventos de notificação
- `[EventManager]` - Eventos SSE sendo emitidos

## ⚠️ Troubleshooting

### Notificações não aparecem:
1. **Verifique permissões:** Browser deve ter permissão para notificações
2. **Verifique conexão SSE:** No console, deve aparecer "SSE conectado com sucesso"
3. **Verifique eventos:** Logs devem mostrar "Browser notification event detected"

### Erro ao enviar ao ML:
1. **Token expirado (401):** Refaça login em https://gugaleo.axnexlabs.com.br
2. **Pergunta já respondida (400):** Normal, sistema trata como sucesso
3. **Rate limit (429):** Aguarde alguns segundos e tente novamente

## 📊 Fluxo Completo

```
1. Webhook ML → Pergunta nova
2. N8N processa → Gera resposta IA
3. N8N envia → /api/n8n/response
4. Sistema emite → Evento SSE 'browser:notification'
5. Browser recebe → Mostra notificação
6. Usuário clica → Abre página de aprovação
7. Usuário aprova → /api/agent/approve-question
8. Sistema envia → API do Mercado Livre
9. ML confirma → Pergunta marcada como COMPLETED
```

## 🚀 Status

- ✅ **Notificações do browser:** FUNCIONANDO
- ✅ **Envio ao ML:** FUNCIONANDO
- ✅ **Logs detalhados:** IMPLEMENTADOS
- ✅ **Scripts de teste:** CRIADOS

## 📝 Notas Importantes

1. **Tokens do ML expiram em 6 horas** - Necessário reautenticar periodicamente
2. **SSE reconecta automaticamente** - Em caso de desconexão
3. **Perguntas já respondidas** - São tratadas como sucesso
4. **Rate limit do ML** - 2000 requisições/hora por aplicação