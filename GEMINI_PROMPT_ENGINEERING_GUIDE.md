# Guia Completo de Prompt Engineering para Google Gemini (Nov 2025)

**Data:** Novembro 2025
**Modelo:** Gemini 3 Pro Preview / Gemini 2.5 Pro
**Aplicação:** Atendimento ao Cliente em Marketplace (Mercado Livre)

---

## Índice

1. [Google Official Guides](#1-google-official-guides)
2. [Best Practices 2025](#2-best-practices-2025-gemini-3-pro)
3. [Structured Output](#3-structured-output-nativo)
4. [Few-Shot Examples](#4-few-shot-learning)
5. [Thinking Level](#5-thinking-level-parameter)
6. [Response Formatting](#6-response-formatting)
7. [Context Optimization](#7-context-optimization)
8. [Multimodal Prompts](#8-multimodal-prompts)
9. [System Instructions](#9-system-instructions)
10. [Temperature & Parameters](#10-temperature-parameters)
11. [Casos de Uso Práticos](#11-casos-de-uso-práticos-marketplace)

---

## 1. Google Official Guides

### Recursos Oficiais Principais (2025)

**Documentação Core:**
- [Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies) - Guia oficial de prompt engineering
- [Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output) - Garantia de formato JSON
- [Thinking Level](https://ai.google.dev/gemini-api/docs/thinking) - Controle de raciocínio (Gemini 3)
- [Long Context](https://ai.google.dev/gemini-api/docs/long-context) - Otimização de contexto longo

**SDKs Oficiais:**
- Python: `google-genai`
- JavaScript/TypeScript: `@google/genai`

**Workspace Guide:**
- [Gemini for Google Workspace Prompt Guide](https://workspace.google.com/learning/content/gemini-prompt-guide) (Outubro 2024)

---

## 2. Best Practices 2025 (Gemini 3 Pro)

### Princípios Fundamentais

#### 1. Seja Preciso e Direto
```
❌ EVITE: Prompts persuasivos ou excessivamente verbosos
✅ USE: Instruções claras e concisas

Errado: "Você poderia, por favor, se não for muito incômodo, talvez considerar..."
Certo: "Analise esta pergunta do cliente e extraia: produto, problema, urgência."
```

#### 2. Use Estrutura Consistente
```xml
<!-- RECOMENDADO: Tags XML -->
<role>Você é um assistente de atendimento ao cliente especializado em e-commerce</role>
<constraints>
1. Responda sempre em português brasileiro
2. Seja empático e profissional
3. Forneça soluções práticas
</constraints>
<task>Analise a seguinte pergunta do cliente e gere uma resposta adequada</task>
<question>{{customer_question}}</question>
```

```markdown
# ALTERNATIVA: Markdown Headers
## Papel
Assistente de atendimento ao cliente

## Restrições
- Português brasileiro
- Tom empático e profissional
- Soluções práticas

## Tarefa
Analise e responda a pergunta do cliente
```

#### 3. Coloque Instruções Críticas no Início ou Fim

**Para contextos curtos (< 50k tokens):** Instruções no início
**Para contextos longos (> 50k tokens):** Dados primeiro, instruções no final

```
ESTRUTURA LONGA:
[Grande contexto: histórico de conversas, dados do produto, políticas]

--- INSTRUÇÕES ---
Com base nas informações acima, gere uma resposta que:
1. Seja empática
2. Cite políticas relevantes
3. Ofereça solução concreta
```

#### 4. Explicite Termos Ambíguos

```
❌ Ambíguo: "Responda rapidamente"
✅ Explícito: "Responda em até 280 caracteres"

❌ Ambíguo: "Seja completo"
✅ Explícito: "Inclua: 1) Causa do problema, 2) Solução step-by-step, 3) Tempo estimado"
```

#### 5. Peça Explicitamente por Respostas Detalhadas

**IMPORTANTE:** Gemini 3 é otimizado para respostas diretas e eficientes por padrão.

```
Se você precisa de resposta conversacional ou detalhada:
"Forneça uma resposta detalhada e conversacional que..."

Se você precisa de resposta curta:
"Forneça uma resposta direta em até 2 frases."
```

---

## 3. Structured Output Nativo

### Garantia de Formato JSON (Nov 2025)

Gemini agora suporta **JSON Schema nativo** com garantia de formato válido.

### Novidades (2025)

- ✅ Suporte completo a JSON Schema em todos os modelos ativos
- ✅ Preservação da ordem de propriedades (Gemini 2.5+)
- ✅ Integração nativa com Zod (TypeScript) e Pydantic (Python)
- ✅ Suporte a `anyOf`, `$ref`, enums, e mais

### Implementação TypeScript/JavaScript

```typescript
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// 1. Defina o schema Zod
const customerAnalysisSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative", "urgent"]),
  category: z.enum([
    "shipping",
    "payment",
    "product_defect",
    "cancellation",
    "general_inquiry"
  ]),
  urgencyLevel: z.number().min(1).max(5).describe("1=baixa, 5=crítica"),
  suggestedResponse: z.string().describe("Resposta sugerida em português"),
  requiresHumanReview: z.boolean(),
  extractedData: z.object({
    orderNumber: z.string().nullable(),
    productName: z.string().nullable(),
    issue: z.string()
  })
});

// 2. Use com Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-3-pro-preview", // ou "gemini-2.5-flash"
  contents: `
    <role>Analista de atendimento ao cliente</role>
    <task>Analise a pergunta do cliente e extraia informações estruturadas</task>
    <question>
    Comprei um celular há 3 dias (#ML123456) e chegou com a tela rachada!
    Preciso de reembolso URGENTE!
    </question>
  `,
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: zodToJsonSchema(customerAnalysisSchema),
  },
});

// 3. Parse seguro
const analysis = customerAnalysisSchema.parse(JSON.parse(response.text));

// Resultado garantido:
// {
//   sentiment: "negative",
//   category: "product_defect",
//   urgencyLevel: 5,
//   suggestedResponse: "Olá! Lamento muito pelo inconveniente...",
//   requiresHumanReview: true,
//   extractedData: {
//     orderNumber: "ML123456",
//     productName: "celular",
//     issue: "tela rachada"
//   }
// }
```

### Schema Best Practices

```typescript
// ✅ BOM: Descrições claras
z.object({
  sentiment: z.enum(["positive", "negative", "neutral"])
    .describe("Sentimento extraído da mensagem do cliente"),
  priority: z.number().min(1).max(3)
    .describe("1=baixa, 2=média, 3=alta"),
})

// ✅ BOM: Tipos específicos
z.string().email()
z.string().datetime()
z.number().int().positive()

// ✅ BOM: Enums para valores limitados
z.enum(["shipping", "payment", "product"])

// ❌ EVITE: Schemas vagos sem descrição
z.object({
  data: z.any()
})
```

### Importante: Validação Semântica

```typescript
// Gemini garante JSON VÁLIDO, mas NÃO garante valores CORRETOS

const response = JSON.parse(geminiResponse.text);

// ✅ Sempre valide business logic
if (response.urgencyLevel === 5 && !response.requiresHumanReview) {
  // ERRO: Urgência crítica deveria exigir revisão humana
  response.requiresHumanReview = true;
}

if (response.orderNumber && !response.orderNumber.startsWith("ML")) {
  // ERRO: Formato inválido de pedido do Mercado Livre
  throw new Error("Invalid order number format");
}
```

---

## 4. Few-Shot Learning

### Quando Usar Few-Shot

**Google recomenda:** "Sempre inclua few-shot examples em seus prompts quando possível."

✅ **USE few-shot para:**
- Formatos de resposta específicos
- Estilos de linguagem particulares
- Classificações com categorias customizadas
- Extração de dados com padrões complexos

❌ **NÃO USE few-shot para:**
- Tarefas muito simples (classificação binária óbvia)
- Quando você tem mais de 10 exemplos (risco de overfitting)

### Número Ideal de Exemplos

```
Tarefas Simples: 2-3 exemplos
Tarefas Médias: 3-5 exemplos
Tarefas Complexas: 5-8 exemplos

⚠️ Mais de 10 exemplos = Risco de overfitting
```

### Estrutura Recomendada

```xml
<examples>
<example>
<input>Cliente pergunta: "Meu pedido ainda não chegou, já faz 5 dias!"</input>
<output>
{
  "categoria": "atraso_entrega",
  "sentimento": "frustrado",
  "urgencia": 4,
  "resposta": "Olá! Entendo sua preocupação. Vou verificar o status da sua entrega imediatamente. Pode me fornecer o número do pedido?"
}
</output>
</example>

<example>
<input>Cliente pergunta: "Como faço para devolver um produto?"</input>
<output>
{
  "categoria": "devolucao",
  "sentimento": "neutro",
  "urgencia": 2,
  "resposta": "Claro! Para solicitar devolução, acesse 'Meus Pedidos' > selecione o item > 'Devolver produto'. O prazo é de 30 dias após o recebimento."
}
</output>
</example>

<example>
<input>Cliente pergunta: "PRODUTO VEIO ERRADO!!! QUERO MEU DINHEIRO DE VOLTA AGORA!"</input>
<output>
{
  "categoria": "produto_errado",
  "sentimento": "irritado",
  "urgencia": 5,
  "resposta": "Lamento muito pelo erro! Vamos resolver isso com prioridade. Para agilizar o reembolso, preciso do número do pedido e uma foto do produto recebido."
}
</output>
</example>
</examples>

<task>
Agora analise a seguinte pergunta usando o mesmo formato:
<input>{{nova_pergunta_do_cliente}}</input>
</task>
```

### Case Real: Breakthrough Gemini (2025)

**Nature Astronomy publicou:** Gemini atingiu 93% de precisão classificando eventos cósmicos com apenas **15 exemplos anotados** por survey, usando few-shot learning.

**Lições aplicáveis:**
- Qualidade > Quantidade de exemplos
- Exemplos diversos cobrem mais edge cases
- Descrições curtas e claras funcionam melhor

### Anti-Patterns (Evite)

```
❌ ERRADO: Mostrar exemplos do que NÃO fazer
Exemplo: "Não responda assim: [resposta ruim]"

✅ CERTO: Mostrar apenas exemplos POSITIVOS
Exemplo: "Responda assim: [resposta boa]"

❌ ERRADO: Exemplos inconsistentes
Exemplo 1: Formato JSON
Exemplo 2: Formato texto plano
Exemplo 3: Formato XML

✅ CERTO: Formato consistente em TODOS os exemplos
```

---

## 5. Thinking Level Parameter

### Novo no Gemini 3 Pro Preview

O parâmetro `thinkingLevel` controla a quantidade de raciocínio interno que o modelo realiza.

**Valores:** `"low"` ou `"high"`
**Default:** `"high"` (se não especificado)

### Quando Usar Cada Nível

#### Low Thinking (Baixo Raciocínio)

**Use para:**
- Recuperação de fatos simples
- Classificação básica
- Tarefas diretas sem múltiplos passos
- Alta vazão (throughput)

**Vantagens:**
- ⚡ Menor latência
- 💰 Menor custo
- 🎯 Qualidade comparável ao Gemini 2.5 Flash (mas superior)

**Exemplos:**
```typescript
// Detecção de intenção simples
config: {
  thinkingConfig: {
    thinkingLevel: "low"
  }
}
// Prompt: "Esta mensagem é uma reclamação? Responda apenas sim ou não."
```

#### High Thinking (Alto Raciocínio)

**Use para:**
- Problemas matemáticos complexos
- Debugging de código
- Análise multi-step
- Planejamento estratégico
- Tarefas que exigem raciocínio profundo

**Vantagens:**
- 🧠 Raciocínio mais profundo
- 🎯 Maior precisão em tarefas complexas
- 🔍 Melhor identificação de bugs

**Exemplos:**
```typescript
// Análise complexa de sentimento + geração de resposta personalizada
config: {
  thinkingConfig: {
    thinkingLevel: "high"
  }
}
// Prompt: "Analise o histórico completo de interações do cliente,
// identifique padrões de comportamento, e gere uma resposta que
// resolva o problema atual considerando o contexto histórico."
```

### Implementação TypeScript

```typescript
import { GoogleGenAI } from "@google/genai";
import { types } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Tarefa SIMPLES - Use LOW
const simpleResponse = await client.models.generateContent({
  model: "gemini-3-pro-preview",
  contents: "Qual é a categoria desta pergunta: 'Como rastrear meu pedido?'",
  config: {
    thinkingConfig: {
      thinkingLevel: "low"
    }
  }
});

// Tarefa COMPLEXA - Use HIGH
const complexResponse = await client.models.generateContent({
  model: "gemini-3-pro-preview",
  contents: `
    Analise estas 50 interações do cliente, identifique:
    1. Padrões de reclamação recorrentes
    2. Produtos com maior taxa de defeito
    3. Horários de pico de atendimento
    4. Sugestões de melhorias no processo
  `,
  config: {
    thinkingConfig: {
      thinkingLevel: "high"
    }
  }
});
```

### Importante: Chain of Thought

```
⚠️ AVISO: PARE de usar "Chain of Thought" manual no Gemini 3!

❌ ANTES (Gemini 1.5/2.5):
"Pense passo a passo:
1. Primeiro analise X
2. Depois considere Y
3. Finalmente conclua Z"

✅ AGORA (Gemini 3):
Apenas use thinkingLevel: "high"
O modelo gerencia CoT automaticamente de forma otimizada.
```

### Gemini 2.5 vs Gemini 3

```typescript
// Gemini 2.5: Usa thinkingBudget
config: {
  thinkingBudget: 1024 // tokens para raciocínio
}

// Gemini 3: Usa thinkingLevel
config: {
  thinkingConfig: {
    thinkingLevel: "high" // ou "low"
  }
}
```

---

## 6. Response Formatting

### Técnicas para Garantir Formato Específico

#### 1. Structured Output (MELHOR OPÇÃO - 2025)

```typescript
// ✅ MÉTODO RECOMENDADO: JSON Schema nativo
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: zodToJsonSchema(schema),
  },
});
// GARANTIA: JSON sintáticamente válido 100%
```

#### 2. Response MIME Type

```typescript
// Garante JSON válido sem schema rígido
config: {
  responseMimeType: "application/json"
}

// Garante texto plano
config: {
  responseMimeType: "text/plain"
}
```

#### 3. Prompt-Based Formatting (Fallback)

```xml
<format>
Forneça a resposta EXATAMENTE neste formato JSON:
{
  "categoria": "string",
  "resposta": "string",
  "confianca": number
}

NÃO inclua texto adicional fora do JSON.
NÃO use markdown code blocks.
APENAS o objeto JSON puro.
</format>
```

### Formatação de Tabelas e Listas

```typescript
// Gemini 2.5 Flash (Set 2025): Melhorias em formatação
// Usa automaticamente headers, listas e tabelas quando apropriado

const prompt = `
Liste os 5 principais problemas reportados pelos clientes esta semana.
Formate como tabela Markdown com colunas: Problema | Frequência | Urgência Média
`;

// Resultado automático:
// | Problema | Frequência | Urgência Média |
// |----------|------------|----------------|
// | Atraso na entrega | 45 | 4.2 |
// | Produto defeituoso | 32 | 4.8 |
// ...
```

### Controle de Propriedades (Property Ordering)

```typescript
// Gemini 2.5+ preserva a ordem do schema

const schema = {
  type: "object",
  properties: {
    nome: { type: "string" },      // Sempre primeiro
    email: { type: "string" },     // Sempre segundo
    telefone: { type: "string" }   // Sempre terceiro
  }
};

// ✅ Resposta manterá esta ordem
// ❌ Gemini 2.0 pode reordenar propriedades
```

---

## 7. Context Optimization

### Long Context Window (2025)

**Gemini 1.5 Pro:** 2 milhões de tokens
**Gemini 2.5 Pro:** 1 milhão de tokens (beta)
**Gemini 3 Pro Preview:** 1 milhão de tokens

### Estratégias de Otimização

#### 1. Context Caching (CRÍTICO para produção)

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. Crie o contexto em cache
const cachedContent = await ai.caches.create({
  model: "gemini-1.5-flash",
  contents: [
    {
      role: "user",
      parts: [
        { text: "Você é um assistente de atendimento ao cliente." },
        { text: "POLÍTICAS DA EMPRESA:\n[Grande documento de 100k tokens]" },
        { text: "HISTÓRICO DE PRODUTOS:\n[Catálogo de 50k tokens]" },
      ]
    }
  ],
  ttl: "3600s", // Cache válido por 1 hora
  displayName: "customer-service-context"
});

// 2. Use o cache em múltiplas requisições
const response1 = await ai.models.generateContent({
  model: "gemini-1.5-flash",
  contents: "Cliente pergunta sobre política de troca",
  cachedContent: cachedContent.name,
});

const response2 = await ai.models.generateContent({
  model: "gemini-1.5-flash",
  contents: "Cliente pergunta sobre garantia",
  cachedContent: cachedContent.name, // MESMO cache
});

// 💰 ECONOMIA: ~4x mais barato com cache!
// Input sem cache: $2.00/milhão tokens
// Input com cache: $0.50/milhão tokens
```

**Quando usar Context Caching:**
- ✅ Documentos de políticas que raramente mudam
- ✅ Catálogos de produtos
- ✅ FAQs extensos
- ✅ Históricos de conversas longas
- ❌ Dados que mudam a cada requisição

#### 2. Prompt Organization para Long Context

```typescript
// ESTRUTURA OTIMIZADA:

// Para contextos < 50k tokens:
const promptShort = `
  [INSTRUÇÕES E SISTEMA NO INÍCIO]

  [DADOS/CONTEXTO]

  [PERGUNTA ESPECÍFICA NO FINAL]
`;

// Para contextos > 50k tokens:
const promptLong = `
  [GRANDES BLOCOS DE DADOS PRIMEIRO]

  --- TRANSIÇÃO CLARA ---
  Com base nas informações acima...

  [INSTRUÇÕES ESPECÍFICAS NO FINAL]
  [PERGUNTA/TAREFA]
`;
```

#### 3. URL Context Integration (Ago 2025)

```typescript
// Novo recurso: Ingestão de conteúdo web/PDF

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    { text: "Analise este manual do produto:" },
    {
      url: "https://example.com/manual-produto.pdf"
      // Gemini baixa e processa até 10MB
    },
    { text: "Qual é o procedimento de devolução?" }
  ]
});
```

#### 4. Recall Performance

**Gemini 2.5 Pro Recall:**
- Até 530k tokens: **100% de recall**
- 1 milhão tokens: **>99.7% de recall**

**Implicação prática:**
```typescript
// ✅ Seguro: Contexto de até 500k tokens
// Informações críticas são recuperadas com 100% de confiança

// ⚠️ Cuidado: Contexto > 500k tokens
// Adicione redundância para dados críticos
const prompt = `
  [Contexto extenso de 800k tokens]

  --- INFORMAÇÕES CRÍTICAS (REPETIDAS) ---
  Política de reembolso: 30 dias para produtos novos
  Prazo de entrega: 5-7 dias úteis
  --- FIM DAS INFORMAÇÕES CRÍTICAS ---

  [Tarefa usando essas informações]
`;
```

### Framework PTCF (Persona · Task · Context · Format)

```typescript
// Estrutura recomendada pelo Google Workspace

const prompt = `
  --- PERSONA ---
  Você é um especialista em atendimento ao cliente do Mercado Livre
  com 10 anos de experiência. Seu estilo é empático, profissional e solucionador.

  --- TASK ---
  Analise a reclamação do cliente e gere uma resposta que:
  1. Demonstre empatia
  2. Explique a causa do problema
  3. Ofereça solução concreta com passos
  4. Forneça prazo estimado

  --- CONTEXT ---
  Cliente: João Silva
  Pedido: ML123456
  Problema: Produto não chegou (prazo: 7 dias, atual: 10 dias)
  Histórico: Primeira reclamação deste cliente
  Status rastreio: "Em trânsito" há 5 dias

  --- FORMAT ---
  Responda em formato JSON:
  {
    "resposta": "texto da resposta",
    "acoes": ["ação 1", "ação 2"],
    "prazo_estimado": "string",
    "escalacao_necessaria": boolean
  }
`;
```

---

## 8. Multimodal Prompts

### Text + Image Best Practices (2025)

Gemini aceita múltiplos formatos: **texto, imagens, áudio, vídeo**

**Capacidades:**
- Gemini 2.0 Flash: até **3.600 imagens** por prompt
- Limite de entrada: **1 milhão de tokens** incluindo mídia

### Técnicas Fundamentais

#### 1. Classificação e Detecção

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    { text: "Esta imagem mostra um produto defeituoso? Responda apenas sim ou não." },
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64ImageData
      }
    }
  ]
});
```

#### 2. Reconhecimento Aberto

```typescript
// Não pergunte sobre objetos específicos - deixe o modelo descobrir
const prompt = `
  Liste TODOS os elementos significativos visíveis nesta imagem de produto.
  Identifique:
  - Condição do produto (novo/usado/danificado)
  - Acessórios incluídos
  - Sinais de uso ou defeitos
  - Compatibilidade da embalagem
`;
```

#### 3. Contagem e Quantificação

```typescript
const prompt = `
  Conte quantos itens desta categoria estão visíveis na imagem.

  ⚠️ IMPORTANTE: Especifique formato de resposta

  Forneça a contagem exata em formato JSON:
  {
    "categoria": "string",
    "quantidade": number,
    "confianca": "alta" | "média" | "baixa"
  }

  NOTA: A precisão diminui com quantidades > 20 itens
`;
```

#### 4. Extração de Texto (OCR) + Raciocínio

```typescript
// Gemini lê texto manuscrito E faz cálculos
const prompt = `
  1. Leia o texto manuscrito nesta nota de compra
  2. Identifique todos os valores numéricos
  3. Calcule o total
  4. Verifique se o total está correto

  Formate a resposta como:
  {
    "itens_extraídos": [{nome: string, valor: number}],
    "total_calculado": number,
    "total_declarado": number,
    "discrepância": boolean
  }
`;
```

#### 5. Inferência Contextual

```typescript
// Gemini infere contexto temporal e ambiental
const prompt = `
  Analise esta foto do produto recebido pelo cliente.

  Determine:
  1. Condição da embalagem (intacta/danificada)
  2. Ambiente onde está (residencial/comercial)
  3. Iluminação (natural/artificial) - indica horário aproximado
  4. Sinais de manuseio inadequado durante transporte

  Use estas informações para avaliar se o dano ocorreu:
  - Durante o transporte
  - Após a entrega
  - Antes do envio (defeito de fábrica)
`;
```

#### 6. Comparação Multi-Imagem

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    { text: "Compare estas duas imagens:" },
    { text: "IMAGEM 1: Produto anunciado" },
    { inlineData: { mimeType: "image/jpeg", data: imageAnuncio } },
    { text: "IMAGEM 2: Produto recebido pelo cliente" },
    { inlineData: { mimeType: "image/jpeg", data: imageRecebida } },
    { text: `
      Identifique TODAS as diferenças entre as imagens.
      Classifique cada diferença como:
      - "critica" (produto diferente)
      - "menor" (variação aceitável)
      - "cosmetica" (apenas estética)

      Formate como JSON array:
      [
        {
          "diferenca": "descrição",
          "gravidade": "critica|menor|cosmetica",
          "justifica_devolucao": boolean
        }
      ]
    `}
  ]
});
```

### Configuração de Temperatura para Multimodal

```typescript
// Para análise precisa de imagens: temperatura baixa
config: {
  temperature: 0.4, // Análise objetiva
}

// Para interpretação criativa: temperatura média-alta
config: {
  temperature: 1.0, // Descrições mais ricas
}
```

### Anti-Patterns

```
❌ EVITE: Prompts vagos
"Descreva esta imagem"

✅ USE: Prompts específicos
"Identifique defeitos visíveis neste produto eletrônico, focando em: tela, botões, portas de conexão, acabamento"

❌ EVITE: Assumir que o modelo vê detalhes minúsculos
"Leia o texto de 6pt nesta etiqueta"

✅ USE: Peça para o modelo indicar confiança
"Se conseguir ler a etiqueta, transcreva o texto. Caso contrário, indique 'ilegível'"
```

---

## 9. System Instructions

### O Que São System Instructions

**System Instructions** são processadas ANTES de qualquer prompt do usuário, definindo comportamento global do modelo.

**Use para:**
- ✅ Definir persona/papel (chatbot, assistente, etc)
- ✅ Definir objetivos e regras da tarefa
- ✅ Fornecer contexto adicional persistente
- ✅ Especificar idioma de resposta padrão

### Estrutura Recomendada

```typescript
const systemInstruction = `
  === IDENTIDADE ===
  Você é um assistente de atendimento ao cliente do Mercado Livre.
  Nome: ML Assistant
  Especialização: Resolução de problemas em marketplace

  === OBJETIVOS ===
  1. Resolver problemas do cliente de forma eficiente
  2. Manter tom empático e profissional sempre
  3. Citar políticas oficiais quando relevante
  4. Escalar para humano quando necessário

  === REGRAS OBRIGATÓRIAS ===
  - SEMPRE responda em português brasileiro
  - NUNCA invente informações sobre pedidos ou políticas
  - SEMPRE peça número do pedido quando necessário
  - NUNCA prometa prazos que você não pode garantir

  === CONTEXTO PERSISTENTE ===
  Políticas principais:
  - Devolução: 30 dias para produtos novos
  - Reembolso: 5-10 dias úteis após aprovação
  - Garantia: 90 dias para defeitos de fábrica

  === FORMATO DE RESPOSTA PADRÃO ===
  Todas as respostas devem ser em JSON:
  {
    "mensagem": "resposta ao cliente",
    "acao_sugerida": "próximo passo",
    "requer_escalacao": boolean
  }
`;

const model = await ai.models.generateContent({
  model: "gemini-1.5-pro",
  systemInstruction: systemInstruction,
  contents: "Cliente: Quero devolver um produto"
});
```

### Exemplos de Personas

#### Assistente Formal e Objetivo

```typescript
systemInstruction: `
  Você é um assistente profissional de pesquisa.

  Tom: Formal e objetivo
  Estilo: Todas as afirmações devem ser suportadas por evidências
  Restrição: Nunca expresse opiniões pessoais
  Formato: Use linguagem técnica apropriada
`
```

#### Assistente Amigável e Conversacional

```typescript
systemInstruction: `
  Você é um agente de atendimento ao cliente amigável e prestativo.

  Tom: Sempre paciente e empático
  Estilo: Parágrafos curtos e diretos
  Personalidade: Adore compartilhar dicas úteis
  Objetivo: Fazer o cliente se sentir ouvido e valorizado
`
```

#### Assistente Especializado (E-commerce)

```typescript
systemInstruction: `
  === PAPEL ===
  Especialista em atendimento ao cliente de marketplace (Mercado Livre)

  === EXPERTISE ===
  - 10 anos de experiência em e-commerce
  - Conhecimento profundo de logística, pagamentos e políticas
  - Habilidade em resolução de conflitos

  === METODOLOGIA ===
  1. ESCUTE: Identifique o problema real (não apenas o sintoma)
  2. EMPATIE: Reconheça a frustração do cliente
  3. SOLUCIONE: Ofereça solução concreta com passos claros
  4. ACOMPANHE: Forneça forma de rastreamento/follow-up

  === RESTRIÇÕES ===
  - Não tome decisões financeiras acima de R$ 500 sem aprovação
  - Não prometa prazos de entrega - forneça estimativas
  - Não acesse dados de pagamento - apenas confirme se pagamento foi processado

  === ESCALAÇÃO ===
  Escale para supervisor humano quando:
  - Cliente solicitar explicitamente
  - Problema envolve valores > R$ 500
  - Cliente demonstrar extrema insatisfação (ameaça legal, etc)
  - Situação não tem solução padrão nas políticas
`
```

### System Instruction vs User Prompt

```typescript
// ❌ ERRADO: Repetir instruções em cada prompt
const prompt1 = "Você é um assistente. Responda em português. Seja empático. [pergunta]";
const prompt2 = "Você é um assistente. Responda em português. Seja empático. [pergunta]";

// ✅ CERTO: System instruction uma vez + prompts limpos
systemInstruction: "Você é um assistente. Responda em português. Seja empático.",
prompts: [
  "Como rastrear meu pedido?",
  "Qual é a política de devolução?"
]
```

### Context Rot (Evite)

```
⚠️ PROBLEMA: System instructions muito longas confundem o modelo

❌ System Instruction de 5000 linhas:
- Centenas de regras
- Políticas completas
- Exemplos extensos
→ Resultado: Modelo não segue instruções corretamente

✅ System Instruction concisa (< 500 linhas):
- Papel e objetivos claros
- Regras essenciais (top 10)
- Referência a documentos externos
→ Resultado: Modelo performa bem
```

### Customização com Variáveis de Ambiente

```typescript
// Gemini CLI: Variável GEMINI_SYSTEM_MD
process.env.GEMINI_SYSTEM_MD = "/path/to/custom-system-instruction.md";

// Permite trocar system instructions por projeto/cliente
```

---

## 10. Temperature & Parameters

### Temperature (Controle de Aleatoriedade)

**Range:** 0.0 a 2.0
**Default:** 1.0

#### 🚨 IMPORTANTE: Gemini 3 Pro

```
⚠️ AVISO CRÍTICO (Gemini 3):
MANTENHA temperature = 1.0 (padrão)

Alterar temperatura em Gemini 3 pode causar:
- Looping infinito
- Degradação de performance
- Problemas em tarefas matemáticas/raciocínio

Esta recomendação é ESPECÍFICA do Gemini 3.
Para Gemini 2.5 e anteriores, ajuste normalmente.
```

#### Temperature por Caso de Uso (Gemini 2.5 e anteriores)

```typescript
// DETERMINÍSTICO (temperatura baixa)
// Use para: Raciocínio técnico, classificação, extração de dados

config: { temperature: 0.2 }
// Casos: Debugging código, documentação técnica, análise de dados

config: { temperature: 0.4 }
// Casos: Resumos, atendimento ao cliente padrão

// BALANCEADO (temperatura média)

config: { temperature: 0.7 }
// Casos: Conversação geral, recomendações

config: { temperature: 0.9 }
// Casos: Geração de conteúdo variado

// CRIATIVO (temperatura alta)

config: { temperature: 1.2 }
// Casos: Brainstorming, nomes criativos, marketing

config: { temperature: 1.5 }
// Casos: Geração de imagens, vídeo, música

config: { temperature: 2.0 }
// Casos: Máxima criatividade e diversidade
```

### Top-K e Top-P (Nucleus Sampling)

#### Top-K

**O que é:** Limita seleção aos K tokens mais prováveis

```typescript
config: { topK: 1 }
// Sempre escolhe o token MAIS provável (determinístico)

config: { topK: 40 }
// Considera os 40 tokens mais prováveis (padrão comum)
```

#### Top-P (Nucleus Sampling)

**O que é:** Seleciona tokens cuja probabilidade cumulativa = P

```typescript
config: { topP: 0.1 }
// Muito determinístico (apenas tokens muito prováveis)

config: { topP: 0.9 }
// Balanceado (padrão recomendado)

config: { topP: 1.0 }
// Considera todos os tokens possíveis
```

### Max Output Tokens

```typescript
config: { maxOutputTokens: 2048 }
// Controla tamanho máximo da resposta

// Estimativa: ~4 caracteres por token
// 2048 tokens ≈ 8000 caracteres
```

### Stop Sequences

```typescript
config: {
  stopSequences: ["---END---", "\n\nFIM"]
}
// Para geração ao encontrar estas strings

// Útil para controlar formato:
const prompt = `
  Gere uma resposta ao cliente.
  Termine com "---END---" quando concluir.
`;
```

### Configurações Recomendadas por Tarefa

#### Atendimento ao Cliente (Padrão)

```typescript
const customerServiceConfig = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 1024,
};
```

#### Classificação/Extração (Determinístico)

```typescript
const classificationConfig = {
  temperature: 0.2,
  topP: 0.8,
  topK: 10,
  maxOutputTokens: 512,
};
```

#### Geração Criativa

```typescript
const creativeConfig = {
  temperature: 1.2,
  topP: 0.95,
  topK: 60,
  maxOutputTokens: 2048,
};
```

#### Análise Técnica/Debugging

```typescript
const technicalConfig = {
  temperature: 0.3,
  topP: 0.85,
  topK: 20,
  maxOutputTokens: 4096,
};
```

---

## 11. Casos de Uso Práticos (Marketplace)

### Caso 1: Análise Automática de Perguntas

```typescript
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// 1. Schema
const questionAnalysisSchema = z.object({
  category: z.enum([
    "shipping_tracking",
    "payment_issue",
    "product_defect",
    "return_request",
    "cancellation",
    "general_inquiry",
    "product_info"
  ]),
  sentiment: z.enum(["positive", "neutral", "negative", "urgent"]),
  urgencyLevel: z.number().min(1).max(5),
  requiresHumanReview: z.boolean(),
  suggestedResponse: z.string(),
  extractedData: z.object({
    orderNumber: z.string().nullable(),
    productMentioned: z.string().nullable(),
    timeframeMentioned: z.string().nullable(),
  }),
  tags: z.array(z.string()),
  autoApprovalSafe: z.boolean().describe(
    "True se a resposta sugerida pode ser enviada automaticamente sem revisão"
  )
});

// 2. System Instruction
const systemInstruction = `
  === PAPEL ===
  Você é um analisador de perguntas de clientes do Mercado Livre.

  === OBJETIVO ===
  Analisar perguntas de clientes e gerar respostas apropriadas.

  === REGRAS ===
  - SEMPRE classifique a urgência corretamente
  - Marque requiresHumanReview=true para casos sensíveis:
    * Reclamações graves
    * Pedidos de reembolso
    * Ameaças legais
    * Valores acima de R$ 500
  - Marque autoApprovalSafe=true APENAS para:
    * Perguntas sobre rastreamento simples
    * Informações de produtos padrão
    * FAQs comuns

  === CONTEXTO ===
  Políticas:
  - Prazo de entrega: 5-7 dias úteis
  - Devolução: 30 dias para produtos novos
  - Garantia: 90 dias defeito de fábrica
  - Reembolso: 5-10 dias úteis após aprovação

  === TOM DA RESPOSTA ===
  - Sempre empático e profissional
  - Use português brasileiro
  - Seja conciso mas completo
  - Termine oferecendo ajuda adicional
`;

// 3. Few-Shot Examples
const fewShotExamples = `
<examples>
<example>
<input>Meu pedido #ML789456 ainda não chegou, já passou 10 dias!</input>
<output>
{
  "category": "shipping_tracking",
  "sentiment": "negative",
  "urgencyLevel": 4,
  "requiresHumanReview": false,
  "suggestedResponse": "Olá! Entendo sua preocupação. Verifiquei e seu pedido #ML789456 está em trânsito. O prazo normal é de 5-7 dias úteis, mas pode haver atrasos pontuais. Vou solicitar atualização do rastreamento agora mesmo. Você pode acompanhar em tempo real pelo app. Precisa de mais alguma ajuda?",
  "extractedData": {
    "orderNumber": "ML789456",
    "productMentioned": null,
    "timeframeMentioned": "10 dias"
  },
  "tags": ["atraso", "rastreamento", "reclamacao"],
  "autoApprovalSafe": true
}
</output>
</example>

<example>
<input>Como funciona a garantia?</input>
<output>
{
  "category": "general_inquiry",
  "sentiment": "neutral",
  "urgencyLevel": 1,
  "requiresHumanReview": false,
  "suggestedResponse": "Olá! Todos os produtos têm garantia de 90 dias contra defeitos de fábrica, conforme o Código de Defesa do Consumidor. Além disso, você tem 30 dias para devolver produtos novos caso não fique satisfeito. Para acionar a garantia, basta acessar 'Meus Pedidos' > selecionar o produto > 'Solicitar Garantia'. Posso ajudar com mais alguma dúvida?",
  "extractedData": {
    "orderNumber": null,
    "productMentioned": null,
    "timeframeMentioned": null
  },
  "tags": ["garantia", "politica", "faq"],
  "autoApprovalSafe": true
}
</output>
</example>

<example>
<input>PRODUTO VEIO QUEBRADO!!! QUERO REEMBOLSO IMEDIATO OU VOU PROCESSAR!!!</input>
<output>
{
  "category": "product_defect",
  "sentiment": "urgent",
  "urgencyLevel": 5,
  "requiresHumanReview": true,
  "suggestedResponse": "Lamento muito pelo transtorno! Entendo perfeitamente sua frustração. Para agilizar o reembolso, preciso de algumas informações: 1) Número do pedido, 2) Foto do produto danificado, 3) Foto da embalagem. Com essas informações, vou priorizar seu caso para reembolso imediato. Pode me enviar agora?",
  "extractedData": {
    "orderNumber": null,
    "productMentioned": null,
    "timeframeMentioned": null
  },
  "tags": ["defeito", "reembolso", "urgente", "ameaca_legal"],
  "autoApprovalSafe": false
}
</output>
</example>
</examples>
`;

// 4. Função principal
async function analyzeCustomerQuestion(questionText: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `
    ${fewShotExamples}

    <task>
    Agora analise a seguinte pergunta do cliente usando o mesmo formato:
    </task>

    <question>
    ${questionText}
    </question>
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash", // Rápido e econômico
    systemInstruction: systemInstruction,
    contents: prompt,
    config: {
      temperature: 0.4, // Baixa para consistência
      topP: 0.9,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseJsonSchema: zodToJsonSchema(questionAnalysisSchema),
    },
  });

  const analysis = questionAnalysisSchema.parse(
    JSON.parse(response.text)
  );

  return analysis;
}

// 5. Uso
const question = "Comprei um celular há 5 dias (#ML123789) e a tela está com defeito!";
const analysis = await analyzeCustomerQuestion(question);

console.log(analysis);
// {
//   category: "product_defect",
//   sentiment: "negative",
//   urgencyLevel: 4,
//   requiresHumanReview: true,
//   suggestedResponse: "Olá! Lamento muito pelo problema...",
//   extractedData: {
//     orderNumber: "ML123789",
//     productMentioned: "celular",
//     timeframeMentioned: "5 dias"
//   },
//   tags: ["defeito", "celular", "garantia"],
//   autoApprovalSafe: false
// }
```

### Caso 2: Análise de Imagem de Produto Defeituoso

```typescript
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "fs/promises";

// 1. Schema
const productImageAnalysisSchema = z.object({
  productCondition: z.enum([
    "new_intact",
    "minor_cosmetic_damage",
    "functional_damage",
    "severe_damage",
    "completely_broken"
  ]),
  packageCondition: z.enum([
    "intact",
    "minor_damage",
    "severe_damage",
    "opened_resealed"
  ]),
  defectsIdentified: z.array(z.object({
    type: z.string(),
    severity: z.enum(["minor", "moderate", "severe"]),
    location: z.string(),
    description: z.string()
  })),
  likelyDamageCause: z.enum([
    "shipping_damage",
    "manufacturing_defect",
    "user_damage",
    "unclear"
  ]),
  recommendedAction: z.enum([
    "full_refund",
    "partial_refund",
    "replacement",
    "deny_claim",
    "request_more_photos"
  ]),
  confidence: z.number().min(0).max(1),
  humanReviewRequired: z.boolean(),
  notes: z.string()
});

// 2. System Instruction
const imageAnalysisSystemInstruction = `
  === PAPEL ===
  Especialista em análise de produtos danificados para marketplace.

  === EXPERTISE ===
  - Identificação de defeitos de fabricação vs danos de transporte
  - Análise de embalagens e sinais de manuseio
  - Avaliação de autenticidade de reclamações

  === PROCESSO ===
  1. Examine CUIDADOSAMENTE todos os detalhes da imagem
  2. Identifique TODOS os defeitos visíveis, não apenas os óbvios
  3. Analise o contexto (iluminação, fundo, ângulo) para detectar possível fraude
  4. Compare com padrões típicos de cada tipo de dano

  === REGRAS ===
  - Se a imagem estiver desfocada/escura: request_more_photos
  - Se houver sinais de uso além do teste básico: considere user_damage
  - Se a embalagem estiver intacta mas produto danificado: manufacturing_defect
  - Se a embalagem estiver danificada: shipping_damage
  - Marque humanReviewRequired=true quando confidence < 0.7

  === SINAIS DE FRAUDE ===
  - Produto visivelmente usado (arranhões múltiplos, sujeira)
  - Embalagem aberta e re-lacrada com fita genérica
  - Dano claramente incompatível com transporte
  - Falta de acessórios originais
`;

async function analyzeProductImage(imagePath: string, customerDescription: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Lê imagem
  const imageData = await fs.readFile(imagePath);
  const base64Image = imageData.toString("base64");

  const prompt = `
    === DESCRIÇÃO DO CLIENTE ===
    "${customerDescription}"

    === TAREFA ===
    Analise esta imagem do produto e determine:
    1. Condição real do produto
    2. Condição da embalagem
    3. Todos os defeitos visíveis
    4. Provável causa do dano
    5. Ação recomendada

    Seja OBJETIVO e BASE-SE apenas no que está VISÍVEL na imagem.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    systemInstruction: imageAnalysisSystemInstruction,
    contents: [
      { text: prompt },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      }
    ],
    config: {
      temperature: 0.4, // Baixa para análise objetiva
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseJsonSchema: zodToJsonSchema(productImageAnalysisSchema),
    },
  });

  return productImageAnalysisSchema.parse(JSON.parse(response.text));
}

// Uso
const analysis = await analyzeProductImage(
  "/path/to/customer-photo.jpg",
  "Celular chegou com a tela rachada! Embalagem intacta mas produto quebrado!"
);

console.log(analysis);
// {
//   productCondition: "functional_damage",
//   packageCondition: "intact",
//   defectsIdentified: [
//     {
//       type: "screen_crack",
//       severity: "severe",
//       location: "bottom_left_corner",
//       description: "Rachadura de ~5cm iniciando no canto inferior esquerdo"
//     }
//   ],
//   likelyDamageCause: "shipping_damage",
//   recommendedAction: "full_refund",
//   confidence: 0.85,
//   humanReviewRequired: false,
//   notes: "Embalagem intacta sugere dano durante transporte interno. Padrão de rachadura consistente com impacto pontual."
// }
```

### Caso 3: Geração de Resposta com Thinking Level

```typescript
import { GoogleGenAI, types } from "@google/genai";

// Cenário: Cliente com histórico complexo

async function generateComplexResponse(
  customerHistory: string[],
  currentQuestion: string,
  orderData: any
) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const systemInstruction = `
    Você é um especialista em atendimento ao cliente.
    Analise TODO o contexto histórico antes de responder.
    Identifique padrões de comportamento e adapte sua abordagem.
  `;

  const prompt = `
    === HISTÓRICO DO CLIENTE (últimas 5 interações) ===
    ${customerHistory.map((msg, i) => `${i + 1}. ${msg}`).join("\n")}

    === DADOS DO PEDIDO ATUAL ===
    Número: ${orderData.number}
    Produto: ${orderData.product}
    Valor: ${orderData.value}
    Status: ${orderData.status}
    Dias desde compra: ${orderData.daysAgo}

    === PERGUNTA ATUAL ===
    ${currentQuestion}

    === TAREFA COMPLEXA ===
    Com base no histórico completo:
    1. Identifique se este cliente tem padrão de reclamações frequentes
    2. Avalie se as reclamações são justificadas
    3. Determine o tom ideal para esta resposta (mais formal, mais empático, etc)
    4. Gere uma resposta que:
       - Resolva o problema atual
       - Considere o contexto histórico
       - Previna futuras reclamações sobre o mesmo assunto
       - Ofereça compensação se apropriado (desconto, frete grátis)

    Formate como JSON:
    {
      "customerProfile": "string (novo/recorrente/problemático/vip)",
      "responsetone": "string (formal/empático/assertivo)",
      "suggestedResponse": "string",
      "compensationOffer": "string ou null",
      "preventiveMeasures": ["string"],
      "escalationNeeded": boolean
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    systemInstruction: systemInstruction,
    contents: prompt,
    config: {
      // 🧠 HIGH THINKING: Tarefa complexa com múltiplos fatores
      thinkingConfig: {
        thinkingLevel: "high"
      },
      temperature: 1.0, // Gemini 3: manter em 1.0
      responseMimeType: "application/json"
    },
  });

  return JSON.parse(response.text);
}

// Uso
const result = await generateComplexResponse(
  [
    "Cliente reclamou de atraso há 2 meses (pedido chegou no prazo, mas ele esperava mais rápido)",
    "Cliente elogiou qualidade do produto há 1 mês",
    "Cliente reclamou de embalagem amassada há 3 semanas (produto intacto)",
    "Cliente solicitou desconto há 1 semana (negado)",
    "Cliente comprou novamente há 5 dias (produto atual)"
  ],
  "Meu pedido ainda não chegou! Toda vez a mesma coisa!",
  {
    number: "ML999888",
    product: "Fone Bluetooth",
    value: "R$ 150",
    status: "Em trânsito",
    daysAgo: 5
  }
);

console.log(result);
// {
//   "customerProfile": "recorrente_com_expectativas_altas",
//   "responsetone": "empático_mas_educativo",
//   "suggestedResponse": "Olá! Entendo sua preocupação. Verifiquei seu pedido #ML999888 e ele está dentro do prazo normal de 5-7 dias úteis (hoje é o 5º dia). Vejo que você é um cliente frequente e valorizado - obrigado pela confiança! Para sua tranquilidade, vou monitorar pessoalmente esta entrega. Caso não chegue até amanhã, ativarei frete expresso para o próximo pedido sem custo. Que tal?",
//   "compensationOffer": "Frete grátis expresso no próximo pedido",
//   "preventiveMeasures": [
//     "Adicionar nota no perfil: cliente espera entregas rápidas",
//     "Sugerir produtos com frete Prime nas próximas compras",
//     "Enviar atualizações proativas de rastreamento"
//   ],
//   "escalationNeeded": false
// }
```

### Caso 4: Context Caching para Políticas da Empresa

```typescript
import { GoogleGenAI } from "@google/genai";

// Políticas extensas que raramente mudam
const COMPANY_POLICIES = `
  [Documento de 50.000 tokens com todas as políticas]

  === POLÍTICAS DE DEVOLUÇÃO ===
  [5000 tokens]

  === POLÍTICAS DE REEMBOLSO ===
  [5000 tokens]

  === GARANTIAS ===
  [5000 tokens]

  === PROCEDIMENTOS DE RECLAMAÇÃO ===
  [5000 tokens]

  [... continua ...]
`;

const PRODUCT_CATALOG = `
  [Catálogo de 30.000 tokens com todos os produtos]
`;

const FAQ = `
  [FAQ de 10.000 tokens]
`;

async function setupContextCache() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // 1. Crie o cache (executar 1x por hora)
  const cachedContent = await ai.caches.create({
    model: "gemini-1.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `
              Você é um assistente de atendimento ao cliente.
              Use as seguintes informações para responder perguntas:
            `
          },
          { text: `=== POLÍTICAS DA EMPRESA ===\n${COMPANY_POLICIES}` },
          { text: `=== CATÁLOGO DE PRODUTOS ===\n${PRODUCT_CATALOG}` },
          { text: `=== FAQ ===\n${FAQ}` },
        ]
      }
    ],
    ttl: "3600s", // Cache válido por 1 hora
    displayName: "customer-service-context-v1"
  });

  console.log(`Cache criado: ${cachedContent.name}`);
  console.log(`Expira em: ${cachedContent.expireTime}`);

  return cachedContent.name;
}

async function answerWithCache(cacheName: string, question: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // 2. Use o cache em TODAS as requisições subsequentes
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: question,
    cachedContent: cacheName, // 💰 ~4x mais barato!
    config: {
      temperature: 0.4,
      maxOutputTokens: 512,
    }
  });

  return response.text;
}

// Uso
const cacheName = await setupContextCache();

// Responda múltiplas perguntas usando o MESMO cache
const answer1 = await answerWithCache(cacheName, "Qual é o prazo de devolução?");
const answer2 = await answerWithCache(cacheName, "Como rastrear meu pedido?");
const answer3 = await answerWithCache(cacheName, "Qual é a garantia do produto X?");

// 💰 ECONOMIA:
// Sem cache: 3 requisições × 90k tokens input = 270k tokens = $0.54
// Com cache: 1x 90k tokens (cache) + 3x pergunta pequena = ~95k tokens = $0.14
// Economia: 74%!
```

---

## Resumo: Checklist de Implementação

### ✅ Setup Inicial

```typescript
// 1. Instale SDK
npm install @google/genai zod zod-to-json-schema

// 2. Configure API key
process.env.GEMINI_API_KEY = "sua-chave-aqui"

// 3. Importe
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
```

### ✅ Prompt Engineering

```typescript
// 1. System Instruction clara e concisa
const systemInstruction = "Você é [papel]. Objetivos: [lista]. Regras: [lista].";

// 2. Few-shot examples (2-5 exemplos)
const examples = `<examples>...</examples>`;

// 3. Structured output com Zod
const schema = z.object({ /* ... */ });

// 4. Configuração adequada
const config = {
  temperature: 0.4, // Ajuste conforme caso de uso
  thinkingLevel: "high", // Gemini 3: low/high
  responseMimeType: "application/json",
  responseJsonSchema: zodToJsonSchema(schema)
};
```

### ✅ Otimização de Custos

```typescript
// 1. Use Gemini 2.5 Flash para tarefas simples (mais barato)
model: "gemini-2.5-flash"

// 2. Use Context Caching para contextos repetidos
await ai.caches.create({ /* ... */ })

// 3. Use thinkingLevel: "low" quando apropriado
thinkingLevel: "low"

// 4. Limite maxOutputTokens
maxOutputTokens: 1024
```

### ✅ Checklist de Qualidade

- [ ] System instruction define papel claramente
- [ ] Few-shot examples são consistentes
- [ ] Schema Zod cobre todos os casos
- [ ] Validação semântica implementada
- [ ] Temperature apropriada para caso de uso
- [ ] Context caching habilitado (se aplicável)
- [ ] Error handling robusto
- [ ] Logs não expõem dados sensíveis
- [ ] Fallback para human review em casos críticos

---

## Referências Oficiais

### Documentação Google (2025)

1. [Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
2. [Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output)
3. [Thinking Level](https://ai.google.dev/gemini-api/docs/thinking)
4. [Long Context](https://ai.google.dev/gemini-api/docs/long-context)
5. [Multimodal Prompts](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/design-multimodal-prompts)
6. [System Instructions](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/system-instructions)

### SDKs

- **TypeScript/JavaScript:** [@google/genai](https://github.com/googleapis/js-genai)
- **Python:** [google-genai](https://pypi.org/project/google-genai/)

### Papers & Research

- [Teaching Gemini to spot exploding stars with just a few examples](https://research.google/blog/teaching-gemini-to-spot-exploding-stars-with-just-a-few-examples/) (Nature Astronomy, 2025)
- [Gemini 3 Pro Official Announcement](https://blog.google/products/gemini/gemini-3/)

---

**Última atualização:** Novembro 2025
**Modelos cobertos:** Gemini 3 Pro Preview, Gemini 2.5 Pro, Gemini 2.5 Flash
**Aplicação:** ML Agent - Atendimento ao Cliente Mercado Livre
