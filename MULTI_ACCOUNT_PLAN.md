# 🎯 Plano de Implementação - Suporte Multi-Contas ML

## 📋 Resumo Executivo
Implementar suporte completo para até 10 contas do Mercado Livre por organização, com visualização unificada de métricas, perguntas e operações em um único dashboard.

## 🏗️ Arquitetura Atual vs Proposta

### Estado Atual
- ✅ Suporta múltiplas contas ML por organização
- ✅ Permite alternar entre contas (MLAccountSwitcher)
- ❌ Mostra dados de apenas uma conta por vez
- ❌ APIs retornam dados de conta única
- ❌ Métricas não agregadas

### Estado Proposto
- ✅ Dashboard unificado com dados de todas as contas
- ✅ Métricas agregadas em tempo real
- ✅ Lista de perguntas multi-conta com filtros
- ✅ Indicadores visuais por conta
- ✅ Performance otimizada para 10 contas simultâneas

## 🔧 Alterações Necessárias

### 1. APIs - Endpoints Multi-Conta

#### `/api/agent/metrics-multi`
```typescript
// Nova API para métricas agregadas
export async function GET() {
  const auth = await getAuthenticatedAccount()
  
  // Buscar TODAS as contas ativas da organização
  const accounts = await prisma.mLAccount.findMany({
    where: {
      organizationId: auth.organizationId,
      isActive: true
    }
  })
  
  // Agregar métricas de todas as contas em paralelo
  const metricsPromises = accounts.map(account => 
    getAccountMetrics(account.mlUserId)
  )
  
  const allMetrics = await Promise.all(metricsPromises)
  
  return {
    aggregated: {
      totalQuestions: sum(allMetrics, 'totalQuestions'),
      answeredQuestions: sum(allMetrics, 'answeredQuestions'),
      pendingQuestions: sum(allMetrics, 'pendingQuestions'),
      avgResponseTime: avg(allMetrics, 'avgResponseTime')
    },
    byAccount: allMetrics.map((metrics, i) => ({
      accountId: accounts[i].id,
      nickname: accounts[i].nickname,
      thumbnail: accounts[i].thumbnail,
      ...metrics
    }))
  }
}
```

#### `/api/agent/questions-multi`
```typescript
// Nova API para perguntas de todas as contas
export async function GET(request: Request) {
  const url = new URL(request.url)
  const filterAccountId = url.searchParams.get('accountId')
  const status = url.searchParams.get('status')
  
  const auth = await getAuthenticatedAccount()
  
  // Buscar perguntas de todas as contas ou conta específica
  const where = {
    mlAccount: {
      organizationId: auth.organizationId,
      isActive: true,
      ...(filterAccountId && { id: filterAccountId })
    },
    ...(status && { status })
  }
  
  const questions = await prisma.question.findMany({
    where,
    include: {
      mlAccount: {
        select: {
          id: true,
          nickname: true,
          thumbnail: true,
          siteId: true
        }
      }
    },
    orderBy: { receivedAt: 'desc' },
    take: 200 // Limit for performance
  })
  
  return questions.map(q => ({
    ...q,
    account: {
      id: q.mlAccount.id,
      nickname: q.mlAccount.nickname,
      thumbnail: q.mlAccount.thumbnail
    }
  }))
}
```

### 2. Frontend - Componentes Multi-Conta

#### `components/agent/multi-account-metrics.tsx`
```typescript
interface MultiAccountMetrics {
  aggregated: {
    totalQuestions: number
    answeredQuestions: number
    pendingQuestions: number
    avgResponseTime: number
  }
  byAccount: AccountMetrics[]
}

export function MultiAccountMetricsCard() {
  const [metrics, setMetrics] = useState<MultiAccountMetrics>()
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  
  return (
    <div className="metrics-container">
      {/* Métricas Agregadas */}
      <div className="aggregated-metrics">
        <MetricCard 
          title="Total de Perguntas"
          value={metrics?.aggregated.totalQuestions}
          icon={<MessageSquare />}
        />
        {/* ... outras métricas agregadas ... */}
      </div>
      
      {/* Mini Cards por Conta */}
      <div className="account-metrics-grid">
        {metrics?.byAccount.map(account => (
          <AccountMiniCard
            key={account.accountId}
            account={account}
            isSelected={selectedAccountId === account.accountId}
            onClick={() => setSelectedAccountId(account.accountId)}
          />
        ))}
      </div>
    </div>
  )
}
```

#### `components/agent/multi-account-questions.tsx`
```typescript
export function MultiAccountQuestions() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [filterAccountId, setFilterAccountId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  
  // Fetch com filtros
  useEffect(() => {
    const params = new URLSearchParams()
    if (filterAccountId) params.set('accountId', filterAccountId)
    if (filterStatus) params.set('status', filterStatus)
    
    apiClient.get(`/api/agent/questions-multi?${params}`)
      .then(setQuestions)
  }, [filterAccountId, filterStatus])
  
  return (
    <div className="questions-container">
      {/* Filtros */}
      <div className="filters-bar">
        <AccountFilterDropdown 
          onChange={setFilterAccountId}
          placeholder="Todas as contas"
        />
        <StatusFilter 
          onChange={setFilterStatus}
        />
      </div>
      
      {/* Lista de Perguntas com Indicador de Conta */}
      <div className="questions-list">
        {questions.map(q => (
          <QuestionCard key={q.id}>
            <AccountBadge 
              account={q.account}
              className="question-account-badge"
            />
            <QuestionContent question={q} />
          </QuestionCard>
        ))}
      </div>
    </div>
  )
}
```

### 3. Database - Otimizações

#### Índices para Performance
```sql
-- Índices compostos para queries multi-conta
CREATE INDEX idx_question_org_status 
ON "Question" ("mlAccountId", "status", "receivedAt" DESC);

CREATE INDEX idx_mlaccount_org_active 
ON "MLAccount" ("organizationId", "isActive");

-- Materialized View para métricas agregadas (opcional)
CREATE MATERIALIZED VIEW org_metrics_summary AS
SELECT 
  o.id as organization_id,
  COUNT(DISTINCT ma.id) as total_accounts,
  COUNT(q.id) as total_questions,
  COUNT(q.id) FILTER (WHERE q.status IN ('APPROVED', 'COMPLETED')) as answered_questions,
  AVG(EXTRACT(EPOCH FROM (q."answeredAt" - q."receivedAt"))) as avg_response_time
FROM "Organization" o
JOIN "MLAccount" ma ON ma."organizationId" = o.id
LEFT JOIN "Question" q ON q."mlAccountId" = ma.id
WHERE ma."isActive" = true
GROUP BY o.id;

-- Refresh a cada 5 minutos
CREATE OR REPLACE FUNCTION refresh_org_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY org_metrics_summary;
END;
$$ LANGUAGE plpgsql;
```

### 4. Real-time Updates - SSE Multi-Conta

#### `/api/agent/events-multi`
```typescript
export async function GET() {
  const auth = await getAuthenticatedAccount()
  
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()
  
  // Subscribe para mudanças em TODAS as contas da org
  const subscription = await subscribeToOrgEvents(auth.organizationId, 
    async (event) => {
      const data = {
        type: event.type,
        accountId: event.mlAccountId,
        accountNickname: event.mlAccount?.nickname,
        data: event.data,
        timestamp: new Date().toISOString()
      }
      
      await writer.write(
        encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
      )
    }
  )
  
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache'
    }
  })
}
```

### 5. UI/UX - Design Visual

#### Indicadores Visuais por Conta
```css
/* Cores únicas por conta (até 10) */
.account-color-1 { --account-color: #FFE600; } /* Amarelo ML */
.account-color-2 { --account-color: #3483FA; } /* Azul ML */
.account-color-3 { --account-color: #00A650; } /* Verde */
.account-color-4 { --account-color: #FF6B6B; } /* Vermelho */
.account-color-5 { --account-color: #8B5CF6; } /* Roxo */
.account-color-6 { --account-color: #F97316; } /* Laranja */
.account-color-7 { --account-color: #06B6D4; } /* Ciano */
.account-color-8 { --account-color: #EC4899; } /* Rosa */
.account-color-9 { --account-color: #10B981; } /* Esmeralda */
.account-color-10 { --account-color: #6366F1; } /* Índigo */

/* Badge de conta em perguntas */
.question-account-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--account-color);
  color: white;
  font-size: 11px;
  font-weight: 600;
}

/* Mini card de métricas por conta */
.account-mini-card {
  border-left: 4px solid var(--account-color);
  transition: all 0.2s;
}

.account-mini-card:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
```

### 6. Performance - Otimizações

#### Cache Strategy
```typescript
// Cache por conta com invalidação inteligente
const cacheStrategy = {
  // Cache de métricas agregadas - 30 segundos
  'metrics:org:{orgId}': { ttl: 30, invalidateOn: ['question.answered'] },
  
  // Cache de perguntas por conta - 10 segundos
  'questions:account:{accountId}': { ttl: 10, invalidateOn: ['question.new'] },
  
  // Cache de contas da organização - 5 minutos
  'accounts:org:{orgId}': { ttl: 300, invalidateOn: ['account.updated'] }
}
```

#### Lazy Loading
```typescript
// Carregar dados sob demanda
export function useAccountQuestions(accountId: string) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    if (!accountId) return
    
    setLoading(true)
    apiClient.get(`/api/agent/questions-multi?accountId=${accountId}`)
      .then(setQuestions)
      .finally(() => setLoading(false))
  }, [accountId])
  
  return { questions, loading }
}
```

## 📊 Mockup Visual

```
┌─────────────────────────────────────────────────────────────┐
│  🏢 Organização: Acme Corp     [Gerenciar Contas] [Logout]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 MÉTRICAS AGREGADAS (10 contas ativas)                  │
│  ┌─────────┬─────────┬─────────┬─────────┐                │
│  │   523   │   487   │    36   │  2.5min │                │
│  │  Total  │Respond. │Pendente │  Tempo  │                │
│  └─────────┴─────────┴─────────┴─────────┘                │
│                                                             │
│  👥 CONTAS ML                                               │
│  ┌──────────────┬──────────────┬──────────────┐           │
│  │ 🟡 Loja ABC  │ 🔵 Loja XYZ  │ 🟢 Outlet    │           │
│  │ 156 perguntas│ 89 perguntas │ 278 perguntas│           │
│  │ 12 pendentes │ 5 pendentes  │ 19 pendentes │           │
│  └──────────────┴──────────────┴──────────────┘           │
│  ┌──────────────┬──────────────┬──────────────┐           │
│  │ 🔴 Premium   │ 🟣 Express   │ 🟠 Atacado   │           │
│  │ 45 perguntas │ 67 perguntas │ 123 perguntas│           │
│  │ 3 pendentes  │ 8 pendentes  │ 15 pendentes │           │
│  └──────────────┴──────────────┴──────────────┘           │
│                                                             │
│  📝 PERGUNTAS PENDENTES                                     │
│  [Filtrar: Todas ▼] [Status: Pendentes ▼] [🔄 Atualizar]  │
│                                                             │
│  ┌─────────────────────────────────────────────┐          │
│  │ 🟡 Loja ABC • Notebook Dell i5               │          │
│  │ "Tem garantia? Aceita cartão?"               │          │
│  │ [Aprovar] [Revisar] [IA]    há 2 minutos    │          │
│  └─────────────────────────────────────────────┘          │
│  ┌─────────────────────────────────────────────┐          │
│  │ 🔵 Loja XYZ • iPhone 13 Pro                  │          │
│  │ "Está disponível? Entrega hoje?"             │          │
│  │ [Aprovar] [Revisar] [IA]    há 5 minutos    │          │
│  └─────────────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Fases de Implementação

### Fase 1: Backend Multi-Conta (2 dias)
- [ ] Criar APIs agregadas `/api/agent/metrics-multi`
- [ ] Criar APIs de perguntas multi-conta
- [ ] Adicionar índices no banco
- [ ] Implementar cache strategy

### Fase 2: Frontend Básico (2 dias)
- [ ] Componente de métricas agregadas
- [ ] Lista de perguntas com badges de conta
- [ ] Filtros por conta e status

### Fase 3: Real-time & Performance (1 dia)
- [ ] SSE para updates multi-conta
- [ ] Lazy loading de dados
- [ ] Otimizações de query

### Fase 4: Polish & UX (1 dia)
- [ ] Indicadores visuais por conta
- [ ] Animações e transições
- [ ] Testes de carga com 10 contas

## ⚠️ Considerações Importantes

### Limites e Performance
- **Max 10 contas por organização** (definido no plano)
- **Max 200 perguntas por request** (paginação obrigatória)
- **Cache agressivo** para métricas agregadas
- **Rate limiting** respeitado por conta

### Segurança
- Isolamento por organização mantido
- Tokens individuais por conta
- Audit log para todas operações

### Migração
- Sistema atual continua funcionando
- Novo dashboard como opt-in inicial
- Migração gradual dos usuários

## 📈 Métricas de Sucesso

1. **Performance**: Dashboard carrega em < 2s com 10 contas
2. **Usabilidade**: Redução de 80% nos cliques para ver todas as perguntas
3. **Engajamento**: Aumento de 50% no tempo de resposta às perguntas
4. **Escalabilidade**: Suporta 10 contas com 1000 perguntas cada

## 🔄 Próximos Passos

1. Validar plano com requisitos de negócio
2. Criar branch `feature/multi-account-support`
3. Implementar Fase 1 (Backend)
4. Testes unitários e de integração
5. Deploy em staging para validação