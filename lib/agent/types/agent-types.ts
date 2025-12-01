/**
 * Tipos TypeScript para o Sistema de Agente IA
 * Gemini 3.0 Pro + LangGraph 1.0
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

// ============================================================================
// CORE AGENT TYPES
// ============================================================================

/**
 * Configuração do agente de IA
 */
export interface AgentConfig {
  // Model configuration
  geminiApiKey: string
  model: string
  temperature: number
  maxOutputTokens: number
  thinkingLevel: 'low' | 'high' | 'default'
  mediaResolution: 'media_resolution_low' | 'media_resolution_medium' | 'media_resolution_high'

  // Agent behavior
  autoApprove: boolean
  confidenceThresholdAuto: number
  confidenceThresholdReview: number
  maxRetries: number

  // Features
  enableStreaming: boolean
  enableLearning: boolean

  // LangSmith
  langsmithApiKey?: string
  langsmithProject?: string
}

/**
 * Estado do agente durante execução
 */
export interface AgentState {
  // Input
  question: QuestionInput
  context: QuestionContext

  // Processing
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
  reasoning: string[]

  // Output
  response: AgentResponse | null
  confidence: number
  requiresApproval: boolean

  // Metadata
  startTime: number
  stepCount: number
  tokensUsed: TokenUsage
  errors: AgentError[]
}

/**
 * Entrada de pergunta para o agente
 */
export interface QuestionInput {
  mlQuestionId: string
  text: string
  itemId: string
  customerId: string | null
  sellerId: string
  dateCreated: Date
  receivedAt: Date
}

/**
 * Contexto enriquecido da pergunta
 */
export interface QuestionContext {
  // Product data
  product: ProductInfo | null
  productImages: ProductImage[]
  productDescription: string | null

  // Buyer data
  buyerHistory: BuyerQuestion[]
  buyerProfile: BuyerProfile | null

  // Seller data
  sellerNickname: string
  sellerReputation: SellerReputation | null

  // Similar questions (semantic search)
  similarQuestions: SimilarQuestion[]

  // Organization memory
  organizationPreferences: OrganizationPreferences | null
}

/**
 * Informações do produto
 */
export interface ProductInfo {
  id: string
  title: string
  price: number
  originalPrice: number | null
  currency: string
  condition: 'new' | 'used' | 'refurbished'
  availableQuantity: number
  soldQuantity: number

  // Shipping
  shipping: {
    freeShipping: boolean
    mode: string
    logisticType: string | null
  }

  // Warranty
  warranty: string | null

  // Attributes
  attributes: ProductAttribute[]

  // Variations
  variations: ProductVariation[]

  // Links
  permalink: string
  thumbnail: string | null
}

/**
 * Atributo do produto
 */
export interface ProductAttribute {
  id: string
  name: string
  valueName: string
}

/**
 * Variação do produto
 */
export interface ProductVariation {
  id: number
  attributeCombinations: ProductAttribute[]
  price: number
  availableQuantity: number
  soldQuantity: number
  pictureIds: string[]
}

/**
 * Imagem do produto para análise multimodal
 */
export interface ProductImage {
  id: string
  url: string
  secureUrl: string
  size: string
  maxSize: string
}

/**
 * Histórico de perguntas do comprador
 */
export interface BuyerQuestion {
  id: string
  text: string
  answer: string | null
  dateCreated: Date
  itemId: string
  itemTitle: string | null
}

/**
 * Perfil do comprador
 */
export interface BuyerProfile {
  id: string
  nickname: string
  totalPurchases: number
  totalQuestions: number
  averageRating: number | null
}

/**
 * Reputação do vendedor
 */
export interface SellerReputation {
  levelId: string
  powerSellerStatus: string | null
  transactions: {
    completed: number
    canceled: number
    ratings: {
      positive: number
      neutral: number
      negative: number
    }
  }
}

/**
 * Pergunta similar encontrada
 */
export interface SimilarQuestion {
  id: string
  questionText: string
  answerText: string
  similarity: number
  wasSuccessful: boolean
  dateAnswered: Date
}

/**
 * Preferências da organização
 */
export interface OrganizationPreferences {
  organizationId: string
  responseStyle: 'formal' | 'casual' | 'friendly'
  includeEmojis: boolean
  maxResponseLength: number
  autoIncludeShipping: boolean
  autoIncludeWarranty: boolean
  customGuidelines: string | null
}

// ============================================================================
// AGENT RESPONSE TYPES
// ============================================================================

/**
 * Resposta gerada pelo agente
 */
export interface AgentResponse {
  // Core response
  content: string
  confidence: number

  // Quality indicators
  isComplete: boolean
  isRelevant: boolean
  isAccurate: boolean

  // Reasoning
  reasoning: string
  toolsUsed: string[]

  // Metadata
  generatedAt: Date
  tokensUsed: TokenUsage
  processingTime: number

  // Structured data
  structuredData: ResponseStructuredData | null
}

/**
 * Dados estruturados da resposta
 */
export interface ResponseStructuredData {
  questionCategory: 'shipping' | 'price' | 'product_details' | 'warranty' | 'stock' | 'variation' | 'usage' | 'quality' | 'other'
  requiresFollowUp: boolean
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent'
  extractedEntities: {
    mentionedPrice?: number
    mentionedLocation?: string
    mentionedDate?: string
  }
}

/**
 * Resposta estruturada do Gemini (com JSON Schema)
 */
export interface AgentResponseStructured {
  answer: string
  confidence: number
  questionCategory: 'shipping' | 'price' | 'product_details' | 'warranty' | 'stock' | 'variation' | 'usage' | 'quality' | 'other'
  reasoning: string
  customerSentiment: 'positive' | 'neutral' | 'negative' | 'urgent'
  requiresFollowUp: boolean
  extractedData?: {
    mentionedPrice?: number
    mentionedLocation?: string
    mentionedDate?: string
  }
  tags: string[]
}

/**
 * Uso de tokens
 */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cachedTokens?: number
  cost: number
}

// ============================================================================
// TOOL TYPES
// ============================================================================

/**
 * Definição de tool para o agente
 */
export interface AgentTool {
  name: string
  description: string
  parameters: ToolParameters
  execute: (params: any, context: ToolContext) => Promise<any>
}

/**
 * Parâmetros de tool (JSON Schema)
 */
export interface ToolParameters {
  type: 'object'
  properties: Record<string, ToolParameter>
  required: string[]
}

/**
 * Parâmetro individual de tool
 */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  enum?: string[]
  items?: ToolParameter
  properties?: Record<string, ToolParameter>
}

/**
 * Contexto disponível para tools
 */
export interface ToolContext {
  mlAccountId: string
  organizationId: string
  accessToken: string
  sessionId: string
}

/**
 * Chamada de tool pelo agente
 */
export interface ToolCall {
  id: string
  name: string
  parameters: Record<string, any>
  timestamp: number
}

/**
 * Resultado de execução de tool
 */
export interface ToolResult {
  toolCallId: string
  toolName: string
  status: 'success' | 'error'
  result: any
  error: string | null
  executionTime: number
  timestamp: number
}

// ============================================================================
// MEMORY TYPES
// ============================================================================

/**
 * Entrada de memória de longo prazo
 */
export interface MemoryEntry {
  id: string
  organizationId: string
  mlAccountId: string | null

  // Content
  type: 'feedback' | 'pattern' | 'preference' | 'success' | 'failure'
  key: string
  value: any

  // Metadata
  source: string
  confidence: number
  usageCount: number

  // Timestamps
  createdAt: Date
  updatedAt: Date
  lastUsedAt: Date | null
}

/**
 * Embedding vetorial para semantic search
 */
export interface VectorEmbedding {
  id: string
  organizationId: string

  // Content
  content: string
  contentType: 'question' | 'answer' | 'product_description'

  // Vector
  embedding: number[]
  dimensions: number

  // Metadata
  metadata: Record<string, any>

  // Timestamps
  createdAt: Date
}

/**
 * Feedback de aprendizado
 */
export interface LearningFeedback {
  id: string
  questionId: string
  organizationId: string

  // Original vs Final
  originalResponse: string
  finalResponse: string

  // Feedback type
  feedbackType: 'edit' | 'reject' | 'approve_with_changes'
  changes: string[]

  // Learning extracted
  patterns: string[]
  improvements: string[]

  // Metadata
  createdBy: string
  createdAt: Date
}

// ============================================================================
// STREAMING TYPES
// ============================================================================

/**
 * Chunk de streaming
 */
export interface StreamChunk {
  type: 'token' | 'tool_call' | 'tool_result' | 'confidence_update' | 'status' | 'done' | 'error'
  data: any
  timestamp: number
  sequenceNumber: number
}

/**
 * Evento de WebSocket
 */
export interface WebSocketEvent {
  event: string
  data: any
  sessionId: string
  timestamp: number
}

/**
 * Status de streaming
 */
export interface StreamingStatus {
  isActive: boolean
  currentStep: string
  tokensGenerated: number
  toolsExecuted: number
  progress: number
  estimatedTimeRemaining: number | null
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Erro do agente
 */
export interface AgentError {
  code: string
  message: string
  type: 'tool_error' | 'model_error' | 'validation_error' | 'timeout_error' | 'rate_limit_error'
  retryable: boolean
  timestamp: number
  stack?: string
}

/**
 * Classificação de erro
 */
export type ErrorType = 'transient' | 'permanent' | 'validation' | 'timeout'

// ============================================================================
// LANGGRAPH STATE TYPES
// ============================================================================

/**
 * Estado do grafo LangGraph
 */
export interface LangGraphState {
  // Messages (LangChain standard)
  messages: LangGraphMessage[]

  // Custom state
  questionInput: QuestionInput
  enrichedContext: QuestionContext | null

  // Tool execution
  pendingToolCalls: ToolCall[]
  completedTools: ToolResult[]

  // Response
  draftResponse: string
  finalResponse: AgentResponse | null
  confidence: number

  // Control flow
  stepCount: number
  shouldContinue: boolean
  requiresApproval: boolean

  // Metadata
  startTime: number
  errors: AgentError[]
}

/**
 * Mensagem do LangGraph (compatível com Gemini)
 */
export interface LangGraphMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string | MessageContent[]
  name?: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

/**
 * Conteúdo multimodal de mensagem
 */
export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'inline_data'; inline_data: { mime_type: string; data: string } }

// ============================================================================
// STATISTICS & MONITORING TYPES
// ============================================================================

/**
 * Estatísticas do agente
 */
export interface AgentStatistics {
  // Volume
  totalQuestions: number
  questionsProcessed: number
  questionsAutoApproved: number
  questionsRequiringReview: number
  questionsEscalated: number

  // Performance
  averageProcessingTime: number
  averageConfidence: number
  p95ProcessingTime: number
  p99ProcessingTime: number

  // Quality
  successRate: number
  errorRate: number
  retryRate: number

  // Cost
  totalTokensUsed: number
  totalCost: number
  averageCostPerQuestion: number

  // Timeframe
  startDate: Date
  endDate: Date
}

/**
 * Métricas em tempo real
 */
export interface RealtimeMetrics {
  activeStreams: number
  queuedQuestions: number
  avgResponseTime: number
  currentTokensPerSecond: number
  errorRateLast5Min: number
  timestamp: number
}

// ============================================================================
// DATABASE TYPES (Prisma extensions)
// ============================================================================

/**
 * Agent Memory Entry (nova tabela)
 */
export interface AgentMemoryDB {
  id: string
  organizationId: string
  mlAccountId: string | null

  // Memory type
  memoryType: 'feedback' | 'pattern' | 'preference' | 'success' | 'failure'
  key: string
  value: any // JSON

  // Vector embedding (para semantic search)
  embedding: number[] | null
  embeddingDimensions: number | null

  // Usage tracking
  usageCount: number
  lastUsedAt: Date | null
  confidence: number

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

/**
 * Learning Feedback Entry (nova tabela)
 */
export interface LearningFeedbackDB {
  id: string
  questionId: string
  organizationId: string
  mlAccountId: string

  // Response comparison
  originalResponse: string
  finalResponse: string

  // Feedback details
  feedbackType: 'edit' | 'reject' | 'approve_with_changes'
  edits: any // JSON array of changes

  // Extracted learning
  learnedPatterns: string[] // JSON
  improvements: string[] // JSON

  // Metadata
  createdBy: string
  createdAt: Date
  appliedToMemory: boolean
  appliedAt: Date | null
}

// ============================================================================
// GEMINI SPECIFIC TYPES
// ============================================================================

/**
 * Configuração de geração do Gemini (SDK @google/genai v1.30.0)
 */
export interface GeminiGenerationConfig {
  temperature: number
  maxOutputTokens: number
  topP?: number
  topK?: number
  thinkingConfig?: {
    thinkingLevel?: 'low' | 'high' // Aninhado dentro de thinkingConfig
  }
  responseMimeType?: 'text/plain' | 'application/json'
  responseJsonSchema?: any // Correto para SDK JS (não responseSchema)
}

/**
 * Request ao Gemini
 */
export interface GeminiRequest {
  model: string
  contents: GeminiContent[]
  tools?: GeminiFunctionDeclaration[]
  generationConfig?: GeminiGenerationConfig
  safetySettings?: GeminiSafetySetting[]
}

/**
 * Conteúdo do Gemini
 */
export interface GeminiContent {
  role: 'user' | 'model' | 'function'
  parts: GeminiPart[]
}

/**
 * Parte do conteúdo Gemini
 */
export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, any> } }
  | { functionResponse: { name: string; response: any } }

/**
 * Declaração de função para Gemini
 */
export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

/**
 * Configuração de segurança do Gemini
 */
export interface GeminiSafetySetting {
  category: 'HARM_CATEGORY_HARASSMENT' | 'HARM_CATEGORY_HATE_SPEECH' | 'HARM_CATEGORY_SEXUALLY_EXPLICIT' | 'HARM_CATEGORY_DANGEROUS_CONTENT'
  threshold: 'BLOCK_NONE' | 'BLOCK_LOW_AND_ABOVE' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_ONLY_HIGH'
}

/**
 * Resposta do Gemini (streaming)
 */
export interface GeminiStreamChunk {
  text?: string | undefined
  functionCalls?: Array<{
    name: string
    args: Record<string, any>
    id?: string
  }> | undefined
  finishReason?: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER' | undefined
  safetyRatings?: Array<{
    category: string
    probability: string
  }> | undefined
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  } | undefined
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Resultado de operação com sucesso/erro
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

/**
 * Status de processamento
 */
export type ProcessingStatus =
  | 'queued'
  | 'enriching_context'
  | 'calling_tools'
  | 'generating_response'
  | 'validating'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'

/**
 * Configuração de retry
 */
export interface RetryConfig {
  maxAttempts: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: string[]
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  // Re-export all types for easy importing
}
