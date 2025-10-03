# 🚀 PLANO: MÓDULO INTELIGÊNCIA DE MERCADO ML AGENT

**Data:** Outubro 2025
**Versão:** 1.0 Production-Ready
**Status:** Aprovado para Implementação

---

## 📋 VISÃO GERAL

### Objetivo
Implementar sistema completo de **análise competitiva** e **criação de anúncios** com Claude Sonnet 4.5, integrando dados REAIS de 13 APIs do Mercado Livre, com WebSocket real-time e rate limiting perfeito.

### Funcionalidades
1. **Otimizar Anúncio Existente**: IA analisa anúncio atual vs concorrência e sugere melhorias
2. **Criar Anúncio do Zero**: IA pesquisa mercado e ajuda criação completa

### Requisitos
- ✅ Zero alteração em funcionalidades existentes
- ✅ Rate limiting: 2 requisições simultâneas + 1s delay por conta ML
- ✅ WebSocket real-time (igual question-cards)
- ✅ Design gold premium (consistente com /agente)
- ✅ Multi-conta (todas contas ML da organização)
- ✅ Mobile-first responsivo (iOS PWA)
- ✅ Dados 100% reais da API ML

---

## 🏗️ ARQUITETURA

### Stack Tecnológico
```
Backend:
- Next.js 15.5.3 (API Routes)
- @anthropic-ai/sdk@0.64.0 (Claude Sonnet 4.5)
- @modelcontextprotocol/sdk (MCP Server)
- Prisma ORM (PostgreSQL)
- Redis (Pub/Sub WebSocket)
- Bull Queue (processamento async)

Frontend:
- React 19 + TypeScript
- Tailwind CSS (gold premium theme)
- Framer Motion (animações)
- Socket.io-client (WebSocket)
- Shadcn/ui components
```

### Estrutura de Diretórios (NOVOS - 100% Isolados)
```
lib/
├── claude/
│   ├── client.ts                    # Anthropic SDK wrapper
│   ├── market-intelligence-agent.ts # Agente principal
│   └── prompts/
│       ├── analyze-product.ts       # Mega-prompt análise
│       └── create-listing.ts        # Mega-prompt criação
│
├── mcp/
│   ├── ml-intelligence-server.ts    # MCP Server ML
│   ├── tools/                       # 13 ferramentas
│   │   ├── search-products.ts
│   │   ├── get-highlights.ts
│   │   ├── get-trends.ts
│   │   ├── get-competition.ts
│   │   ├── get-price-reference.ts
│   │   ├── get-visits.ts
│   │   ├── get-quality.ts
│   │   ├── get-reviews.ts
│   │   ├── get-reputation.ts
│   │   ├── predict-category.ts
│   │   ├── get-attributes.ts
│   │   ├── create-listing.ts
│   │   └── update-listing.ts
│   └── schemas.ts                   # Zod schemas validação
│
├── market-intelligence/
│   ├── rate-limiter.ts              # Rate limiter DEDICADO
│   ├── data-processor.ts            # Processa dados ML APIs
│   ├── insights-generator.ts        # Estrutura insights
│   └── validators/
│       ├── ml-compliance.ts         # Regras ML
│       └── listing-validator.ts     # Valida antes publicar
│
└── websocket/
    └── emit-events.js               # ADICIONAR funções intelligence

app/api/ml-intelligence/
├── analyze/route.ts                 # POST - Analisar produto
├── listings/route.ts                # GET - Listar anúncios
├── create/route.ts                  # POST - Criar anúncio
└── optimize/[itemId]/route.ts       # PUT - Aplicar otimizações

components/listings/
├── listings-intelligence.tsx        # Componente raiz
├── listings-dashboard.tsx           # Dashboard anúncios
├── listings-table.tsx               # Tabela multi-conta
├── optimize-flow.tsx                # Fluxo otimizar (WebSocket)
├── create-wizard/                   # Wizard criar anúncio
│   ├── wizard-container.tsx
│   ├── step1-select-account.tsx
│   ├── step2-product-input.tsx
│   ├── step3-optimization.tsx
│   └── step4-preview.tsx
├── streaming-feedback.tsx           # Updates tempo real
├── insights-results.tsx             # Exibir resultados
├── title-comparison.tsx             # Antes vs Depois
├── price-calculator.tsx             # Calculadora preço
└── shared/
    ├── listing-card.tsx             # Card de anúncio
    └── score-badge.tsx              # Badge score qualidade
```

---

## 💾 DATABASE SCHEMA

### Novos Models Prisma

```prisma
// ========== INTELIGÊNCIA DE MERCADO ==========

model MarketIntelligence {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  mlAccountId     String?
  mlAccount       MLAccount? @relation(fields: [mlAccountId], references: [id], onDelete: SetNull)

  // Input da análise
  productQuery    String   // "iPhone 13 Pro 128GB"
  itemId          String?  // Se otimizar anúncio existente
  analysisType    String   // OPTIMIZE_EXISTING | CREATE_NEW

  // Status do processamento
  status          String   // INITIALIZING | COLLECTING | ANALYZING | GENERATING | COMPLETED | FAILED
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  errorMessage    String?

  // Dados coletados das APIs ML (JSON com dados REAIS)
  searchResults   Json?    // search_similar_products
  topSellers      Json?    // get_highlights (top 20)
  trends          Json?    // get_trends
  competition     Json?    // get_competition (price_to_win)
  priceReference  Json?    // get_price_reference
  visits          Json?    // get_visits
  qualityScore    Json?    // get_quality_score
  reviews         Json?    // get_reviews (NLP)
  reputation      Json?    // get_reputation
  categoryPred    Json?    // predict_category
  attributes      Json?    // get_attributes
  catalogQuality  Json?    // get_catalog_quality
  automationRules Json?    // pricing automation rules

  // Análise Claude Sonnet 4.5 (estruturada)
  insights        Json     // Insights completos
  recommendations Json     // Ações prioritárias com ROI
  seoOptimization Json     // 5 variações título + scores
  pricingStrategy Json     // Matriz 5D + preço ótimo
  contentStrategy Json     // Descrição otimizada
  visualStrategy  Json     // Script fotográfico
  competitiveIntel Json    // Gaps vs concorrência
  forecast        Json     // Previsão 30/60/90 dias

  // Métricas Claude API
  claudeInputTokens  Int   @default(0)
  claudeOutputTokens Int   @default(0)
  totalDurationMs    Int   @default(0)
  apisExecuted       Int   @default(0)
  estimatedCostUSD   Float @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  listingDrafts   ListingDraft[]

  @@index([organizationId, createdAt])
  @@index([mlAccountId, status])
  @@index([status])
}

model ListingDraft {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  mlAccountId     String
  mlAccount       MLAccount @relation(fields: [mlAccountId], references: [id], onDelete: Cascade)
  intelligenceId  String?
  intelligence    MarketIntelligence? @relation(fields: [intelligenceId], references: [id], onDelete: SetNull)

  // Dados do anúncio (formato ML API)
  title           String   // Max 60 caracteres
  description     String   @db.Text // Plain text, max 50k
  categoryId      String
  domainId        String?
  price           Float
  currencyId      String   // BRL, ARS, etc
  quantity        Int      @default(1)
  condition       String   @default("new") // new | used
  buyingMode      String   @default("buy_it_now")
  listingTypeId   String   @default("gold_special")

  // Atributos técnicos (JSON formato ML)
  attributes      Json     // [{id: "BRAND", value_name: "Apple"}]
  saleTerms       Json     // [{id: "WARRANTY_TYPE", value_name: "Garantia do vendedor"}]

  // Imagens
  pictures        Json     // [{source: "url"}] ou [{id: "picture_id"}]

  // Envio
  shipping        Json     // {mode: "me2", free_shipping: true}

  // Scores IA
  seoScore        Int      @default(0)  // 0-100
  qualityScore    Int      @default(0)  // 0-100
  estimatedRank   String?  // "#3-5"

  // Status publicação
  status          String   // DRAFT | VALIDATING | PUBLISHING | PUBLISHED | FAILED
  mlItemId        String?  @unique // ID no ML após publicar
  mlPermalink     String?  // Link anúncio
  publishedAt     DateTime?
  publishError    String?

  // Métricas pós-publicação (webhooks ML)
  views           Int      @default(0)
  sales           Int      @default(0)
  questions       Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId, status])
  @@index([mlAccountId])
  @@index([mlItemId])
  @@index([status])
}

// Adicionar relations nos models existentes
model Organization {
  // ... campos existentes
  marketIntelligences MarketIntelligence[]
  listingDrafts      ListingDraft[]
}

model MLAccount {
  // ... campos existentes
  marketIntelligences MarketIntelligence[]
  listingDrafts      ListingDraft[]
}
```

---

## 🤖 AGENTE CLAUDE SONNET 4.5

### Arquitetura do Agente

```typescript
// lib/claude/market-intelligence-agent.ts
import Anthropic from '@anthropic-ai/sdk'
import { createMLMCPServer } from '@/lib/mcp/ml-intelligence-server'
import { emitIntelligenceProgress } from '@/lib/websocket/emit-events'

export class MarketIntelligenceAgent {
  private claude: Anthropic
  private mcpServer: any
  private intelligenceId: string
  private organizationId: string
  private mlAccountId: string

  constructor(mlAccountId: string, organizationId: string, intelligenceId: string) {
    this.claude = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    })

    this.mlAccountId = mlAccountId
    this.organizationId = organizationId
    this.intelligenceId = intelligenceId

    // MCP Server com 13 tools
    this.mcpServer = createMLMCPServer(mlAccountId, organizationId)
  }

  /**
   * Análise completa de produto com feedback WebSocket tempo real
   */
  async analyzeProduct(productQuery: string, itemId?: string) {
    const startTime = Date.now()

    try {
      // Emitir: Iniciando
      await emitIntelligenceProgress(this.intelligenceId, 'collecting', {
        message: '🚀 Inicializando agente de IA...',
        status: 'loading',
        progress: 0
      }, this.organizationId)

      // FASE 1: Coleta de Dados (MCP Tools)
      await emitIntelligenceProgress(this.intelligenceId, 'collecting', {
        message: '🔍 Coletando dados do Mercado Livre...',
        status: 'loading',
        progress: 10
      }, this.organizationId)

      const collectedData = await this.collectMarketData(productQuery, itemId)

      // FASE 2: Análise Profunda (Claude)
      await emitIntelligenceProgress(this.intelligenceId, 'analyzing', {
        message: '🧠 IA analisando concorrência e padrões...',
        status: 'loading',
        progress: 50
      }, this.organizationId)

      const analysis = await this.analyzeWithClaude(collectedData, productQuery)

      // FASE 3: Geração de Conteúdo
      await emitIntelligenceProgress(this.intelligenceId, 'generating', {
        message: '✍️ IA criando título, descrição e estratégia...',
        status: 'loading',
        progress: 80
      }, this.organizationId)

      const content = await this.generateContent(analysis, productQuery)

      // FASE 4: Estruturar Resultados
      const insights = this.structureInsights(analysis, content, collectedData)

      // Emitir: Completo
      await emitIntelligenceProgress(this.intelligenceId, 'complete', {
        message: '✅ Análise completa!',
        status: 'completed',
        progress: 100,
        insights: insights
      }, this.organizationId)

      return {
        insights,
        rawData: collectedData,
        usage: {
          input_tokens: analysis.usage.input_tokens,
          output_tokens: analysis.usage.output_tokens
        },
        durationMs: Date.now() - startTime
      }

    } catch (error) {
      await emitIntelligenceProgress(this.intelligenceId, 'error', {
        message: `❌ Erro: ${error.message}`,
        status: 'error',
        error: error.message
      }, this.organizationId)

      throw error
    }
  }

  /**
   * Coleta dados das APIs ML usando MCP Tools
   */
  private async collectMarketData(productQuery: string, itemId?: string) {
    const tools = this.mcpServer.getTools()
    const data: any = {}

    // BATCH 1: Busca + Highlights (2 req simultâneas)
    await emitIntelligenceProgress(this.intelligenceId, 'collecting', {
      message: '📊 Buscando produtos similares e top sellers...',
      status: 'loading',
      progress: 15
    }, this.organizationId)

    const [searchResults, topSellers] = await Promise.all([
      this.callTool('search_similar_products', { query: productQuery, limit: 20, sort: 'sold_quantity_desc' }),
      this.callTool('get_top_sellers', { productQuery })
    ])

    data.searchResults = searchResults
    data.topSellers = topSellers

    await new Promise(r => setTimeout(r, 1000)) // 1s delay (best practice ML)

    // BATCH 2: Competition + Price Reference
    await emitIntelligenceProgress(this.intelligenceId, 'collecting', {
      message: '💰 Analisando competição e benchmarks de preço...',
      status: 'loading',
      progress: 25
    }, this.organizationId)

    const [competition, priceRef] = await Promise.all([
      itemId ? this.callTool('get_competition', { itemId }) : Promise.resolve(null),
      itemId ? this.callTool('get_price_reference', { itemId }) : Promise.resolve(null)
    ])

    data.competition = competition
    data.priceReference = priceRef

    await new Promise(r => setTimeout(r, 1000)) // 1s delay

    // BATCH 3: Quality + Reviews
    await emitIntelligenceProgress(this.intelligenceId, 'collecting', {
      message: '⭐ Analisando qualidade e opiniões de clientes...',
      status: 'loading',
      progress: 35
    }, this.organizationId)

    const [quality, reviews] = await Promise.all([
      itemId ? this.callTool('get_quality_score', { itemId }) : Promise.resolve(null),
      this.callTool('get_reviews', { productQuery, limit: 50 })
    ])

    data.qualityScore = quality
    data.reviews = reviews

    await new Promise(r => setTimeout(r, 1000)) // 1s delay

    // BATCH 4: Trends + Visits
    await emitIntelligenceProgress(this.intelligenceId, 'collecting', {
      message: '📈 Verificando tendências e analytics...',
      status: 'loading',
      progress: 45
    }, this.organizationId)

    const [trends, visits] = await Promise.all([
      this.callTool('get_trends', { categoryId: searchResults.categoryId }),
      itemId ? this.callTool('get_visits', { itemId }) : Promise.resolve(null)
    ])

    data.trends = trends
    data.visits = visits

    await emitIntelligenceProgress(this.intelligenceId, 'collecting', {
      message: '✅ Dados coletados com sucesso!',
      status: 'completed',
      progress: 48,
      data: {
        apisExecuted: Object.keys(data).filter(k => data[k]).length,
        productsAnalyzed: searchResults.results.length
      }
    }, this.organizationId)

    return data
  }

  /**
   * Análise com Claude Sonnet 4.5 (sem Extended Thinking)
   */
  private async analyzeWithClaude(collectedData: any, productQuery: string) {
    const response = await this.claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 12000,
      temperature: 0.3, // Mais determinístico para análises
      messages: [{
        role: 'user',
        content: this.buildAnalysisPrompt(collectedData, productQuery)
      }]
    })

    return {
      analysis: JSON.parse(response.content[0].text),
      usage: response.usage
    }
  }

  /**
   * Mega-Prompt de Análise
   */
  private buildAnalysisPrompt(data: any, productQuery: string): string {
    return `Você é um Especialista em Vendas do Mercado Livre com 10 anos de experiência.

MISSÃO: Analisar "${productQuery}" e gerar plano completo de otimização.

=== DADOS COLETADOS ===

PRODUTOS SIMILARES (${data.searchResults?.results?.length || 0} encontrados):
${JSON.stringify(data.searchResults, null, 2)}

TOP 20 MAIS VENDIDOS:
${JSON.stringify(data.topSellers, null, 2)}

TENDÊNCIAS DA CATEGORIA:
${JSON.stringify(data.trends, null, 2)}

${data.competition ? `COMPETIÇÃO NO CATÁLOGO:\n${JSON.stringify(data.competition, null, 2)}` : ''}

${data.priceReference ? `BENCHMARKS DE PREÇO:\n${JSON.stringify(data.priceReference, null, 2)}` : ''}

${data.reviews ? `OPINIÕES DE CLIENTES (${data.reviews.length} reviews):\n${JSON.stringify(data.reviews, null, 2)}` : ''}

${data.qualityScore ? `SCORE DE QUALIDADE:\n${JSON.stringify(data.qualityScore, null, 2)}` : ''}

=== TAREFA ===

Analise PROFUNDAMENTE todos os dados e retorne JSON estruturado:

{
  "executiveSummary": {
    "productName": "string",
    "currentPosition": "#X ou N/A",
    "potentialPosition": "#X-Y",
    "currentRevenue": "R$ X/mês ou N/A",
    "potentialRevenue": "R$ X/mês",
    "roi": "+X%",
    "urgency": "CRITICAL | HIGH | MEDIUM | LOW",
    "keyInsight": "Frase resumo do principal insight"
  },

  "marketAnalysis": {
    "totalCompetitors": 0,
    "averagePrice": 0,
    "medianPrice": 0,
    "priceRange": { "min": 0, "max": 0 },
    "topSellerPrice": 0,
    "marketTrend": "growing | stable | declining",
    "competitionLevel": "low | medium | high | saturated"
  },

  "problemAnalysis": {
    "critical": [
      {
        "problem": "Descrição específica",
        "impact": "Número + % + R$",
        "currentValue": "valor atual",
        "benchmarkValue": "valor dos tops",
        "costToFix": "R$ ou tempo",
        "expectedROI": "+X% vendas = +R$ Y/mês"
      }
    ],
    "high": [...],
    "medium": [...]
  },

  "actionPlan": {
    "quickWins": [ // < 5 minutos, alto ROI
      {
        "action": "string",
        "currentValue": "valor atual",
        "newValue": "valor sugerido",
        "steps": ["passo 1", "passo 2"],
        "estimatedTime": "X minutos",
        "impact": "+X% métrica",
        "roiScore": 0-100,
        "priority": 1
      }
    ],
    "mediumTerm": [], // 1 hora - 1 dia
    "longTerm": []    // > 1 dia
  },

  "seoOptimization": {
    "currentTitle": "string",
    "currentScore": 0-100,
    "titleIssues": ["issue 1", "issue 2"],
    "optimizedTitles": [
      {
        "title": "string",
        "score": 0-100,
        "keywords": ["palavra 1"],
        "reasoning": "explicação",
        "estimatedCTR": "+X%",
        "estimatedPosition": "#X-Y"
      }
    ]
  },

  "pricingStrategy": {
    "currentPrice": 0,
    "marketAnalysis": {
      "averagePrice": 0,
      "medianPrice": 0,
      "yourPercentile": 0,
      "priceToWin": 0
    },
    "recommendations": [
      {
        "price": 0,
        "margin": 0,
        "estimatedSales": 0,
        "totalProfit": 0,
        "rank": "#X",
        "reasoning": "string"
      }
    ],
    "optimalPrice": 0,
    "reasoning": "explicação detalhada"
  },

  "contentOptimization": {
    "currentDescription": "string ou null",
    "optimizedDescription": "markdown formatado",
    "keyImprovements": ["melhoria 1"],
    "questionsPreventedEstimate": 0,
    "conversionImpact": "+X%"
  },

  "visualStrategy": {
    "currentPhotos": 0,
    "recommendedCount": 8,
    "photoScript": [
      "Foto 1: Descrição específica",
      "Foto 2: ...",
    ],
    "qualityGuidelines": ["guideline 1"]
  },

  "forecast30Days": {
    "conservative": { "sales": 0, "revenue": 0, "profit": 0, "probability": 0.7 },
    "realistic": { "sales": 0, "revenue": 0, "profit": 0, "probability": 0.85 },
    "optimistic": { "sales": 0, "revenue": 0, "profit": 0, "probability": 0.3 }
  }
}

IMPORTANTE:
- Seja ESPECÍFICO com números reais
- Baseie TUDO nos dados coletados
- Calcule ROI para CADA ação
- Priorize por impacto × esforço
- Explique o PORQUÊ
`
  }

  /**
   * Chamar tool MCP com tracking
   */
  private async callTool(toolName: string, args: any) {
    try {
      const result = await this.mcpServer.callTool(toolName, args)

      // Emitir progresso
      await emitIntelligenceProgress(this.intelligenceId, 'collecting', {
        message: `✓ ${this.getToolDescription(toolName)}`,
        status: 'completed',
        tool: toolName
      }, this.organizationId)

      return result
    } catch (error) {
      // Log mas não falha (dados opcionais)
      await emitIntelligenceProgress(this.intelligenceId, 'collecting', {
        message: `⚠ ${toolName}: ${error.message}`,
        status: 'warning'
      }, this.organizationId)

      return null
    }
  }

  private getToolDescription(toolName: string): string {
    const descriptions = {
      'search_similar_products': 'Produtos similares encontrados',
      'get_top_sellers': 'Top 20 mais vendidos analisados',
      'get_trends': 'Tendências identificadas',
      'get_competition': 'Competição no catálogo avaliada',
      'get_price_reference': 'Benchmarks de preço coletados',
      'get_reviews': 'Opiniões de clientes processadas',
      'get_quality_score': 'Score de qualidade verificado',
      // ...
    }
    return descriptions[toolName] || toolName
  }
}
```

---

## 🛠️ MCP SERVER: 13 TOOLS MERCADO LIVRE

### Implementação Completa

```typescript
// lib/mcp/ml-intelligence-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { getValidMLToken } from '@/lib/ml-api/token-manager'
import { MLIntelligenceRateLimiter } from '@/lib/market-intelligence/rate-limiter'

export function createMLMCPServer(mlAccountId: string, organizationId: string) {
  const server = new Server(
    {
      name: 'ml-intelligence',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  )

  // Rate Limiter DEDICADO (não interfere com questions)
  const rateLimiter = new MLIntelligenceRateLimiter(mlAccountId)

  // Helper: Executar API ML com rate limiting
  const executeMLAPI = async (apiName: string, fn: () => Promise<any>) => {
    return rateLimiter.executeRequest(mlAccountId, async () => {
      const token = await getValidMLToken(mlAccountId)
      if (!token) throw new Error('Token inválido')

      return fn(token)
    })
  }

  // ========== REGISTRAR TOOLS ==========

  const tools = [
    // TOOL 1: Search Products
    {
      name: 'search_similar_products',
      description: 'Busca produtos similares no Mercado Livre com dados reais (preço, vendas, seller)',
      inputSchema: z.object({
        query: z.string().describe('Termo de busca do produto'),
        limit: z.number().default(20).describe('Quantidade de resultados (max 50)'),
        sort: z.enum(['relevance', 'price_asc', 'price_desc', 'sold_quantity_desc']).default('sold_quantity_desc')
      }),
      handler: async (args: any) => {
        return executeMLAPI('search', async (token) => {
          const account = await prisma.mLAccount.findUnique({
            where: { id: mlAccountId },
            select: { siteId: true }
          })

          const url = `https://api.mercadolibre.com/sites/${account.siteId}/search?q=${encodeURIComponent(args.query)}&limit=${args.limit}&sort=${args.sort}`

          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          if (!response.ok) throw new Error(`ML API error: ${response.status}`)

          const data = await response.json()

          return {
            total: data.paging.total,
            categoryId: data.results[0]?.category_id,
            results: data.results.map((r: any) => ({
              id: r.id,
              title: r.title,
              price: r.price,
              sold_quantity: r.sold_quantity,
              condition: r.condition,
              thumbnail: r.thumbnail,
              seller: {
                nickname: r.seller.nickname,
                reputation: r.seller.seller_reputation?.level_id
              },
              shipping: {
                free: r.shipping?.free_shipping,
                mode: r.shipping?.mode
              }
            }))
          }
        })
      }
    },

    // TOOL 2: Get Highlights (Top 20 Mais Vendidos)
    {
      name: 'get_top_sellers',
      description: 'Obtém top 20 produtos MAIS VENDIDOS da categoria',
      inputSchema: z.object({
        categoryId: z.string().describe('ID da categoria ML')
      }),
      handler: async (args: any) => {
        return executeMLAPI('highlights', async (token) => {
          const account = await prisma.mLAccount.findUnique({
            where: { id: mlAccountId },
            select: { siteId: true }
          })

          const url = `https://api.mercadolibre.com/highlights/${account.siteId}/category/${args.categoryId}`
          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          const data = await response.json()

          // Buscar detalhes dos items (batch)
          const itemIds = data.content.slice(0, 20).map((c: any) => c.id).join(',')
          const itemsUrl = `https://api.mercadolibre.com/items?ids=${itemIds}`

          const itemsResponse = await fetch(itemsUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          const items = await itemsResponse.json()

          return items.map((item: any, idx: number) => ({
            position: idx + 1,
            id: item.body.id,
            title: item.body.title,
            price: item.body.price,
            sold_quantity: item.body.sold_quantity,
            attributes: item.body.attributes,
            pictures_count: item.body.pictures?.length || 0,
            listing_type: item.body.listing_type_id,
            free_shipping: item.body.shipping?.free_shipping
          }))
        })
      }
    },

    // TOOL 3: Get Trends
    {
      name: 'get_trends',
      description: 'Obtém top 50 produtos em alta (tendências semanais)',
      inputSchema: z.object({
        categoryId: z.string().optional().describe('Filtrar por categoria')
      }),
      handler: async (args: any) => {
        return executeMLAPI('trends', async (token) => {
          const account = await prisma.mLAccount.findUnique({
            where: { id: mlAccountId },
            select: { siteId: true }
          })

          const url = args.categoryId
            ? `https://api.mercadolibre.com/trends/${account.siteId}/${args.categoryId}`
            : `https://api.mercadolibre.com/trends/${account.siteId}`

          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          return response.json()
        })
      }
    },

    // TOOL 4: Get Competition (Price to Win)
    {
      name: 'get_competition',
      description: 'Análise de competição no catálogo (price_to_win)',
      inputSchema: z.object({
        itemId: z.string().describe('ID do anúncio ML')
      }),
      handler: async (args: any) => {
        return executeMLAPI('competition', async (token) => {
          const url = `https://api.mercadolibre.com/items/${args.itemId}/price_to_win?version=v2`

          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          return response.json()
        })
      }
    },

    // TOOL 5: Get Price Reference
    {
      name: 'get_price_reference',
      description: 'Referências de preço ML (interno + externo)',
      inputSchema: z.object({
        itemId: z.string()
      }),
      handler: async (args: any) => {
        return executeMLAPI('price_reference', async (token) => {
          const url = `https://api.mercadolibre.com/suggestions/items/${args.itemId}/details`

          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          return response.json()
        })
      }
    },

    // TOOL 6: Get Visits
    {
      name: 'get_visits',
      description: 'Analytics de visitas do anúncio',
      inputSchema: z.object({
        itemId: z.string(),
        days: z.number().default(30)
      }),
      handler: async (args: any) => {
        return executeMLAPI('visits', async (token) => {
          const url = `https://api.mercadolibre.com/items/${args.itemId}/visits/time_window?last=${args.days}&unit=day`

          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          return response.json()
        })
      }
    },

    // TOOL 7: Get Quality Score
    {
      name: 'get_quality_score',
      description: 'Score de qualidade do anúncio (0-100)',
      inputSchema: z.object({
        itemId: z.string()
      }),
      handler: async (args: any) => {
        return executeMLAPI('quality', async (token) => {
          const url = `https://api.mercadolibre.com/item/${args.itemId}/performance`

          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          return response.json()
        })
      }
    },

    // TOOL 8: Get Reviews (NLP)
    {
      name: 'get_reviews',
      description: 'Opiniões de clientes (análise de sentimento)',
      inputSchema: z.object({
        itemId: z.string().optional(),
        productQuery: z.string().optional(),
        limit: z.number().default(50)
      }),
      handler: async (args: any) => {
        return executeMLAPI('reviews', async (token) => {
          let itemId = args.itemId

          // Se não tem itemId, buscar um produto similar
          if (!itemId && args.productQuery) {
            const search = await fetch(
              `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(args.productQuery)}&limit=1`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            )
            const searchData = await search.json()
            itemId = searchData.results[0]?.id
          }

          if (!itemId) return { reviews: [], rating_average: 0 }

          const url = `https://api.mercadolibre.com/reviews/item/${itemId}`
          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          return response.json()
        })
      }
    },

    // TOOL 9: Get Reputation
    {
      name: 'get_seller_reputation',
      description: 'Reputação do vendedor (métricas detalhadas)',
      inputSchema: z.object({
        userId: z.string().describe('ML User ID do vendedor')
      }),
      handler: async (args: any) => {
        return executeMLAPI('reputation', async (token) => {
          const url = `https://api.mercadolibre.com/users/${args.userId}`

          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          const data = await response.json()

          return {
            level: data.seller_reputation?.level_id,
            power_seller: data.seller_reputation?.power_seller_status,
            metrics: data.seller_reputation?.metrics,
            transactions: data.seller_reputation?.transactions
          }
        })
      }
    },

    // TOOL 10: Predict Category
    {
      name: 'predict_category',
      description: 'Preditor de categoria (IA do ML)',
      inputSchema: z.object({
        title: z.string().describe('Título do produto')
      }),
      handler: async (args: any) => {
        return executeMLAPI('category_predictor', async (token) => {
          const account = await prisma.mLAccount.findUnique({
            where: { id: mlAccountId },
            select: { siteId: true }
          })

          const url = `https://api.mercadolibre.com/sites/${account.siteId}/domain_discovery/search?q=${encodeURIComponent(args.title)}&limit=3`

          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          return response.json()
        })
      }
    },

    // TOOL 11: Get Attributes
    {
      name: 'get_category_attributes',
      description: 'Atributos obrigatórios e opcionais da categoria',
      inputSchema: z.object({
        categoryId: z.string()
      }),
      handler: async (args: any) => {
        return executeMLAPI('attributes', async (token) => {
          const url = `https://api.mercadolibre.com/categories/${args.categoryId}/attributes`

          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

          return response.json()
        })
      }
    },

    // TOOL 12: Create Listing
    {
      name: 'create_ml_listing',
      description: 'Publica novo anúncio no Mercado Livre',
      inputSchema: z.object({
        title: z.string(),
        category_id: z.string(),
        price: z.number(),
        available_quantity: z.number(),
        condition: z.enum(['new', 'used']),
        attributes: z.array(z.any()),
        description: z.string().optional(),
        pictures: z.array(z.any()).optional()
      }),
      handler: async (args: any) => {
        return executeMLAPI('create_listing', async (token) => {
          const account = await prisma.mLAccount.findUnique({
            where: { id: mlAccountId },
            select: { siteId: true }
          })

          const payload = {
            title: args.title,
            category_id: args.category_id,
            price: args.price,
            currency_id: account.siteId === 'MLB' ? 'BRL' : 'ARS',
            available_quantity: args.available_quantity,
            buying_mode: 'buy_it_now',
            condition: args.condition,
            listing_type_id: 'gold_special',
            attributes: args.attributes,
            pictures: args.pictures || []
          }

          const response = await fetch('https://api.mercadolibre.com/items', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(`ML API Error: ${JSON.stringify(error)}`)
          }

          return response.json()
        })
      }
    },

    // TOOL 13: Update Listing
    {
      name: 'update_ml_listing',
      description: 'Atualiza anúncio existente no ML',
      inputSchema: z.object({
        itemId: z.string(),
        updates: z.object({
          title: z.string().optional(),
          price: z.number().optional(),
          available_quantity: z.number().optional()
        })
      }),
      handler: async (args: any) => {
        return executeMLAPI('update_listing', async (token) => {
          const response = await fetch(`https://api.mercadolibre.com/items/${args.itemId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(args.updates)
          })

          return response.json()
        })
      }
    }
  ]

  // Registrar todas as tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema)
    }))
  }))

  // Handler de chamadas
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find(t => t.name === request.params.name)

    if (!tool) {
      throw new Error(`Tool ${request.params.name} not found`)
    }

    try {
      const result = await tool.handler(request.params.arguments)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: error.message }, null, 2)
        }],
        isError: true
      }
    }
  })

  return {
    server,
    getTools: () => tools,
    callTool: async (name: string, args: any) => {
      const tool = tools.find(t => t.name === name)
      return tool?.handler(args)
    }
  }
}

// Helper: Convert Zod to JSON Schema
function zodToJsonSchema(schema: z.ZodType) {
  // Implementação básica
  return {
    type: 'object',
    properties: {},
    required: []
  }
}
```

---

## 🔄 WEBSOCKET: REAL-TIME UPDATES

### Backend: Emitters (Adicionar em emit-events.js)

```javascript
// lib/websocket/emit-events.js (ADICIONAR)

/**
 * Emit intelligence analysis progress
 */
async function emitIntelligenceProgress(intelligenceId, phase, data, organizationId) {
  const eventData = {
    organizationId,
    intelligenceId,
    phase, // 'collecting' | 'analyzing' | 'generating' | 'complete' | 'error'
    data,
    timestamp: Date.now()
  }

  // Publish para organização
  await publishEvent('intelligence:progress', eventData)
  await publishEvent(`org:${organizationId}:intelligence`, eventData)

  console.log('[WebSocket] Intelligence progress:', {
    intelligenceId,
    phase,
    organizationId
  })
}

/**
 * Emit listing creation/update
 */
async function emitListingUpdate(draftId, event, data, organizationId, mlAccountId) {
  const eventData = {
    organizationId,
    mlAccountId,
    draftId,
    event, // 'validating' | 'creating' | 'published' | 'error'
    data,
    timestamp: Date.now()
  }

  await publishEvent('listing:update', eventData)
  await publishEvent(`org:${organizationId}:listings`, eventData)

  console.log('[WebSocket] Listing update:', {
    draftId,
    event,
    organizationId
  })
}

// Export
module.exports = {
  // ... exports existentes
  emitIntelligenceProgress,
  emitListingUpdate
}
```

### WebSocket Server: Subscribe (Adicionar em websocket-server.js)

```javascript
// websocket-server.js (ADICIONAR após linha 315)

// Subscribe to intelligence channels
await redisSub.subscribe('intelligence:progress')
await redisSub.subscribe('listing:update')

// No handler de messages (adicionar casos):
redisSub.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message)

    // ... handlers existentes

    // NOVO: Intelligence updates
    if (channel === 'intelligence:progress') {
      io.to(`org:${data.organizationId}`).emit('intelligence:progress', data)
    }

    // NOVO: Listing updates
    if (channel === 'listing:update') {
      io.to(`org:${data.organizationId}`).emit('listing:update', data)
      io.to(`account:${data.mlAccountId}`).emit('listing:update', data)
    }

  } catch (error) {
    logger.error('Error processing Redis message:', error)
  }
})
```

### Frontend: Hook WebSocket (Reutilizar Existente)

```tsx
// components/listings/optimize-flow.tsx
import { useWebSocket } from '@/hooks/use-websocket' // Hook EXISTENTE

export function OptimizeFlow() {
  const socket = useWebSocket() // Mesma conexão de questions
  const [updates, setUpdates] = useState([])

  useEffect(() => {
    // Listener (igual question-card)
    const handleProgress = (data: any) => {
      console.log('[Intelligence] Progress:', data)

      setUpdates(prev => [...prev, {
        phase: data.phase,
        message: data.data?.message,
        status: data.data?.status,
        timestamp: data.timestamp
      }])

      if (data.phase === 'complete') {
        setInsights(data.data.insights)
      }
    }

    // Subscribe
    socket.on('intelligence:progress', handleProgress)

    // Cleanup
    return () => {
      socket.off('intelligence:progress', handleProgress)
    }
  }, [socket])

  // UI atualiza em tempo real via WebSocket
  return (
    <div>
      {updates.map((u, i) => (
        <UpdateCard key={i} update={u} />
      ))}
    </div>
  )
}
```

---

## 🎨 UI: NOVA TAB "ANÚNCIOS IA"

### Modificação em app/agente/page.tsx

```tsx
// ADICIONAR import
import { ListingsIntelligence } from '@/components/listings/listings-intelligence'
import { Sparkles } from 'lucide-react'

// ADICIONAR no TabsList (após "Histórico"):
<TabsTrigger
  value="listings"
  className="group relative flex-1 h-10 sm:h-11 lg:h-12 px-2 sm:px-3 lg:px-5 rounded-xl sm:rounded-xl lg:rounded-2xl font-bold text-xs sm:text-sm lg:text-base transition-all duration-500 overflow-hidden
    data-[state=inactive]:bg-white/[0.02] data-[state=inactive]:hover:bg-white/[0.05]
    data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-white
    data-[state=active]:bg-gradient-to-r data-[state=active]:from-gold data-[state=active]:via-gold-light data-[state=active]:to-gold
    data-[state=active]:text-black data-[state=active]:shadow-2xl data-[state=active]:shadow-gold/40
    flex items-center justify-center gap-1 sm:gap-1.5 lg:gap-2">

  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 data-[state=active]:hidden" />

  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5 relative z-10" />
  <span className="relative z-10 font-semibold text-xs sm:text-sm lg:text-base hidden sm:inline">Anúncios IA</span>
  <span className="relative z-10 font-semibold text-xs sm:inline lg:hidden">IA</span>

  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-data-[state=active]:animate-shimmer" />

  {/* Badge BETA */}
  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-gold text-black rounded-full shadow-lg">
    BETA
  </span>
</TabsTrigger>

// ADICIONAR TabsContent (após "all-questions"):
<TabsContent value="listings" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
  <ListingsIntelligence
    organizationId={organizationData?.organizationId || ""}
    mlAccounts={organizationData?.mlAccounts || []}
  />
</TabsContent>
```

### Componente Principal

```tsx
// components/listings/listings-intelligence.tsx
'use client'

import { useState, useEffect } from 'react'
import { ListingsDashboard } from './listings-dashboard'
import { OptimizeFlow } from './optimize-flow'
import { CreateWizard } from './create-wizard/wizard-container'
import { Sparkles, Package, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ListingsIntelligence({ organizationId, mlAccounts }) {
  const [view, setView] = useState<'dashboard' | 'optimize' | 'create'>('dashboard')
  const [selectedListing, setSelectedListing] = useState(null)
  const [selectedAccount, setSelectedAccount] = useState(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      {view === 'dashboard' ? (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gold to-gold-light flex items-center justify-center shadow-2xl shadow-gold/30">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gold">Inteligência de Mercado</h2>
              <p className="text-xs sm:text-sm text-gray-400">Otimize e crie anúncios com IA</p>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              onClick={() => setView('optimize')}
              variant="outline"
              className="flex-1 sm:flex-initial border-gold/20 hover:border-gold/40 hover:bg-gold/5 text-sm sm:text-base">
              🔍 Otimizar
            </Button>

            <Button
              onClick={() => setView('create')}
              className="flex-1 sm:flex-initial bg-gradient-to-r from-gold to-gold-light text-black font-bold shadow-2xl shadow-gold/40 hover:scale-105 transition-transform text-sm sm:text-base">
              ✨ Criar com IA
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setView('dashboard')}
          variant="outline"
          className="border-gold/20 hover:border-gold/40">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      )}

      {/* Content */}
      {view === 'dashboard' && (
        <ListingsDashboard
          organizationId={organizationId}
          mlAccounts={mlAccounts}
          onOptimize={(listing) => {
            setSelectedListing(listing)
            setView('optimize')
          }}
          onCreateNew={(account) => {
            setSelectedAccount(account)
            setView('create')
          }}
        />
      )}

      {view === 'optimize' && (
        <OptimizeFlow
          listing={selectedListing}
          organizationId={organizationId}
          onComplete={() => setView('dashboard')}
        />
      )}

      {view === 'create' && (
        <CreateWizard
          organizationId={organizationId}
          mlAccounts={mlAccounts}
          preselectedAccount={selectedAccount}
          onComplete={() => setView('dashboard')}
        />
      )}
    </div>
  )
}
```

---

## 🔐 SEGURANÇA & COMPLIANCE

### Rate Limiting Dedicado

```typescript
// lib/market-intelligence/rate-limiter.ts
export class MLIntelligenceRateLimiter {
  private accountQueues: Map<string, RequestQueue> = new Map()

  // Configuração (NÃO interfere com questions)
  private readonly BATCH_SIZE = 2        // 2 req simultâneas
  private readonly BATCH_DELAY_MS = 1000 // 1s delay
  private readonly MAX_PER_HOUR = 450    // 10% margem segurança

  async executeRequest<T>(
    mlAccountId: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const queue = this.getOrCreateQueue(mlAccountId)

    // Verificar quota
    if (queue.requestsThisHour >= this.MAX_PER_HOUR) {
      throw new Error('Quota horária excedida. Aguarde reset.')
    }

    return new Promise((resolve, reject) => {
      queue.pending.push({ requestFn, resolve, reject })
      this.processQueue(mlAccountId)
    })
  }

  private async processQueue(mlAccountId: string) {
    const queue = this.getOrCreateQueue(mlAccountId)
    if (queue.processing) return

    queue.processing = true

    while (queue.pending.length > 0) {
      // Batch de 2
      const batch = queue.pending.splice(0, this.BATCH_SIZE)

      // Executar em paralelo
      const results = await Promise.allSettled(
        batch.map(req => req.requestFn())
      )

      // Resolver promises
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          batch[idx].resolve(result.value)
          queue.requestsThisHour++
        } else {
          batch[idx].reject(result.reason)
        }
      })

      // Delay 1s entre batches
      if (queue.pending.length > 0) {
        await new Promise(r => setTimeout(r, this.BATCH_DELAY_MS))
      }
    }

    queue.processing = false
  }

  private getOrCreateQueue(mlAccountId: string): RequestQueue {
    if (!this.accountQueues.has(mlAccountId)) {
      this.accountQueues.set(mlAccountId, {
        pending: [],
        processing: false,
        requestsThisHour: 0,
        hourReset: Date.now() + 3600000
      })
    }

    const queue = this.accountQueues.get(mlAccountId)!

    // Reset contador a cada hora
    if (Date.now() >= queue.hourReset) {
      queue.requestsThisHour = 0
      queue.hourReset = Date.now() + 3600000
    }

    return queue
  }
}

interface RequestQueue {
  pending: Array<{
    requestFn: () => Promise<any>
    resolve: (value: any) => void
    reject: (error: any) => void
  }>
  processing: boolean
  requestsThisHour: number
  hourReset: number
}
```

### Validação ML Compliance

```typescript
// lib/market-intelligence/validators/ml-compliance.ts
export async function validateMLListing(draft: any) {
  const errors: string[] = []

  // 1. Título
  if (draft.title.length > 60) {
    errors.push('Título excede 60 caracteres')
  }

  if (draft.title.split(' ').length < 3) {
    errors.push('Título deve ter no mínimo 3 palavras')
  }

  // Palavras proibidas
  const forbidden = ['promoção', 'melhor preço', 'aproveite']
  if (forbidden.some(w => draft.title.toLowerCase().includes(w))) {
    errors.push('Título contém palavras proibidas pelo ML')
  }

  // Sem emojis
  if (/[\u{1F600}-\u{1F64F}]/u.test(draft.title)) {
    errors.push('Título não pode conter emojis')
  }

  // 2. Preço
  const category = await fetch(`https://api.mercadolibre.com/categories/${draft.categoryId}`)
    .then(r => r.json())

  if (draft.price < category.settings.minimum_price) {
    errors.push(`Preço abaixo do mínimo da categoria (R$ ${category.settings.minimum_price})`)
  }

  // 3. Descrição
  if (draft.description && draft.description.length > 50000) {
    errors.push('Descrição excede 50.000 caracteres')
  }

  // Sem HTML
  if (/<[^>]*>/g.test(draft.description)) {
    errors.push('Descrição deve ser plain text (sem HTML)')
  }

  // 4. Fotos
  if (!draft.pictures || draft.pictures.length === 0) {
    errors.push('Anúncio deve ter no mínimo 1 foto')
  }

  if (draft.pictures && draft.pictures.length > category.settings.max_pictures_per_item) {
    errors.push(`Máximo ${category.settings.max_pictures_per_item} fotos para esta categoria`)
  }

  // 5. Atributos obrigatórios
  const requiredAttrs = await fetch(
    `https://api.mercadolibre.com/categories/${draft.categoryId}/attributes`
  ).then(r => r.json())

  const required = requiredAttrs.filter((a: any) => a.tags?.includes('required'))
  const provided = draft.attributes.map((a: any) => a.id)
  const missing = required.filter((r: any) => !provided.includes(r.id))

  if (missing.length > 0) {
    errors.push(`Atributos obrigatórios faltando: ${missing.map((m: any) => m.name).join(', ')}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: []
  }
}
```

---

## 📊 COMPONENTES VISUAIS

### Dashboard de Anúncios

```tsx
// components/listings/listings-dashboard.tsx
export function ListingsDashboard({ organizationId, mlAccounts, onOptimize, onCreateNew }) {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAccountFilter, setSelectedAccountFilter] = useState('all')
  const socket = useWebSocket()

  // Fetch anúncios de TODAS contas
  useEffect(() => {
    const fetchAllListings = async () => {
      try {
        const response = await apiClient.get('/api/ml-intelligence/listings')
        setListings(response.listings || [])
      } catch (error) {
        logger.error('Failed to fetch listings:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAllListings()
  }, [organizationId])

  // Listen WebSocket para novos anúncios publicados
  useEffect(() => {
    const handleListingPublished = (data: any) => {
      setListings(prev => [data.listing, ...prev])
      toast.success(`✅ Anúncio publicado: ${data.listing.title}`)
    }

    socket.on('listing:update', (data) => {
      if (data.event === 'published') {
        handleListingPublished(data)
      }
    })

    return () => {
      socket.off('listing:update', handleListingPublished)
    }
  }, [socket])

  // Filtrar
  const filtered = selectedAccountFilter === 'all'
    ? listings
    : listings.filter(l => l.mlAccount.id === selectedAccountFilter)

  // Agrupar por conta
  const grouped = groupBy(filtered, l => l.mlAccount.id)

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Filtro Multi-Conta */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-black/20 border border-white/5">
        <span className="text-sm text-gray-400">Filtrar por conta:</span>
        <select
          value={selectedAccountFilter}
          onChange={(e) => setSelectedAccountFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white focus:border-gold/40 focus:outline-none">
          <option value="all">Todas as Contas ({mlAccounts.length})</option>
          {mlAccounts.map(acc => (
            <option key={acc.id} value={acc.id}>{acc.nickname}</option>
          ))}
        </select>
      </div>

      {/* Anúncios agrupados por conta */}
      <div className="space-y-8">
        {Object.entries(grouped).map(([accountId, items]) => {
          const account = mlAccounts.find(a => a.id === accountId)

          return (
            <div key={accountId}>
              {/* Header da Conta */}
              <div className="flex items-center justify-between mb-4 px-4 py-3 rounded-xl bg-black/20 border border-white/5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 border-2 border-gold/20">
                    <AvatarImage src={account?.thumbnail} />
                    <AvatarFallback className="bg-gold/10 text-gold">
                      {account?.nickname[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-semibold text-gold">{account?.nickname}</span>
                    <span className="text-xs text-gray-500 ml-2">({items.length} anúncios)</span>
                  </div>
                </div>

                <Button
                  onClick={() => onCreateNew(account)}
                  size="sm"
                  variant="outline"
                  className="border-gold/20 hover:border-gold/40">
                  <Sparkles className="w-4 h-4 mr-1" />
                  Novo
                </Button>
              </div>

              {/* Grid de Anúncios */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(listing => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onOptimize={() => onOptimize(listing)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="text-center py-20">
          <Package className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">Nenhum anúncio encontrado</p>
          <Button
            onClick={() => onCreateNew(mlAccounts[0])}
            className="mt-4 bg-gradient-to-r from-gold to-gold-light text-black">
            Criar Primeiro Anúncio
          </Button>
        </div>
      )}
    </div>
  )
}
```

---

## 📱 RESPONSIVIDADE

### Breakpoints (Padrão Tailwind)
```css
sm:  640px   /* Tablet pequeno */
md:  768px   /* Tablet */
lg:  1024px  /* Desktop */
xl:  1280px  /* Desktop large */

/* iOS Safe Areas */
pt-[env(safe-area-inset-top,20px)]
pb-[env(safe-area-inset-bottom,20px)]
```

### Grid Responsivo
```tsx
<div className="
  grid
  grid-cols-1           /* Mobile: 1 coluna */
  md:grid-cols-2       /* Tablet: 2 colunas */
  lg:grid-cols-3       /* Desktop: 3 colunas */
  gap-4 sm:gap-6       /* Gaps adaptativos */
">
```

---

## 📦 DEPENDÊNCIAS

### Instalar (package.json)

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.64.0",
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

### Variáveis de Ambiente (.env)

```bash
# Claude API
ANTHROPIC_API_KEY="sk-ant-..."
CLAUDE_MODEL="claude-sonnet-4-20250514"
CLAUDE_MAX_TOKENS="12000"

# Rate Limiting Intelligence (dedicado)
ML_INTELLIGENCE_BATCH_SIZE="2"
ML_INTELLIGENCE_DELAY_MS="1000"
ML_INTELLIGENCE_MAX_PER_HOUR="450"
```

---

## 🚀 CRONOGRAMA DE IMPLEMENTAÇÃO

### Sprint 1: Fundação (Dias 1-5)
- **Dia 1:** Prisma schema + migrations
- **Dia 2:** Instalar dependencies + env vars
- **Dia 3:** Rate limiter dedicado
- **Dia 4-5:** MCP Server básico (5 tools principais)

### Sprint 2: Agente (Dias 6-10)
- **Dia 6-7:** Claude client + Agent class
- **Dia 8:** Mega-prompts otimizados
- **Dia 9:** WebSocket emitters
- **Dia 10:** Testes agente com dados reais

### Sprint 3: Backend (Dias 11-15)
- **Dia 11-12:** POST /analyze + async processing
- **Dia 13:** GET /listings + POST /create
- **Dia 14:** PUT /optimize
- **Dia 15:** Testes integração + rate limiting

### Sprint 4: Frontend (Dias 16-20)
- **Dia 16:** ListingsIntelligence (componente raiz)
- **Dia 17:** ListingsDashboard + ListingsTable
- **Dia 18:** OptimizeFlow + streaming UI
- **Dia 19:** CreateWizard (4 steps)
- **Dia 20:** Integração em /agente (nova tab)

### Sprint 5: Polish & Deploy (Dias 21-23)
- **Dia 21:** Testes E2E + ajustes UX
- **Dia 22:** QA completo + documentação
- **Dia 23:** Deploy produção + monitoramento

---

## ✅ CHECKLIST PRODUCTION-READY

### Técnico
- [ ] TypeScript strict mode (zero any's)
- [ ] Error boundaries React
- [ ] Try-catch em todas APIs
- [ ] Rate limiting testado (zero 429)
- [ ] WebSocket reconnection automática
- [ ] Prisma migrations testadas
- [ ] Audit logs completos
- [ ] Input sanitization (XSS)
- [ ] Multi-tenant isolation
- [ ] Token encryption AES-256-GCM

### UX/UI
- [ ] Mobile-first (testado 320px+)
- [ ] iOS PWA safe areas
- [ ] Loading states (skeletons)
- [ ] Error states (mensagens claras)
- [ ] Streaming visual (progresso real)
- [ ] Animações suaves (framer-motion)
- [ ] Feedback imediato (optimistic UI)
- [ ] Acessibilidade (ARIA)

### Negócio
- [ ] Compliance ML 100%
- [ ] Dados 100% reais (não mocks)
- [ ] ROI calculado corretamente
- [ ] WhatsApp notifications
- [ ] Analytics tracking
- [ ] Custo Claude monitorado

---

## 🎯 DELIVERABLES

### MVP (Dia 12)
✅ Análise de 1 produto com Claude
✅ 5 APIs principais (search, highlights, competition, quality, reviews)
✅ WebSocket real-time
✅ Dashboard básico

### Feature Completa (Dia 20)
✅ 13 APIs ML integradas via MCP
✅ 2 fluxos (otimizar + criar)
✅ Multi-conta
✅ Streaming UI
✅ Compliance 100%

### Production (Dia 23)
✅ Testes E2E passing
✅ Zero bugs críticos
✅ Documentação completa
✅ Monitoramento ativo
✅ Deploy produção

---

## 💰 ESTIMATIVA DE CUSTOS

### Claude API (Sonnet 4.5)
- Input: $3 / 1M tokens
- Output: $15 / 1M tokens

**Por Análise:**
- Input: ~8k tokens × $3 = $0.024
- Output: ~4k tokens × $15 = $0.060
- **Total: ~$0.084 por análise**

**Com 100 análises/mês:**
- Custo: $8.40/mês
- Revenue (se cobrar R$ 79/mês): R$ 7.900
- **Margem: 99.5%**

---

## 🔥 DIFERENCIAIS COMPETITIVOS

1. **Único com MCP Server ML**: Nenhum concorrente tem
2. **13 APIs integradas**: Análise holística completa
3. **Claude Sonnet 4.5**: Modelo mais avançado (setembro 2025)
4. **WebSocket Real-Time**: Feedback instantâneo
5. **Multi-Conta Nativo**: Gerencia todas contas juntas
6. **ROI Numérico**: Não genérico, calculado com dados reais
7. **Compliance 100%**: Zero risco de bloqueio ML
8. **Production-Ready**: Pode lançar dia 1

---

## 📞 SUPORTE & MANUTENÇÃO

### Monitoramento
- Rate limit usage (alertar se > 80%)
- Claude API costs (budget alert)
- Error rate (< 1%)
- Response time (< 60s análise)

### Logs
```typescript
// Audit log cada ação
- intelligence.started
- intelligence.ml_api.{tool}
- intelligence.claude.analysis
- listing.created
- listing.published
```

---

**FIM DO PLANO**

**Aprovação:** Aguardando confirmação para iniciar implementação
**Estimativa:** 23 dias úteis
**Recursos:** 1 dev full-time
**Risco:** Baixo (módulo isolado)
**ROI Esperado:** +300% valor percebido da plataforma
