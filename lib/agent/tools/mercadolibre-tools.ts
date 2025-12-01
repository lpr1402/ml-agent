/**
 * Mercado Libre Tools - Tools especializadas para o agente
 * Fornecem acesso a dados do ML API com mesma estrutura do N8N
 *
 * @author ML Agent Team
 * @date 2025-11-20
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { getValidMLToken } from '@/lib/ml-api/token-manager'
import { formatProductInfo, formatBuyerQuestionsHistory, fetchBuyerQuestionsHistory } from '@/lib/webhooks/n8n-payload-builder'
import { decryptToken } from '@/lib/security/encryption'
import type { AgentTool, ToolContext, ProductImage } from '../types/agent-types'

/**
 * Tool: Buscar informações completas do produto
 */
export const getProductInfoTool: AgentTool = {
  name: 'get_product_info',
  description: `Busca informações COMPLETAS do produto no Mercado Livre, incluindo:
- Título, preço, condição (novo/usado)
- Estoque disponível e quantidade vendida
- Informações de frete (grátis, tipo de envio)
- Garantia e termos de venda
- Características principais (marca, modelo, cor, tamanho, etc)
- Variações disponíveis (cores, tamanhos, etc)
- Descrição completa do anúncio
- Link do produto

Use esta tool SEMPRE antes de responder perguntas sobre o produto.`,

  parameters: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'ID do produto no Mercado Livre (ex: MLB1234567890)',
      },
    },
    required: ['itemId'],
  },

  async execute(params: { itemId: string }, context: ToolContext) {
    try {
      logger.info('[MLTools] Fetching product info', {
        itemId: params.itemId,
        accountId: context.mlAccountId,
      })

      // Obter token válido
      const accessToken = await getValidMLToken(context.mlAccountId)

      if (!accessToken) {
        throw new Error('No valid access token available for ML account')
      }

      // Buscar item completo
      const itemResponse = await fetch(
        `https://api.mercadolibre.com/items/${params.itemId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      )

      if (!itemResponse.ok) {
        throw new Error(`ML API error: ${itemResponse.status} ${itemResponse.statusText}`)
      }

      const itemData = await itemResponse.json()

      // Buscar descrição (opcional)
      let descriptionData = null
      try {
        const descResponse = await fetch(
          `https://api.mercadolibre.com/items/${params.itemId}/description`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          }
        )

        if (descResponse.ok) {
          descriptionData = await descResponse.json()
        }
      } catch (descError) {
        logger.warn('[MLTools] Could not fetch description', {
          itemId: params.itemId,
        })
      }

      // Combinar dados
      const completeProduct = {
        ...itemData,
        description: descriptionData,
      }

      // Formatar usando mesma lógica do N8N
      const formattedInfo = formatProductInfo(completeProduct)

      logger.info('[MLTools] Product info retrieved', {
        itemId: params.itemId,
        title: itemData.title,
        price: itemData.price,
        infoLength: formattedInfo.length,
      })

      return {
        success: true,
        data: formattedInfo,
        raw: completeProduct,
      }
    } catch (error: any) {
      logger.error('[MLTools] Error fetching product info', {
        itemId: params.itemId,
        error: error.message,
      })

      return {
        success: false,
        error: error.message,
        data: `Erro ao buscar informações do produto: ${error.message}`,
      }
    }
  },
}

/**
 * Tool: Buscar imagens do produto para análise multimodal
 */
export const getProductImagesTool: AgentTool = {
  name: 'get_product_images',
  description: `Busca as imagens do produto para análise visual.
Use quando precisar ver as fotos do produto para responder perguntas sobre:
- Condição visual do produto
- Detalhes visíveis nas fotos
- Cores, acabamento, embalagem
- Comparação com descrição`,

  parameters: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'ID do produto no Mercado Livre',
      },
      maxImages: {
        type: 'number',
        description: 'Número máximo de imagens a retornar (default: 3)',
      },
    },
    required: ['itemId'],
  },

  async execute(params: { itemId: string; maxImages?: number }, context: ToolContext) {
    try {
      const maxImages = params.maxImages || 3

      logger.info('[MLTools] Fetching product images', {
        itemId: params.itemId,
        maxImages,
      })

      const accessToken = await getValidMLToken(context.mlAccountId)

      if (!accessToken) {
        throw new Error('No valid access token available')
      }

      // Buscar item
      const response = await fetch(
        `https://api.mercadolibre.com/items/${params.itemId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`ML API error: ${response.status}`)
      }

      const itemData = await response.json()

      // Extrair imagens
      const pictures = itemData.pictures || []
      const limitedPictures = pictures.slice(0, maxImages)

      const images: ProductImage[] = limitedPictures.map((pic: any) => ({
        id: pic.id,
        url: pic.url,
        secureUrl: pic.secure_url,
        size: pic.size,
        maxSize: pic.max_size,
      }))

      logger.info('[MLTools] Product images retrieved', {
        itemId: params.itemId,
        count: images.length,
      })

      return {
        success: true,
        images,
        count: images.length,
      }
    } catch (error: any) {
      logger.error('[MLTools] Error fetching product images', {
        itemId: params.itemId,
        error: error.message,
      })

      return {
        success: false,
        error: error.message,
        images: [],
      }
    }
  },
}

/**
 * Tool: Buscar histórico de perguntas do comprador
 */
export const getBuyerHistoryTool: AgentTool = {
  name: 'get_buyer_history',
  description: `Busca o histórico de perguntas anteriores do COMPRADOR ESPECÍFICO.
Retorna as últimas 5 perguntas que este mesmo cliente fez em anúncios da organização.

IMPORTANTE: Use para entender:
- Se o cliente já perguntou algo similar antes
- Padrão de comportamento do cliente
- Histórico de interações com a loja
- Se é primeira compra ou cliente recorrente`,

  parameters: {
    type: 'object',
    properties: {
      customerId: {
        type: 'string',
        description: 'ID do comprador no Mercado Livre',
      },
      currentQuestionId: {
        type: 'string',
        description: 'ID da pergunta atual (para excluir do histórico)',
      },
    },
    required: ['customerId', 'currentQuestionId'],
  },

  async execute(
    params: { customerId: string; currentQuestionId: string },
    context: ToolContext
  ) {
    try {
      logger.info('[MLTools] Fetching buyer history', {
        customerId: params.customerId,
        organizationId: context.organizationId,
      })

      // Usar função existente do n8n-payload-builder
      const questions = await fetchBuyerQuestionsHistory(
        params.customerId,
        context.organizationId,
        params.currentQuestionId,
        prisma,
        decryptToken
      )

      // Formatar usando mesma lógica do N8N
      const formattedHistory = formatBuyerQuestionsHistory(questions)

      logger.info('[MLTools] Buyer history retrieved', {
        customerId: params.customerId,
        questionsFound: questions.length,
      })

      return {
        success: true,
        data: formattedHistory,
        raw: questions,
        count: questions.length,
        isFirstInteraction: questions.length === 0,
      }
    } catch (error: any) {
      logger.error('[MLTools] Error fetching buyer history', {
        customerId: params.customerId,
        error: error.message,
      })

      return {
        success: false,
        error: error.message,
        data: 'HISTÓRICO DO COMPRADOR: Primeira interação deste cliente com nossa loja.',
        count: 0,
        isFirstInteraction: true,
      }
    }
  },
}

/**
 * Tool: Buscar perguntas similares já respondidas
 */
export const searchSimilarQuestionsTool: AgentTool = {
  name: 'search_similar_questions',
  description: `Busca perguntas SIMILARES já respondidas pela organização.
Retorna perguntas com texto parecido que já foram respondidas com sucesso.

Use para:
- Encontrar respostas que funcionaram bem no passado
- Manter consistência nas respostas
- Aprender com histórico de sucesso
- Evitar responder diferente para mesma pergunta`,

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Texto da pergunta para buscar similares',
      },
      limit: {
        type: 'number',
        description: 'Número máximo de resultados (default: 5)',
      },
    },
    required: ['query'],
  },

  async execute(params: { query: string; limit?: number }, context: ToolContext) {
    try {
      const limit = params.limit || 5

      logger.info('[MLTools] Searching similar questions', {
        query: params.query,
        limit,
        organizationId: context.organizationId,
      })

      // Buscar no banco perguntas respondidas da organização
      // Extrair primeira palavra ou usar query inteira
      const searchTerm = params.query.trim().split(' ')[0] || params.query

      const similarQuestions = await prisma.question.findMany({
        where: {
          mlAccount: {
            organizationId: context.organizationId,
          },
          status: {
            in: ['RESPONDED', 'COMPLETED', 'SENT_TO_ML'],
          },
          answer: {
            not: null,
          },
          // TODO: Implementar busca por similaridade de texto com embeddings
          // Por enquanto, busca simples por palavras-chave
          text: {
            contains: searchTerm,
          },
        },
        take: limit,
        orderBy: {
          answeredAt: 'desc',
        },
        select: {
          text: true,
          answer: true,
          answeredAt: true,
          status: true,
          mlAccount: {
            select: {
              nickname: true,
            },
          },
        },
      })

      // Formatar resultados
      const formattedResults = similarQuestions.map((q) => ({
        questionText: q.text,
        answerText: q.answer || '',
        dateAnswered: q.answeredAt,
        wasSuccessful: q.status === 'SENT_TO_ML' || q.status === 'COMPLETED',
        sellerNickname: q.mlAccount.nickname,
      }))

      logger.info('[MLTools] Similar questions found', {
        query: params.query,
        count: formattedResults.length,
      })

      return {
        success: true,
        questions: formattedResults,
        count: formattedResults.length,
      }
    } catch (error: any) {
      logger.error('[MLTools] Error searching similar questions', {
        query: params.query,
        error: error.message,
      })

      return {
        success: false,
        error: error.message,
        questions: [],
        count: 0,
      }
    }
  },
}

/**
 * Tool: Buscar perfil do vendedor
 */
export const getSellerProfileTool: AgentTool = {
  name: 'get_seller_profile',
  description: `Busca informações do perfil do vendedor no Mercado Livre.
Retorna dados sobre reputação, vendas, e status.

Use quando precisar de contexto sobre:
- Reputação do vendedor
- Histórico de vendas
- Status de Power Seller
- Credibilidade para responder sobre garantias/qualidade`,

  parameters: {
    type: 'object',
    properties: {
      sellerId: {
        type: 'string',
        description: 'ID do vendedor no Mercado Livre',
      },
    },
    required: ['sellerId'],
  },

  async execute(params: { sellerId: string }, context: ToolContext) {
    try {
      logger.info('[MLTools] Fetching seller profile', {
        sellerId: params.sellerId,
      })

      const accessToken = await getValidMLToken(context.mlAccountId)

      if (!accessToken) {
        throw new Error('No valid access token available')
      }

      // Buscar dados do usuário
      const userResponse = await fetch(
        `https://api.mercadolibre.com/users/${params.sellerId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      )

      if (!userResponse.ok) {
        throw new Error(`ML API error: ${userResponse.status}`)
      }

      const userData = await userResponse.json()

      // Formatar informações relevantes
      const sellerInfo = {
        nickname: userData.nickname || 'Vendedor',
        reputation: {
          levelId: userData.seller_reputation?.level_id || 'unknown',
          powerSeller: userData.seller_reputation?.power_seller_status || null,
          transactions: {
            completed: userData.seller_reputation?.transactions?.completed || 0,
            canceled: userData.seller_reputation?.transactions?.canceled || 0,
            ratings: {
              positive: userData.seller_reputation?.transactions?.ratings?.positive || 0,
              neutral: userData.seller_reputation?.transactions?.ratings?.neutral || 0,
              negative: userData.seller_reputation?.transactions?.ratings?.negative || 0,
            },
          },
        },
        registrationDate: userData.registration_date,
        siteId: userData.site_id,
      }

      logger.info('[MLTools] Seller profile retrieved', {
        sellerId: params.sellerId,
        nickname: sellerInfo.nickname,
        level: sellerInfo.reputation.levelId,
      })

      return {
        success: true,
        seller: sellerInfo,
      }
    } catch (error: any) {
      logger.error('[MLTools] Error fetching seller profile', {
        sellerId: params.sellerId,
        error: error.message,
      })

      return {
        success: false,
        error: error.message,
        seller: null,
      }
    }
  },
}

/**
 * Tool: Verificar estoque disponível
 */
export const checkStockTool: AgentTool = {
  name: 'check_stock',
  description: `Verifica estoque ATUALIZADO do produto em tempo real.
Use quando o cliente perguntar sobre disponibilidade ou prazo de envio.`,

  parameters: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'ID do produto',
      },
    },
    required: ['itemId'],
  },

  async execute(params: { itemId: string }, context: ToolContext) {
    try {
      const accessToken = await getValidMLToken(context.mlAccountId)

      if (!accessToken) {
        throw new Error('No valid access token')
      }

      const response = await fetch(
        `https://api.mercadolibre.com/items/${params.itemId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`ML API error: ${response.status}`)
      }

      const data = await response.json()

      const stockInfo = {
        availableQuantity: data.available_quantity || 0,
        soldQuantity: data.sold_quantity || 0,
        status: data.status,
        hasStock: (data.available_quantity || 0) > 0,
      }

      return {
        success: true,
        stock: stockInfo,
      }
    } catch (error: any) {
      logger.error('[MLTools] Error checking stock', {
        itemId: params.itemId,
        error: error.message,
      })

      return {
        success: false,
        error: error.message,
      }
    }
  },
}

/**
 * Tool: Buscar informações de frete
 */
export const getShippingInfoTool: AgentTool = {
  name: 'get_shipping_info',
  description: `Busca informações detalhadas de frete e entrega.
Use quando o cliente perguntar sobre prazos, custos de envio, ou métodos de entrega.`,

  parameters: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'ID do produto',
      },
      zipCode: {
        type: 'string',
        description: 'CEP de destino (opcional)',
      },
    },
    required: ['itemId'],
  },

  async execute(params: { itemId: string; zipCode?: string }, context: ToolContext) {
    try {
      const accessToken = await getValidMLToken(context.mlAccountId)

      if (!accessToken) {
        throw new Error('No valid access token')
      }

      const response = await fetch(
        `https://api.mercadolibre.com/items/${params.itemId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`ML API error: ${response.status}`)
      }

      const data = await response.json()
      const shipping = data.shipping || {}

      const shippingInfo = {
        freeShipping: shipping.free_shipping || false,
        mode: shipping.mode || 'not_specified',
        logisticType: shipping.logistic_type || null,
        methods: shipping.methods || [],
        localPickUp: shipping.local_pick_up || false,
        tags: shipping.tags || [],
      }

      return {
        success: true,
        shipping: shippingInfo,
      }
    } catch (error: any) {
      logger.error('[MLTools] Error fetching shipping info', {
        itemId: params.itemId,
        error: error.message,
      })

      return {
        success: false,
        error: error.message,
      }
    }
  },
}

/**
 * Tool: Buscar dados do comprador
 */
export const getBuyerProfileTool: AgentTool = {
  name: 'get_buyer_profile',
  description: `Busca informações públicas do comprador no Mercado Livre.
Use para entender melhor o perfil de quem está fazendo a pergunta.`,

  parameters: {
    type: 'object',
    properties: {
      buyerId: {
        type: 'string',
        description: 'ID do comprador',
      },
    },
    required: ['buyerId'],
  },

  async execute(params: { buyerId: string }, context: ToolContext) {
    try {
      const accessToken = await getValidMLToken(context.mlAccountId)

      if (!accessToken) {
        throw new Error('No valid access token')
      }

      const response = await fetch(
        `https://api.mercadolibre.com/users/${params.buyerId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`ML API error: ${response.status}`)
      }

      const data = await response.json()

      const buyerInfo = {
        id: data.id,
        nickname: data.nickname || 'Cliente',
        registrationDate: data.registration_date,
        countryId: data.country_id,
        siteId: data.site_id,
        // Dados públicos de reputação de comprador
        buyerReputation: data.buyer_reputation || null,
      }

      return {
        success: true,
        buyer: buyerInfo,
      }
    } catch (error: any) {
      logger.error('[MLTools] Error fetching buyer profile', {
        buyerId: params.buyerId,
        error: error.message,
      })

      return {
        success: false,
        error: error.message,
        buyer: null,
      }
    }
  },
}

/**
 * Retorna todas as tools do Mercado Livre
 */
export function getAllMercadoLibreTools(): AgentTool[] {
  return [
    getProductInfoTool,
    getProductImagesTool,
    getBuyerHistoryTool,
    searchSimilarQuestionsTool,
    getSellerProfileTool,
    checkStockTool,
    getShippingInfoTool,
    getBuyerProfileTool,
  ]
}

/**
 * Retorna function declarations para Gemini
 */
export function getMercadoLibreToolsForGemini(): any[] {
  const tools = getAllMercadoLibreTools()

  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }))
}
