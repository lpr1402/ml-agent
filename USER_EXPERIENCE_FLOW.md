# 🎯 EXPERIÊNCIA COMPLETA DO USUÁRIO - ML Agent v2.0

**Documentação**: Fluxo completo da jornada do usuário
**Data**: 02/10/2025

---

## 📱 VISÃO GERAL

O ML Agent é uma plataforma **PWA (Progressive Web App)** que funciona como aplicativo instalável no celular/desktop, respondendo perguntas do Mercado Livre automaticamente com IA 24/7.

**URL**: https://gugaleo.axnexlabs.com.br

---

## 🚀 FASE 1: PRIMEIRO ACESSO

### **1.1 - Usuário Descobre a Plataforma**

```
┌─────────────────────────────────────────────┐
│  Usuário acessa pelo celular/desktop       │
│  https://gugaleo.axnexlabs.com.br          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  PWA detecta que pode ser instalado        │
│  [📲 Adicionar à Tela Inicial]             │
└─────────────────────────────────────────────┘
```

**Arquivos envolvidos**:
- `app/manifest.ts` - Configuração PWA
- `public/sw.js` - Service Worker (funciona offline)
- `app/layout.tsx` - PWA metadata

**Funcionalidades PWA**:
- ✅ Instalável como app nativo
- ✅ Funciona offline (cache inteligente)
- ✅ Notificações push
- ✅ Ícone na home screen
- ✅ Tela cheia (sem barra do navegador)

---

## 👤 FASE 2: CADASTRO (PRIMEIRA VEZ)

### **2.1 - Tela de Login/Registro**

```
┌───────────────────────────────────────────────────┐
│           🛡️ ML Agent PRO                         │
│                                                   │
│  [Login]  [Cadastrar] ← Usuário clica aqui       │
│                                                   │
│  Nome de Usuário: [___________]                  │
│  PIN (3 dígitos):  [_] [_] [_]                   │
│  Confirmar PIN:    [_] [_] [_]                   │
│                                                   │
│           [Criar Conta]                          │
└───────────────────────────────────────────────────┘
```

**Arquivo**: `app/login/page-client.tsx`

**Fluxo**:
1. Usuário digita username (ex: "GUGALEO")
2. Usuário cria PIN de 3 dígitos (ex: "123")
3. Confirma o PIN
4. Clica "Criar Conta"

**API Call**:
```typescript
POST /api/auth/register
Body: {
  username: "GUGALEO",
  pin: "123"
}

Response: {
  success: true,
  organizationId: "cmg86hc1t0000cswzi20ur7oz"
}
```

**Arquivo backend**: `app/api/auth/register/route.ts`

**O que acontece no backend**:
```sql
-- 1. Cria organização
INSERT INTO Organization (username, pinHash, organizationName)
VALUES ('GUGALEO', 'hash_do_pin', 'GUGALEO')

-- 2. Cria sessão
INSERT INTO Session (sessionToken, organizationId, expiresAt)
VALUES ('token_seguro', 'org_id', NOW() + 7 days)

-- 3. Retorna cookie
Set-Cookie: ml-agent-session=token_seguro; HttpOnly; Secure
```

---

### **2.2 - Conectar Primeira Conta do Mercado Livre**

Após cadastro, usuário vê:

```
┌───────────────────────────────────────────────────┐
│   ✅ Conta criada com sucesso!                    │
│                                                   │
│   Agora conecte sua conta do Mercado Livre:      │
│                                                   │
│   [🔗 Conectar com Mercado Livre]                │
└───────────────────────────────────────────────────┘
```

**Fluxo OAuth PKCE** (Seguro):

```
┌──────────────┐  1. Clica "Conectar"   ┌──────────────┐
│   Usuário    │──────────────────────→ │  ML Agent    │
└──────────────┘                        └──────────────┘
                                              │
                                              │ 2. Gera code_verifier
                                              │    e code_challenge
                                              ↓
                ┌─────────────────────────────────────┐
                │  Redireciona para Mercado Livre:   │
                │  https://auth.mercadolibre.com.br  │
                │                                     │
                │  client_id: 8077330788571096       │
                │  redirect_uri: /callback           │
                │  code_challenge: xyz123...          │
                └─────────────────────────────────────┘
                              │
                              ↓
┌──────────────────────────────────────────────────┐
│   🛡️ Mercado Livre - Tela de Login              │
│                                                  │
│   Email: usuario@email.com                      │
│   Senha: ********                               │
│                                                  │
│   [Login]                                        │
└──────────────────────────────────────────────────┘
                              │
                              ↓
┌──────────────────────────────────────────────────┐
│   Autorizar ML Agent?                            │
│                                                  │
│   ✅ Ler perguntas                               │
│   ✅ Responder perguntas                         │
│   ✅ Ver dados do perfil                         │
│                                                  │
│   [Autorizar]  [Cancelar]                        │
└──────────────────────────────────────────────────┘
                              │
                              │ 3. ML retorna código
                              ↓
                ┌─────────────────────────────┐
                │  Redirect:                  │
                │  /callback?code=ABC123...   │
                └─────────────────────────────┘
                              │
                              │ 4. Exchange code por tokens
                              ↓
```

**Arquivo**: `app/api/auth/callback/mercadolibre/route.ts`

**Chamadas à API ML**:
```typescript
// 1. Trocar código por tokens
POST https://api.mercadolibre.com/oauth/token
Body: {
  grant_type: "authorization_code",
  client_id: "8077330788571096",
  client_secret: "jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha",
  code: "ABC123...",
  redirect_uri: "https://gugaleo.axnexlabs.com.br/api/auth/callback/mercadolibre",
  code_verifier: "xyz789..."
}

Response: {
  access_token: "APP_USR-123...",
  refresh_token: "TG-456...",
  expires_in: 21600, // 6 horas
  user_id: 697346348
}

// 2. Buscar dados do usuário
GET https://api.mercadolibre.com/users/me
Headers: { Authorization: "Bearer APP_USR-123..." }

Response: {
  id: 697346348,
  nickname: "GUGALEO COMÉRCIO",
  email: "contato@gugaleo.com",
  thumbnail: "https://http2.mlstatic.com/D_NQ_...",
  site_id: "MLB"
}
```

**O que o sistema salva** (com criptografia AES-256-GCM):

```sql
INSERT INTO MLAccount (
  mlUserId,
  nickname,
  email,
  thumbnail,
  accessToken,      -- ✅ CRIPTOGRAFADO
  accessTokenIV,    -- ✅ Vetor de inicialização
  accessTokenTag,   -- ✅ Tag de autenticação
  refreshToken,     -- ✅ CRIPTOGRAFADO
  refreshTokenIV,
  refreshTokenTag,
  tokenExpiresAt,
  isPrimary,        -- ✅ Primeira conta = true
  organizationId,
  isActive
) VALUES (
  '697346348',
  'GUGALEO COMÉRCIO',
  'contato@gugaleo.com',
  'https://...',
  'encrypted_token_xyz...',
  'iv_abc...',
  'tag_def...',
  'encrypted_refresh_ghi...',
  'iv_jkl...',
  'tag_mno...',
  NOW() + INTERVAL '6 hours',
  true,
  'cmg86hc1t0000cswzi20ur7oz',
  true
)
```

**Arquivo de criptografia**: `lib/security/encryption.ts`

---

### **2.3 - Configurar Webhooks Automático**

Quando a conta ML é conectada, o sistema **automaticamente** registra webhooks no Mercado Livre:

```typescript
// Sistema faz isso em background
POST https://api.mercadolibre.com/applications/8077330788571096/topics
Headers: { Authorization: "Bearer APP_USR-123..." }
Body: {
  topic: "questions",
  url: "https://gugaleo.axnexlabs.com.br/api/webhooks/mercadolibre"
}
```

**Arquivo**: `worker-simple.ts` (ML Worker)

**O que isso faz**:
- ✅ Mercado Livre envia notificação INSTANTÂNEA quando alguém faz pergunta
- ✅ Sistema processa automaticamente 24/7
- ✅ Usuário não precisa fazer nada

---

## 🏠 FASE 3: DASHBOARD PRINCIPAL

### **3.1 - Tela Principal `/agente`**

Usuário é redirecionado para dashboard:

```
┌──────────────────────────────────────────────────────────────────┐
│  🏠 ML Agent PRO                    [GUGALEO COMÉRCIO ▼] [Sair]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Dashboard] [Perguntas] [Métricas] [Histórico]                 │
│                                                                   │
│  📊 Visão Geral - Hoje                                           │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐      │
│  │ 📩 Novas    │ ✅ Enviadas │ ⏱️ Pendentes│ 🎯 Taxa     │      │
│  │    15       │     12      │      3      │    80%      │      │
│  └─────────────┴─────────────┴─────────────┴─────────────┘      │
│                                                                   │
│  💬 Últimas Perguntas                                            │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ 🟢 01/1002 - Qual o prazo de entrega?                  │     │
│  │    IA Respondeu: "Olá! O prazo é de 3-5 dias..."       │     │
│  │    [Aprovar] [Revisar] [Editar]               há 2min  │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ 🟡 02/1002 - Tem disponível em azul?                   │     │
│  │    IA Processando...                           há 30s  │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ ✅ 03/1002 - Aceita cartão?                            │     │
│  │    Enviada ao cliente!                        há 5min  │     │
│  └────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

**Arquivo**: `app/agente/page.tsx`

**Componentes**:
- `components/dashboard/ml-agent-dashboard-modern.tsx` - Cards de métricas
- `components/agent/multi-account-questions.tsx` - Lista de perguntas
- `components/ml-account-switcher.tsx` - Switcher de contas

**API Calls** (nenhuma ao ML, tudo no banco local):
```typescript
GET /api/agent/questions-multi
// Retorna perguntas do PostgreSQL

GET /api/agent/metrics-multi
// Calcula métricas do banco local

GET /api/ml-accounts/metrics
// Lista todas as contas ML da organização
```

---

## 🔄 FASE 4: PROCESSAMENTO AUTOMÁTICO 24/7

### **4.1 - Cliente Faz Pergunta no Mercado Livre**

```
┌────────────────────────────────────────┐
│  Cliente no App/Site do Mercado Livre │
│                                        │
│  Produto: Notebook Dell Inspiron 15   │
│                                        │
│  [💬 Fazer uma pergunta]               │
│                                        │
│  "Qual o prazo de entrega para SP?"   │
│                                        │
│  [Enviar]                              │
└────────────────────────────────────────┘
                  │
                  │ Cliente envia pergunta
                  ↓
         ⚡ MERCADO LIVRE ⚡
                  │
                  │ Webhook INSTANTÂNEO (< 1 segundo)
                  ↓
```

### **4.2 - Sistema Recebe Webhook**

```
POST https://gugaleo.axnexlabs.com.br/api/webhooks/mercadolibre
Headers: {
  X-Signature: "sha256=abc123...",
  X-Request-Id: "xyz789..."
}
Body: {
  "topic": "questions",
  "resource": "/questions/13437214414",
  "user_id": 697346348,
  "application_id": 8077330788571096,
  "sent": "2025-10-02T14:30:00.000Z"
}
```

**Arquivo**: `app/api/webhooks/mercadolibre/route.ts` (entry point)

**O que acontece**:

```typescript
// 1. Validar webhook (segurança)
✅ Verificar IP origem (apenas IPs do ML)
✅ Verificar signature (HMAC SHA-256)

// 2. Criar job na fila Redis (Bull Queue)
await questionQueue.add('process-question', {
  topic: 'questions',
  resource: '/questions/13437214414',
  user_id: 697346348
})

// 3. Responder 200 OK imediatamente
return Response 200 // ML considera recebido
```

### **4.3 - Worker Processa Pergunta**

**Arquivo**: `worker-simple.ts` (Worker PM2 dedicado)

```typescript
// Worker processa job da fila
questionQueue.process('process-question', async (job) => {
  const { resource, user_id } = job.data
  const questionId = '13437214414' // Extraído de /questions/13437214414

  // 1. Buscar conta ML pelo user_id
  const mlAccount = await prisma.mLAccount.findUnique({
    where: { mlUserId: '697346348' }
  })

  // 2. Chamar processador de perguntas
  await processQuestionWebhook(job.data, mlAccount)
})
```

**Arquivo**: `lib/webhooks/question-processor.ts`

**Chamadas à API ML**:

```typescript
// 1. Buscar detalhes completos da pergunta
GET https://api.mercadolibre.com/questions/13437214414
Headers: { Authorization: "Bearer <token_da_conta>" }

Response: {
  id: 13437214414,
  text: "Qual o prazo de entrega para SP?",
  status: "UNANSWERED",
  date_created: "2025-10-02T14:30:00.000Z",
  item_id: "MLB2345678901",
  seller_id: 697346348,
  from: {
    id: 123456789,
    answered_questions: 0
  }
}

// 2. Buscar dados do produto (com cache)
GET https://api.mercadolibre.com/items/MLB2345678901
Headers: { Authorization: "Bearer <token>" }

Response: {
  id: "MLB2345678901",
  title: "Notebook Dell Inspiron 15 I5 8gb 256gb Ssd",
  price: 2999.90,
  permalink: "https://produto.mercadolibre.com.br/...",
  thumbnail: "https://http2.mlstatic.com/...",
  available_quantity: 5,
  shipping: {
    free_shipping: true,
    mode: "me2"
  }
}

// 3. Buscar descrição do produto (opcional)
GET https://api.mercadolibre.com/items/MLB2345678901/description
Headers: { Authorization: "Bearer <token>" }

Response: {
  text: "Notebook novo lacrado com garantia de 1 ano...",
  plain_text: "Descrição completa do produto..."
}
```

### **4.4 - Salvar no Banco de Dados**

```sql
-- Sistema salva pergunta com UPSERT (evita duplicação)
INSERT INTO Question (
  mlQuestionId,
  mlAccountId,
  sellerId,
  customerId,
  itemId,
  itemTitle,
  itemPrice,
  itemPermalink,
  text,
  status,
  sequentialId,
  dateCreated,
  receivedAt
) VALUES (
  '13437214414',
  'cmg86hr7l0005cswzye0tegop', -- ID da conta ML
  '697346348',
  '123456789',
  'MLB2345678901',
  'Notebook Dell Inspiron 15 I5 8gb 256gb Ssd',
  2999.90,
  'https://produto.mercadolibre.com.br/...',
  'Qual o prazo de entrega para SP?',
  'PROCESSING', -- Status inicial
  '01/0210', -- ID sequencial (01 do dia 02/10)
  '2025-10-02T14:30:00.000Z',
  NOW()
)
ON CONFLICT (mlQuestionId) DO UPDATE
SET status = EXCLUDED.status; -- Evita duplicação
```

### **4.5 - Enviar para IA Processar (N8N)**

**Arquivo**: `lib/webhooks/n8n-payload-builder.ts`

```typescript
// Preparar payload COMPLETO para a IA
const n8nPayload = {
  question_id: '13437214414',
  question_text: 'Qual o prazo de entrega para SP?',

  // Dados do produto
  product: {
    id: 'MLB2345678901',
    title: 'Notebook Dell Inspiron 15 I5 8gb 256gb Ssd',
    price: 2999.90,
    free_shipping: true,
    available_quantity: 5,
    description: 'Notebook novo lacrado com garantia...'
  },

  // Dados do vendedor
  seller: {
    nickname: 'GUGALEO COMÉRCIO',
    reputation: { ... }
  },

  // Histórico do comprador (se comprou antes)
  buyer_history: [],

  // Contexto adicional
  context: {
    shipping_mode: 'me2',
    location: 'SP'
  }
}

// Enviar para N8N
POST https://dashboard.axnexlabs.com.br/webhook/processamento
Body: n8nPayload

// N8N processa com IA (Claude/ChatGPT)
// Retorna resposta em ~5-15 segundos
```

**N8N Workflow** (externo):
```
1. Recebe payload
2. Envia para Claude AI/ChatGPT
3. IA gera resposta personalizada
4. Retorna para ML Agent
```

**Sistema recebe resposta da IA**:

**Arquivo**: `app/api/n8n/response/route.ts`

```typescript
POST /api/n8n/response
Body: {
  question_id: '13437214414',
  output: 'Olá! O prazo de entrega para SP é de 3-5 dias úteis com frete grátis! 📦',
  confidence: 0.95
}

// Sistema atualiza pergunta
UPDATE Question SET
  aiSuggestion = 'Olá! O prazo de entrega para SP é de 3-5 dias...',
  aiConfidence = 0.95,
  aiProcessedAt = NOW(),
  status = 'AWAITING_APPROVAL' -- ✅ Aguardando aprovação
WHERE mlQuestionId = '13437214414'
```

### **4.6 - Notificar Usuário em Tempo Real**

**WebSocket + Push Notification**:

```typescript
// 1. WebSocket emite evento (usuário está online)
io.to(organizationId).emit('question:processed', {
  questionId: '13437214414',
  sequentialId: '01/0210',
  text: 'Qual o prazo de entrega para SP?',
  aiSuggestion: 'Olá! O prazo de entrega...',
  status: 'AWAITING_APPROVAL'
})

// 2. Push Notification (se app instalado)
await webpush.sendNotification(subscription, {
  title: '💬 Nova Pergunta - GUGALEO COMÉRCIO',
  body: 'Qual o prazo de entrega para SP?',
  icon: '/mlagent-logo-3d.png',
  badge: '/badge.png',
  data: {
    questionId: '13437214414',
    url: '/agente?questionId=13437214414'
  }
})

// 3. WhatsApp (Zapster) - opcional
await zapsterService.sendQuestionNotification({
  to: '+5511999999999',
  message: `
🔔 Nova Pergunta ML Agent

📦 Produto: Notebook Dell Inspiron 15
💬 Pergunta: Qual o prazo de entrega para SP?

🤖 IA sugeriu:
"Olá! O prazo de entrega para SP é de 3-5 dias úteis com frete grátis! 📦"

✅ Aprovar: https://gugaleo.axnexlabs.com.br/approve/token123
📝 Revisar: https://gugaleo.axnexlabs.com.br/agente?q=13437214414
  `
})
```

**Arquivos**:
- `lib/websocket/emit-events.ts` - WebSocket events
- `app/api/push/send/route.ts` - Push notifications
- `lib/services/zapster-whatsapp.ts` - WhatsApp

---

## ✅ FASE 5: USUÁRIO APROVA RESPOSTA

### **5.1 - Usuário Vê Notificação**

```
┌────────────────────────────────┐
│  📱 iPhone/Android             │
│  ───────────────────────────   │
│  💬 ML Agent PRO               │
│  Nova Pergunta - GUGALEO       │
│                                │
│  Qual o prazo de entrega       │
│  para SP?                      │
│                                │
│  [Abrir] [Fechar]              │
└────────────────────────────────┘
```

Usuário clica "Abrir" → Abre o app

### **5.2 - Tela de Aprovação**

```
┌──────────────────────────────────────────────────────────┐
│  💬 Pergunta #01/0210                           há 30s   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  📦 Notebook Dell Inspiron 15 I5 8gb 256gb Ssd          │
│  R$ 2.999,90                                             │
│                                                           │
│  👤 Cliente: João Silva (Novo)                          │
│  💬 "Qual o prazo de entrega para SP?"                   │
│                                                           │
│  ─────────────────────────────────────────────────────   │
│                                                           │
│  🤖 IA Respondeu (95% confiança):                        │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Olá! O prazo de entrega para SP é de 3-5       │    │
│  │ dias úteis com frete grátis! 📦                 │    │
│  │                                                  │    │
│  │ Estamos com estoque disponível.                 │    │
│  │                                                  │    │
│  │ Qualquer dúvida, estou à disposição! 😊         │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  [✅ Aprovar]  [✏️ Editar]  [🔄 Revisar com IA]         │
└──────────────────────────────────────────────────────────┘
```

**Componente**: `components/agent/question-card.tsx`

### **5.3 - Opção A: Aprovar Direto**

Usuário clica **[✅ Aprovar]**:

```typescript
// API Call
POST /api/agent/approve-question
Body: {
  questionId: "cmg_internal_id",
  action: "approve",
  response: null // Usa resposta da IA
}
```

**Arquivo**: `app/api/agent/approve-question/route.ts`

**O que acontece**:

```typescript
// 1. Atualizar status no banco
UPDATE Question SET
  status = 'APPROVED',
  answer = 'Olá! O prazo de entrega...',
  answeredBy = 'AI_AUTO',
  approvalType = 'AUTO',
  approvedAt = NOW()
WHERE id = 'cmg_internal_id'

// 2. Enviar resposta ao Mercado Livre
POST https://api.mercadolibre.com/answers
Headers: { Authorization: "Bearer <token>" }
Body: {
  question_id: 13437214414,
  text: "Olá! O prazo de entrega para SP é de 3-5 dias úteis com frete grátis! 📦\n\nEstamos com estoque disponível.\n\nQualquer dúvida, estou à disposição! 😊"
}

Response 201 Created: {
  id: 98765432,
  question_id: 13437214414,
  text: "Olá! O prazo...",
  status: "ACTIVE",
  date_created: "2025-10-02T14:31:00.000Z"
}

// 3. Atualizar pergunta como RESPONDIDA
UPDATE Question SET
  status = 'RESPONDED',
  sentToMLAt = NOW(),
  mlResponseCode = 201,
  mlResponseData = { id: 98765432, ... }
WHERE id = 'cmg_internal_id'

// 4. Notificar usuário via WebSocket
io.to(organizationId).emit('question:answered', {
  questionId: '13437214414',
  status: 'RESPONDED'
})
```

**Cliente no Mercado Livre recebe resposta instantaneamente**:

```
┌────────────────────────────────────────┐
│  Cliente no App ML                     │
│                                        │
│  💬 Sua pergunta:                      │
│  "Qual o prazo de entrega para SP?"   │
│                                        │
│  ✅ Vendedor respondeu:                │
│  "Olá! O prazo de entrega para SP     │
│   é de 3-5 dias úteis com frete       │
│   grátis! 📦 ..."                      │
│                                        │
│  há 1 minuto                           │
└────────────────────────────────────────┘
```

### **5.4 - Opção B: Revisar com IA**

Usuário clica **[🔄 Revisar com IA]**:

```
┌──────────────────────────────────────────────────────────┐
│  🔄 Revisar Resposta                                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  💬 Feedback para IA:                                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Mencione que temos opção de retirada na loja   │    │
│  │ em 24h                                           │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  [Revisar]  [Cancelar]                                   │
└──────────────────────────────────────────────────────────┘
```

```typescript
POST /api/agent/revise-question
Body: {
  questionId: "cmg_internal_id",
  feedback: "Mencione que temos opção de retirada na loja em 24h"
}
```

**Arquivo**: `app/api/agent/revise-question/route.ts`

```typescript
// 1. Atualizar status
UPDATE Question SET status = 'REVISING'

// 2. Enviar para N8N/IA revisar
POST https://dashboard.axnexlabs.com.br/webhook/editar
Body: {
  question_text: "Qual o prazo de entrega para SP?",
  original_response: "Olá! O prazo de entrega...",
  revision_feedback: "Mencione que temos opção de retirada na loja em 24h",
  product: { ... }
}

// 3. IA retorna resposta revisada
Response: {
  output: "Olá! O prazo de entrega para SP é de 3-5 dias úteis com frete grátis! 📦\n\nTambém temos a opção de retirada na loja em até 24h após a compra!\n\nQualquer dúvida, estou à disposição! 😊"
}

// 4. Atualizar pergunta com resposta revisada
UPDATE Question SET
  aiSuggestion = <resposta_revisada>,
  status = 'AWAITING_APPROVAL'

// 5. Criar registro de revisão (histórico)
INSERT INTO Revision (questionId, userFeedback, aiRevision)
VALUES ('cmg_id', 'Mencione retirada...', <resposta_revisada>)
```

Usuário vê nova resposta revisada e pode aprovar normalmente.

### **5.5 - Opção C: Editar Manualmente**

Usuário clica **[✏️ Editar]**:

```
┌──────────────────────────────────────────────────────────┐
│  ✏️ Editar Resposta                                      │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Olá! O prazo de entrega para SP é de 3-5       │    │
│  │ dias úteis com frete grátis! 📦                 │    │
│  │                                                  │    │
│  │ Também temos retirada na loja!  ← editando     │    │
│  │                                                  │    │
│  │ Abraços!                                         │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  [Salvar e Aprovar]  [Cancelar]                         │
└──────────────────────────────────────────────────────────┘
```

```typescript
POST /api/agent/approve-question
Body: {
  questionId: "cmg_internal_id",
  action: "manual",
  response: "Olá! O prazo de entrega para SP é de 3-5 dias úteis com frete grátis! 📦\n\nTambém temos retirada na loja!\n\nAbraços!"
}
```

Sistema envia resposta editada ao ML normalmente.

---

## 🔄 FASE 6: SISTEMA FUNCIONA 24/7

### **6.1 - Token Refresh Automático**

**Arquivo**: `lib/ml-api/token-refresh-manager.ts`

```typescript
// Job automático executa a cada 6 horas
setInterval(async () => {
  const accounts = await prisma.mLAccount.findMany({
    where: { isActive: true }
  })

  for (const account of accounts) {
    // Verificar se token expira em menos de 5 minutos
    if (account.tokenExpiresAt < new Date(Date.now() + 5*60*1000)) {
      // Refresh automático
      POST https://api.mercadolibre.com/oauth/token
      Body: {
        grant_type: "refresh_token",
        client_id: "8077330788571096",
        client_secret: "jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha",
        refresh_token: <encrypted_refresh_token>
      }

      Response: {
        access_token: "NEW_TOKEN",
        refresh_token: "NEW_REFRESH",
        expires_in: 21600
      }

      // Atualizar no banco (criptografado)
      UPDATE MLAccount SET
        accessToken = <encrypted_new_token>,
        refreshToken = <encrypted_new_refresh>,
        tokenExpiresAt = NOW() + INTERVAL '6 hours'
    }
  }
}, 60 * 60 * 1000) // Check a cada 1 hora
```

**Resultado**: Contas ML ficam autenticadas **24/7 sem intervenção**

### **6.2 - Atualização de Avatars/Perfil**

**Arquivo**: `workers/avatar-updater.ts`

```typescript
// Cron job executa 1x por dia (3h da manhã)
cron.schedule('0 3 * * *', async () => {
  const accounts = await prisma.mLAccount.findMany({
    where: { isActive: true }
  })

  for (const account of accounts) {
    // Buscar dados atualizados do usuário
    GET https://api.mercadolibre.com/users/${account.mlUserId}

    // Atualizar thumbnail, nickname, email se mudaram
    UPDATE MLAccount SET
      thumbnail = <new_thumbnail>,
      nickname = <new_nickname>,
      email = <new_email>
  }
})
```

---

## 📊 FASE 7: ADICIONAR MAIS CONTAS ML

### **7.1 - Usuário Adiciona Segunda Conta**

No dashboard, usuário clica:

```
┌──────────────────────────────────────────────────────────┐
│  [GUGALEO COMÉRCIO ▼]                                    │
│  ├─ GUGALEO COMÉRCIO                                     │
│  ├─ + Adicionar Conta                  ← Clica aqui     │
│  └─ Sair                                                  │
└──────────────────────────────────────────────────────────┘
```

Sistema inicia OAuth novamente (mesmo fluxo da Fase 2.2):

```
1. Redireciona para Mercado Livre
2. Usuário loga com OUTRA conta ML
3. Autoriza
4. Sistema salva segunda conta:

INSERT INTO MLAccount (
  mlUserId: '999888777',
  nickname: 'LOJA ALTERNATIVA',
  organizationId: 'cmg86hc1t0000cswzi20ur7oz', -- MESMA ORG
  isPrimary: false -- ✅ Não é primária
)
```

**Resultado**: Usuário agora tem **2 contas ML** na mesma organização

Dashboard mostra:

```
┌──────────────────────────────────────────────────────────┐
│  [GUGALEO COMÉRCIO ▼]                                    │
│  ├─ ✅ GUGALEO COMÉRCIO (15 perguntas)                   │
│  ├─ ✅ LOJA ALTERNATIVA (3 perguntas)                    │
│  ├─ + Adicionar Conta                                     │
│  └─ Sair                                                  │
└──────────────────────────────────────────────────────────┘
```

**Importante**:
- ✅ Perguntas de TODAS as contas aparecem juntas
- ✅ Usuário pode alternar entre contas
- ✅ Sistema processa perguntas de TODAS simultaneamente

---

## 🎯 RESUMO DA EXPERIÊNCIA COMPLETA

```
1️⃣ CADASTRO (1x apenas)
   └─ Criar username + PIN (3 dígitos)

2️⃣ CONECTAR ML (1x por conta)
   └─ OAuth → Sistema guarda tokens criptografados

3️⃣ SISTEMA FICA 24/7 ATIVO
   ├─ Webhooks recebem perguntas INSTANTÂNEAS
   ├─ IA processa automaticamente (5-15s)
   ├─ Notifica usuário (Push + WebSocket + WhatsApp)
   └─ Tokens renovados automaticamente (6h)

4️⃣ USUÁRIO APROVA (quando quiser)
   ├─ Aprovar direto (1 clique)
   ├─ Revisar com IA (dar feedback)
   └─ Editar manualmente

5️⃣ CLIENTE RECEBE RESPOSTA
   └─ No Mercado Livre instantaneamente

6️⃣ ADICIONAR MAIS CONTAS (opcional)
   └─ Até 10 contas na mesma organização
```

---

## 🔒 SEGURANÇA

**Tokens**: AES-256-GCM encryption
**Sessões**: HttpOnly + Secure cookies (7 dias)
**Webhooks**: IP whitelist + HMAC SHA-256
**PIN**: Bcrypt hash (10 rounds)
**API**: Rate limiting + Circuit breaker

---

## ⚡ PERFORMANCE

**Tempo de resposta**:
- Webhook → Banco: < 500ms
- IA processar: 5-15 segundos
- Aprovar → ML receber: < 1 segundo

**Escalabilidade**:
- Suporta até 10 contas ML/organização
- 500 req/hora por conta (limite ML)
- Cache inteligente economiza 90% das chamadas

---

## 📱 PWA FEATURES

✅ Instalável (funciona como app nativo)
✅ Offline-first (cache service worker)
✅ Push notifications (funciona app fechado)
✅ Deep linking (abrir pergunta específica)
✅ Badge count (mostra perguntas pendentes)
✅ Share target (compartilhar para app)

---

**Fim da Documentação** 🎉
