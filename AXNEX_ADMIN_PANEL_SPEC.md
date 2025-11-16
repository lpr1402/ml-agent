# PAINEL ADMINISTRATIVO AXNEX - ESPECIFICAÇÃO TÉCNICA
**Outubro 2025 - Enterprise-Grade Super Admin Dashboard**

## 🎯 OBJETIVO

Criar painel administrativo para o usuário **AXNEX** (dono da plataforma) com visibilidade total de todas organizações e contas ML, garantindo zero perda de perguntas e facilitando debug/manutenção.

---

## 🔐 AUTENTICAÇÃO

### Credenciais Super Admin
- **Username**: `AXNEX`
- **PIN**: `911`
- **Nível de Acesso**: SUPER_ADMIN (novo role)

### Implementação
```typescript
// Adicionar campo ao schema.prisma
model Organization {
  // ... campos existentes
  role  OrganizationRole @default(CLIENT) // Novo campo
}

enum OrganizationRole {
  CLIENT       // Usuário normal
  SUPER_ADMIN  // Acesso total (AXNEX)
}
```

### Rota de Login
- Usar sistema existente: `/api/auth/login-pin`
- Validação: Se `role = SUPER_ADMIN`, redirecionar para `/admin/dashboard`
- Sessão de 24h (vs 7 dias para clientes)

---

## 📊 DASHBOARD PRINCIPAL

### URL
`/admin/dashboard`

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ 🏢 AXNEX SUPER ADMIN                    [Logout] [Refresh] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 MÉTRICAS GLOBAIS (Cards)                                │
│  ┌────────────┬────────────┬────────────┬────────────┐     │
│  │ 🏢 Orgs    │ 🔗 Contas  │ ❓ Perguntas│ ⚠️ Alerts │     │
│  │    12      │     45     │   1,234/dia │     3     │     │
│  │ ━━━━━━━━━━ │ ━━━━━━━━━━ │ ━━━━━━━━━━ │ ━━━━━━━━━━ │     │
│  │ +2 hoje    │ 42 ativas  │ 98% taxa   │ 1 crítico │     │
│  └────────────┴────────────┴────────────┴────────────┘     │
│                                                              │
│  🚨 ALERTAS CRÍTICOS                                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │ ⚠️  Org "GuGaLeo" - Token expirando em 2h          │    │
│  │ ❌  Org "VendaFacil" - 3 perguntas FAILED (retry)  │    │
│  │ 🔴  Conta MLB12345 - Desconectada há 4 horas       │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  🏢 ORGANIZAÇÕES (Tabela Responsiva)                       │
│  ┌──────────┬────────┬──────────┬────────┬───────────┐    │
│  │ Nome     │ Status │ Contas   │ P/dia  │ Ações     │    │
│  ├──────────┼────────┼──────────┼────────┼───────────┤    │
│  │ GuGaLeo  │ 🟢 OK  │ 4/10     │ 234    │ [Ver] [❌]│    │
│  │ VendaTop │ 🟡 Warn│ 1/10     │ 45     │ [Ver] [❌]│    │
│  │ MegaLoja │ 🔴 Down│ 0/10     │ 0      │ [Ver] [❌]│    │
│  └──────────┴────────┴──────────┴────────┴───────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 VISÃO DETALHADA DA ORGANIZAÇÃO

### URL
`/admin/organization/[orgId]`

### Seções

#### 1. Header da Organização
```typescript
interface OrgHeader {
  id: string
  username: string
  organizationName: string
  plan: "FREE" | "PRO"
  subscriptionStatus: "TRIAL" | "ACTIVE" | "EXPIRED"
  createdAt: Date
  lastActivityAt: Date

  // Métricas agregadas
  totalMLAccounts: number
  activeMLAccounts: number
  totalQuestions: number
  questionsToday: number
  avgResponseTime: number

  // Health status
  overallHealth: "healthy" | "warning" | "critical"
  healthIssues: string[]
}
```

#### 2. Contas ML (Cards Expansíveis)
```typescript
interface MLAccountCard {
  id: string
  mlUserId: string
  nickname: string
  siteId: string
  thumbnail: string
  isPrimary: boolean

  // Status de conexão
  isActive: boolean
  connectionStatus: "connected" | "token_expired" | "disconnected"
  lastSyncAt: Date
  connectionError?: string

  // Tokens
  tokenExpiresAt: Date
  tokenExpiresIn: string // "2 horas", "EXPIRADO"

  // Rate Limiting
  rateLimitCount: number
  rateLimitReset: Date
  lastRequestAt: Date

  // Métricas
  questionsToday: number
  questionsPending: number
  questionsFailed: number
  avgResponseTime: number

  // Ações rápidas
  actions: {
    refreshToken: () => void
    reconnect: () => void
    testWebhook: () => void
    viewQuestions: () => void
    viewAuditLog: () => void
  }
}
```

#### 3. Pipeline de Perguntas (Flow Chart)
```
Webhooks → [23] → Processing → [12] → Awaiting → [5] → Sent
            ↓                     ↓                ↓
         Failed [3]           Revising [2]    Completed
```

#### 4. Perguntas Recentes (Tabela com Filtros)
```typescript
interface AdminQuestionView {
  mlQuestionId: string
  sequentialId: string

  // Timing crítico
  dateCreated: Date
  receivedAt: Date
  sentToAIAt: Date | null
  aiProcessedAt: Date | null
  answeredAt: Date | null

  // Delays (em segundos)
  webhookDelay: number // receivedAt - dateCreated
  processingDelay: number // aiProcessedAt - sentToAIAt
  totalDelay: number // answeredAt - dateCreated

  // Status atual
  status: QuestionStatus

  // Dados da pergunta
  itemTitle: string
  text: string
  aiSuggestion: string | null
  answer: string | null

  // Erros/problemas
  failureReason?: string
  retryCount: number

  // Conta ML
  mlAccount: {
    nickname: string
    mlUserId: string
  }

  // Ações de debug
  actions: {
    viewFull: () => void
    reprocess: () => void
    viewWebhook: () => void
    viewAuditLog: () => void
    testMLAPI: () => void
  }
}
```

---

## 🚨 SISTEMA DE ALERTAS

### Tipos de Alertas

#### 1. Alertas Críticos (Requerem Ação Imediata)
```typescript
interface CriticalAlert {
  type: 'CRITICAL'
  category:
    | 'token_expired'        // Token expirou, conta desconectada
    | 'question_stuck'       // Pergunta em PROCESSING há mais de 5 minutos
    | 'webhook_failed'       // Webhook falhando consistentemente
    | 'rate_limit_exceeded'  // Rate limit atingido
    | 'org_disconnected'     // Todas contas de uma org desconectadas

  organizationId: string
  organizationName: string
  mlAccountId?: string
  accountNickname?: string

  message: string
  detectedAt: Date
  affectedQuestions?: number

  suggestedAction: string
  actionUrl: string
}
```

#### 2. Avisos (Preventivos)
```typescript
interface WarningAlert {
  type: 'WARNING'
  category:
    | 'token_expiring_soon'  // Token expira em menos de 24h
    | 'high_error_rate'      // >5% de perguntas falhando
    | 'slow_processing'      // Tempo médio >3 minutos
    | 'low_activity'         // Sem perguntas há 24h (org com histórico)

  // ... mesmos campos de CriticalAlert
}
```

#### 3. Informações (FYI)
```typescript
interface InfoAlert {
  type: 'INFO'
  category:
    | 'new_organization'     // Nova org criada
    | 'account_added'        // Nova conta ML adicionada
    | 'high_volume'          // Volume incomum de perguntas
    | 'milestone_reached'    // 1000 perguntas processadas, etc.
}
```

### Detecção de Alertas (Workers)

#### Worker: `alert-detector-worker.ts`
```typescript
// Rodar a cada 1 minuto
export async function detectAlerts() {
  const alerts: Alert[] = []

  // 1. Tokens expirando
  const expiringTokens = await prisma.mLAccount.findMany({
    where: {
      isActive: true,
      tokenExpiresAt: {
        lt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        gt: new Date() // Ainda não expirou
      }
    },
    include: { organization: true }
  })

  for (const account of expiringTokens) {
    const hoursUntilExpiry = (account.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60)

    alerts.push({
      type: hoursUntilExpiry < 2 ? 'CRITICAL' : 'WARNING',
      category: 'token_expiring_soon',
      organizationId: account.organizationId,
      organizationName: account.organization.organizationName,
      mlAccountId: account.id,
      accountNickname: account.nickname,
      message: `Token expira em ${hoursUntilExpiry.toFixed(1)} horas`,
      suggestedAction: 'Notificar cliente para reconectar conta',
      actionUrl: `/admin/organization/${account.organizationId}`
    })
  }

  // 2. Perguntas travadas
  const stuckQuestions = await prisma.question.findMany({
    where: {
      status: 'PROCESSING',
      sentToAIAt: {
        lt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutos
      }
    },
    include: {
      mlAccount: {
        include: { organization: true }
      }
    }
  })

  // Agrupar por organização
  const stuckByOrg = groupBy(stuckQuestions, q => q.mlAccount.organizationId)

  for (const [orgId, questions] of Object.entries(stuckByOrg)) {
    const org = questions[0].mlAccount.organization

    alerts.push({
      type: 'CRITICAL',
      category: 'question_stuck',
      organizationId: orgId,
      organizationName: org.organizationName,
      message: `${questions.length} perguntas travadas em PROCESSING há mais de 5 minutos`,
      affectedQuestions: questions.length,
      suggestedAction: 'Verificar N8N e reprocessar perguntas',
      actionUrl: `/admin/organization/${orgId}?filter=stuck`
    })
  }

  // 3. Taxa de erro alta
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const errorStats = await prisma.question.groupBy({
    by: ['mlAccountId', 'status'],
    where: {
      receivedAt: { gte: last24h }
    },
    _count: true
  })

  // Calcular taxa de erro por conta
  // ... (implementação similar)

  // 4. Organizações desconectadas
  const orgsWithNoActiveAccounts = await prisma.organization.findMany({
    where: {
      subscriptionStatus: 'ACTIVE',
      mlAccounts: {
        none: { isActive: true }
      }
    }
  })

  for (const org of orgsWithNoActiveAccounts) {
    alerts.push({
      type: 'CRITICAL',
      category: 'org_disconnected',
      organizationId: org.id,
      organizationName: org.organizationName,
      message: 'Organização sem contas ativas conectadas',
      suggestedAction: 'Verificar tokens e notificar cliente',
      actionUrl: `/admin/organization/${org.id}`
    })
  }

  // Salvar alertas no banco
  return alerts
}
```

---

## 📈 MÉTRICAS E MONITORAMENTO

### Dashboard de Métricas (Tab Separada)

#### 1. Visão Geral do Sistema
```typescript
interface SystemMetrics {
  // Performance
  avgQuestionProcessingTime: number // segundos
  p95ProcessingTime: number
  p99ProcessingTime: number

  // Throughput
  questionsPerHour: number
  questionsPerDay: number
  peakHourLoad: number

  // Taxa de sucesso
  successRate: number // %
  errorRate: number // %
  retryRate: number // %

  // Webhooks
  webhooksReceived: number
  webhooksProcessed: number
  webhooksDuplicated: number
  webhooksFailed: number

  // ML API
  mlAPICallsTotal: number
  mlAPICallsSuccess: number
  mlAPIRateLimits: number // quantas vezes bateu em 429
  mlAPIErrors: number

  // Workers
  workersOnline: number
  workersTotal: number
  workerHealth: Record<string, 'healthy' | 'degraded' | 'down'>
}
```

#### 2. Métricas por Organização (Ranking)
```
Top 10 Organizações por Volume:
1. GuGaLeo        - 1,234 perguntas/dia
2. MegaStore      - 856 perguntas/dia
3. VendaTop       - 523 perguntas/dia
...

Top Organizações com Erros:
1. ProblemaOrg    - 12% taxa de erro (45 perguntas)
2. SlowOrg        - 8% taxa de erro (23 perguntas)
...

Organizações Inativas (>7 dias):
- InactiveOrg1    - Última pergunta há 15 dias
- InactiveOrg2    - Última pergunta há 23 dias
```

#### 3. Health Checks em Tempo Real
```typescript
interface SystemHealth {
  timestamp: Date

  services: {
    nextjs: { status: 'up' | 'down', uptime: number }
    websocket: { status: 'up' | 'down', connections: number }
    queue: { status: 'up' | 'down', size: number }
    workers: {
      orchestrator: { status: 'up' | 'down', lastRun: Date }
      tokenMaintenance: { status: 'up' | 'down', lastRun: Date }
      stockAnalysis: { status: 'up' | 'down', lastRun: Date }
      stockMaintenance: { status: 'up' | 'down', lastRun: Date }
    }
  }

  database: {
    status: 'up' | 'down'
    connectionPoolSize: number
    activeConnections: number
    slowQueries: number
  }

  redis: {
    status: 'up' | 'down'
    cacheHitRate: number
    memoryUsage: string
  }

  externalAPIs: {
    mercadoLibre: { status: 'up' | 'degraded' | 'down', latency: number }
    n8n: { status: 'up' | 'down', latency: number }
    zapster: { status: 'up' | 'down', latency: number }
  }
}
```

---

## 🛠️ FERRAMENTAS DE DEBUG

### 1. Log Viewer (Real-time)
- **URL**: `/admin/logs`
- Filtros: nível (info, warn, error), serviço, organização, data
- Busca por questionId, mlUserId, etc.
- Tail em tempo real dos logs

### 2. Webhook Inspector
- **URL**: `/admin/webhooks`
- Lista todos webhooks recebidos (últimos 1000)
- Filtros: status, organizationId, topic, data
- Ver payload completo
- Reprocessar webhook manualmente

### 3. Question Inspector
- **URL**: `/admin/question/[questionId]`
- Timeline completa da pergunta:
  ```
  ✅ 10:23:45 - Webhook recebido do ML
  ✅ 10:23:46 - Salva no banco (status: RECEIVED)
  ✅ 10:23:48 - Dados completos buscados da API ML
  ✅ 10:23:49 - Enviada para N8N (status: PROCESSING)
  ⏳ 10:24:32 - Resposta IA recebida (status: AWAITING_APPROVAL)
  ✅ 10:25:10 - Aprovada pelo usuário
  ✅ 10:25:11 - Enviada ao ML (status: SENT_TO_ML)
  ```
- Payload completo do webhook
- Resposta da IA
- Logs relacionados
- Ações: Reprocessar, Forçar retry, Marcar como resolvido

### 4. Token Manager
- **URL**: `/admin/tokens`
- Visualizar todos tokens (mascarados)
- Status de expiração
- Forçar refresh manual
- Testar token (chamar /users/me)

### 5. Rate Limiter Status
- **URL**: `/admin/rate-limiter`
- Visualizar fila global
- Requests por conta/hora
- Histórico de rate limits (429s)
- Ajustar configurações (admin only)

---

## 🔧 AÇÕES ADMINISTRATIVAS

### 1. Ações de Organização
```typescript
interface OrgActions {
  // Gestão
  suspendOrg: (orgId: string, reason: string) => void
  unsuspendOrg: (orgId: string) => void
  deleteOrg: (orgId: string) => void // Requer confirmação

  // Planos
  upgradePlan: (orgId: string, plan: 'PRO') => void
  downgradePlan: (orgId: string, plan: 'FREE') => void
  extendTrial: (orgId: string, days: number) => void

  // Contas ML
  forceDisconnectAccount: (accountId: string) => void
  testAccount: (accountId: string) => void

  // Perguntas
  reprocessAllFailed: (orgId: string) => void
  clearQueue: (orgId: string) => void
}
```

### 2. Ações de Sistema
```typescript
interface SystemActions {
  // Workers
  restartWorker: (worker: WorkerName) => void
  stopWorker: (worker: WorkerName) => void
  startWorker: (worker: WorkerName) => void

  // Cache
  clearCache: (pattern?: string) => void
  warmupCache: () => void

  // Database
  runMaintenance: () => void
  cleanupOldData: (olderThan: Date) => void

  // Logs
  rotateLogs: () => void
  downloadLogs: (dateRange: [Date, Date]) => void

  // Webhooks
  reprocessFailedWebhooks: (hours: number) => void
  testWebhookEndpoint: () => void
}
```

---

## 📱 NOTIFICAÇÕES PARA ADMIN

### Canais de Notificação
1. **In-app** (badge + toast)
2. **Email** (apenas críticos)
3. **WhatsApp** (apenas críticos - opcional)

### Regras de Notificação
```typescript
interface NotificationRule {
  alertType: 'CRITICAL' | 'WARNING' | 'INFO'

  conditions: {
    category: AlertCategory[]
    minAffectedOrgs?: number
    minAffectedQuestions?: number
  }

  channels: ('inapp' | 'email' | 'whatsapp')[]

  cooldown: number // minutos entre notificações similares

  autoResolve: {
    enabled: boolean
    timeoutMinutes: number
  }
}
```

**Exemplo**:
- Se `token_expired` em qualquer org → Email imediato
- Se `question_stuck` com >10 perguntas → WhatsApp
- Se `high_error_rate` → In-app apenas

---

## 🎨 UI/UX GUIDELINES

### Design System
- **Framework**: Shadcn/ui (já usado no projeto)
- **Cores**:
  - Verde: 🟢 OK, saudável
  - Amarelo: 🟡 Warning, atenção necessária
  - Vermelho: 🔴 Critical, ação imediata
  - Azul: 🔵 Info, neutro

### Componentes Reutilizáveis
```typescript
// components/admin/org-health-badge.tsx
<OrgHealthBadge status="healthy" | "warning" | "critical" />

// components/admin/metric-card.tsx
<MetricCard
  title="Perguntas/dia"
  value={1234}
  change="+12%"
  trend="up"
  severity="success"
/>

// components/admin/alert-list.tsx
<AlertList
  alerts={alerts}
  onResolve={handleResolve}
  onDismiss={handleDismiss}
/>

// components/admin/question-timeline.tsx
<QuestionTimeline questionId="123" />

// components/admin/ml-account-card.tsx
<MLAccountCard
  account={account}
  onRefreshToken={() => {}}
  onTest={() => {}}
/>
```

### Responsividade
- Desktop first (administradores usam desktop)
- Tablet: layout adaptado
- Mobile: versão simplificada (apenas alertas + métricas principais)

---

## 🗄️ ESTRUTURA DE ARQUIVOS

```
/root/ml-agent/
├── app/
│   ├── admin/
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Dashboard principal
│   │   ├── organization/
│   │   │   └── [orgId]/
│   │   │       └── page.tsx          # Detalhe da org
│   │   ├── logs/
│   │   │   └── page.tsx              # Log viewer
│   │   ├── webhooks/
│   │   │   └── page.tsx              # Webhook inspector
│   │   ├── question/
│   │   │   └── [questionId]/
│   │   │       └── page.tsx          # Question inspector
│   │   ├── tokens/
│   │   │   └── page.tsx              # Token manager
│   │   ├── rate-limiter/
│   │   │   └── page.tsx              # Rate limiter status
│   │   └── layout.tsx                # Layout admin (com sidebar)
│   │
│   └── api/
│       └── admin/
│           ├── organizations/
│           │   ├── route.ts          # GET /api/admin/organizations
│           │   └── [orgId]/
│           │       ├── route.ts      # GET/PATCH/DELETE /api/admin/organizations/:id
│           │       ├── accounts/route.ts
│           │       ├── questions/route.ts
│           │       └── metrics/route.ts
│           ├── alerts/
│           │   ├── route.ts          # GET /api/admin/alerts
│           │   └── [alertId]/
│           │       └── resolve/route.ts
│           ├── metrics/
│           │   ├── system/route.ts
│           │   └── organizations/route.ts
│           ├── health/
│           │   └── route.ts
│           ├── logs/
│           │   └── route.ts
│           ├── webhooks/
│           │   ├── route.ts
│           │   └── [webhookId]/
│           │       └── reprocess/route.ts
│           └── actions/
│               ├── restart-worker/route.ts
│               ├── clear-cache/route.ts
│               └── reprocess-failed/route.ts
│
├── components/
│   └── admin/
│       ├── org-health-badge.tsx
│       ├── metric-card.tsx
│       ├── alert-list.tsx
│       ├── alert-card.tsx
│       ├── question-timeline.tsx
│       ├── ml-account-card.tsx
│       ├── log-viewer.tsx
│       ├── webhook-table.tsx
│       ├── health-status.tsx
│       └── admin-sidebar.tsx
│
├── lib/
│   └── admin/
│       ├── alert-detector.ts        # Lógica de detecção de alertas
│       ├── metrics-aggregator.ts    # Agregação de métricas
│       ├── health-checker.ts        # Health checks
│       └── admin-auth.ts            # Validação de acesso admin
│
├── workers/
│   └── alert-detector-worker.ts     # Worker de alertas (rodar a cada 1min)
│
└── prisma/
    └── schema.prisma                 # Adicionar models: Alert, SystemMetric
```

---

## 📊 NOVOS MODELS (Prisma)

```prisma
// ========== ALERTAS ==========

model Alert {
  id              String   @id @default(cuid())

  // Tipo e categoria
  type            AlertType
  category        AlertCategory

  // Contexto
  organizationId  String?
  organization    Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  mlAccountId     String?
  mlAccount       MLAccount? @relation(fields: [mlAccountId], references: [id], onDelete: Cascade)

  // Detalhes
  message         String   @db.Text
  affectedQuestions Int?
  suggestedAction String   @db.Text
  actionUrl       String?

  // Status
  status          AlertStatus @default(ACTIVE)
  detectedAt      Date     @default(now())
  resolvedAt      Date?
  resolvedBy      String?  // "AUTO" ou admin userId
  dismissedAt     Date?
  dismissedBy     String?

  // Metadata
  metadata        Json?    // Dados extras

  createdAt       Date     @default(now())
  updatedAt       Date     @updatedAt

  @@index([status, type])
  @@index([organizationId, status])
  @@index([detectedAt])
}

enum AlertType {
  CRITICAL
  WARNING
  INFO
}

enum AlertCategory {
  // Críticos
  TOKEN_EXPIRED
  QUESTION_STUCK
  WEBHOOK_FAILED
  RATE_LIMIT_EXCEEDED
  ORG_DISCONNECTED

  // Warnings
  TOKEN_EXPIRING_SOON
  HIGH_ERROR_RATE
  SLOW_PROCESSING
  LOW_ACTIVITY

  // Info
  NEW_ORGANIZATION
  ACCOUNT_ADDED
  HIGH_VOLUME
  MILESTONE_REACHED
}

enum AlertStatus {
  ACTIVE
  RESOLVED
  DISMISSED
}

// ========== MÉTRICAS DO SISTEMA ==========

model SystemMetric {
  id          String   @id @default(cuid())

  // Timestamp
  timestamp   Date     @default(now())

  // Tipo de métrica
  category    String   // "performance", "throughput", "success_rate", "api", "workers"
  metricName  String   // "avg_processing_time", "questions_per_hour", etc
  value       Float

  // Dimensões (opcional)
  organizationId String?
  mlAccountId    String?
  workerId       String?

  // Metadata
  metadata    Json?

  @@index([timestamp, category])
  @@index([category, metricName])
}

// ========== ATUALIZAR ORGANIZATION ==========

model Organization {
  // ... campos existentes

  // Novo campo
  role  OrganizationRole @default(CLIENT)

  // Nova relação
  alerts  Alert[]
}

enum OrganizationRole {
  CLIENT
  SUPER_ADMIN
}

// ========== ATUALIZAR MLACCOUNT ==========

model MLAccount {
  // ... campos existentes

  // Nova relação
  alerts  Alert[]
}
```

---

## 🚀 ROADMAP DE IMPLEMENTAÇÃO

### Fase 1: Setup Básico (2-3 horas)
- [ ] Adicionar campo `role` ao schema e criar org AXNEX
- [ ] Criar middleware de autenticação admin
- [ ] Criar layout base `/admin`
- [ ] Dashboard principal com métricas básicas

### Fase 2: Monitoramento de Orgs (3-4 horas)
- [ ] Lista de organizações com status
- [ ] Página de detalhe da organização
- [ ] Cards de contas ML com status
- [ ] Visualização de perguntas por org

### Fase 3: Sistema de Alertas (4-5 horas)
- [ ] Adicionar models de Alert ao schema
- [ ] Criar `alert-detector-worker.ts`
- [ ] Implementar detecção de alertas críticos
- [ ] UI de alertas no dashboard
- [ ] Sistema de notificações

### Fase 4: Ferramentas de Debug (3-4 horas)
- [ ] Log viewer com filtros
- [ ] Webhook inspector
- [ ] Question inspector com timeline
- [ ] Token manager

### Fase 5: Métricas Avançadas (2-3 horas)
- [ ] Agregação de métricas no banco
- [ ] Dashboard de métricas do sistema
- [ ] Health checks em tempo real
- [ ] Gráficos e visualizações

### Fase 6: Ações Administrativas (2-3 horas)
- [ ] Ações de organização (suspender, etc)
- [ ] Ações de sistema (restart workers, etc)
- [ ] Reprocessamento em massa
- [ ] Controles de cache

### Fase 7: Polimento e Testes (2-3 horas)
- [ ] Responsividade
- [ ] Loading states
- [ ] Error handling
- [ ] Testes end-to-end

**TOTAL ESTIMADO: 18-25 horas de desenvolvimento**

---

## 🎯 GARANTIA ZERO PERDA DE PERGUNTAS

### Mecanismos Existentes (Já Implementados ✅)
1. **UPSERT Atômico**: Previne duplicatas e race conditions
2. **Try-Catch em 3 Níveis**: Garantia de salvamento mesmo com erros
3. **Status RECEIVED**: Pergunta salva IMEDIATAMENTE
4. **Status FAILED**: Perguntas com erro ficam visíveis
5. **Retry Count**: Controle de tentativas
6. **Audit Log**: Log de todas ações

### Novas Camadas de Segurança (Admin Panel)
1. **Alert: question_stuck**: Detecta perguntas travadas >5min
2. **Alert: webhook_failed**: Detecta webhooks falhando consistentemente
3. **Question Inspector**: Visualizar qualquer pergunta e sua timeline
4. **Webhook Inspector**: Reprocessar webhook manualmente
5. **Reprocess Button**: Usuário pode reprocessar pergunta FAILED
6. **Admin Reprocess All**: Admin pode reprocessar em massa

### Dead Letter Queue (Nova Feature)
```typescript
// workers/dead-letter-processor.ts
// Rodar a cada 15 minutos

async function processDeadLetterQueue() {
  // 1. Buscar perguntas FAILED há mais de 30 minutos
  const deadLetters = await prisma.question.findMany({
    where: {
      status: 'FAILED',
      failedAt: {
        lt: new Date(Date.now() - 30 * 60 * 1000)
      },
      retryCount: { lt: 3 }
    }
  })

  // 2. Tentar reprocessar
  for (const question of deadLetters) {
    try {
      await reprocessQuestion(question.mlQuestionId)

      // Log sucesso
      logger.info('[DeadLetter] Successfully reprocessed', {
        questionId: question.mlQuestionId
      })

    } catch (error) {
      // Se falhar novamente, incrementar retry count
      await prisma.question.update({
        where: { id: question.id },
        data: { retryCount: { increment: 1 } }
      })

      // Se atingir 3 retries, criar alerta crítico
      if (question.retryCount >= 2) {
        await createAlert({
          type: 'CRITICAL',
          category: 'QUESTION_STUCK',
          organizationId: question.mlAccount.organizationId,
          message: `Pergunta ${question.mlQuestionId} falhou após 3 tentativas automáticas`,
          suggestedAction: 'Reprocessar manualmente ou investigar causa raiz',
          actionUrl: `/admin/question/${question.mlQuestionId}`
        })
      }
    }
  }
}
```

---

## 🔒 SEGURANÇA

### Controle de Acesso
- Apenas `role = SUPER_ADMIN` pode acessar `/admin/*`
- Middleware valida em todas rotas admin
- Logs de todas ações administrativas no AuditLog
- Confirmação obrigatória para ações destrutivas

### Rate Limiting (Admin)
- Admin não tem rate limit nas chamadas internas
- Mas respeita rate limit do ML API (para não prejudicar clientes)

### Auditoria
```typescript
// Toda ação admin é logada
await prisma.auditLog.create({
  data: {
    action: 'admin.restart_worker',
    entityType: 'system',
    entityId: 'token-maintenance-worker',
    organizationId: 'AXNEX_ORG_ID',
    metadata: {
      adminUser: 'AXNEX',
      timestamp: new Date(),
      reason: 'Manual restart from admin panel'
    }
  }
})
```

---

## 📝 NOTAS FINAIS

### Melhores Práticas Outubro 2025
- ✅ **Real-time Updates**: WebSocket para alertas e métricas
- ✅ **Progressive Enhancement**: Funciona sem JS (SSR)
- ✅ **Accessibility**: ARIA labels, keyboard navigation
- ✅ **Performance**: React Server Components onde possível
- ✅ **Type Safety**: TypeScript strict mode
- ✅ **Error Boundaries**: Graceful error handling
- ✅ **Loading States**: Skeleton loaders, Suspense

### Tecnologias Utilizadas
- **Next.js 15.5**: App Router, RSC
- **Shadcn/ui**: Componentes consistentes com o app
- **Prisma**: ORM type-safe
- **TailwindCSS**: Styling
- **Recharts**: Gráficos e visualizações
- **Socket.io**: Real-time (já implementado)

### Considerações de Performance
- Paginação em todas listas (100 items/página)
- Índices otimizados no Prisma
- Cache de métricas agregadas (Redis, 1min TTL)
- Debounce em filtros de busca (300ms)
- Lazy loading de componentes pesados

---

**FIM DA ESPECIFICAÇÃO**

*Este documento serve como blueprint completo para implementação do Painel Administrativo AXNEX. Todas as funcionalidades foram desenhadas para garantir zero perda de perguntas e máxima facilidade de debug e manutenção.*
