import { logger } from '@/lib/logger'
import { formatPrice, getConditionText, type MLCompleteProduct } from '@/lib/ml-api/enhanced-product-fetcher'

/**
 * Interface unificada para payloads do N8N
 * Usada tanto em /processamento quanto em /editar
 */
export interface N8NUnifiedPayload {
  ml_question_id: string
  ml_item_id: string
  seller_nickname: string // Nome do vendedor que recebeu a pergunta
  product_info_formatted: string
  buyer_questions_history_formatted: string
  current_question_text: string

  // Campos adicionais opcionais para revisão
  original_response?: string | undefined
  revision_feedback?: string | undefined
}

/**
 * Formata informações completas do produto em uma string organizada
 * Agora usa dados completos do produto incluindo variações
 */
export function formatProductInfo(product: MLCompleteProduct | any, legacyDescription?: any): string {
  // Se receber formato antigo com dois parâmetros, converter
  const itemData: any = product
  let descriptionData: any = legacyDescription || null

  // Se for um produto completo, já tem tudo
  if (product && product.description) {
    descriptionData = product.description
  }
  const parts: string[] = []

  // Título e ID
  parts.push(`📦 PRODUTO: ${itemData.title || 'Produto sem título'}`)
  parts.push(`ID: ${itemData.id || 'N/A'}`)

  // Preço e condição
  if (itemData.price) {
    parts.push(`💰 PREÇO: ${formatPrice ? formatPrice(itemData.price) : `R$ ${itemData.price.toFixed(2).replace('.', ',')}`}`)
  }

  if (itemData.original_price && itemData.original_price > itemData.price) {
    const desconto = Math.round(((itemData.original_price - itemData.price) / itemData.original_price) * 100)
    parts.push(`📍 PREÇO ORIGINAL: ${formatPrice ? formatPrice(itemData.original_price) : `R$ ${itemData.original_price.toFixed(2).replace('.', ',')}`} (${desconto}% OFF)`)
  }

  // Condição
  if (itemData.condition) {
    parts.push(`📋 CONDIÇÃO: ${getConditionText ? getConditionText(itemData.condition) : itemData.condition}`)
  }

  // Estoque e vendas
  if (itemData.available_quantity !== undefined) {
    parts.push(`📊 ESTOQUE: ${itemData.available_quantity} ${itemData.available_quantity === 1 ? 'unidade' : 'unidades'}`)
  }

  if (itemData.sold_quantity) {
    parts.push(`✅ VENDAS: ${itemData.sold_quantity} ${itemData.sold_quantity === 1 ? 'venda realizada' : 'vendas realizadas'}`)
  }

  // Frete
  if (itemData.shipping) {
    const shippingParts: string[] = []
    if (itemData.shipping.free_shipping) {
      shippingParts.push('Frete Grátis')
    }
    if (itemData.shipping.mode === 'me2') {
      shippingParts.push('Mercado Envios Full')
    } else if (itemData.shipping.mode === 'me1') {
      shippingParts.push('Mercado Envios')
    }
    if (itemData.shipping.logistic_type === 'fulfillment') {
      shippingParts.push('Fulfillment')
    }
    if (shippingParts.length > 0) {
      parts.push(`🚚 FRETE: ${shippingParts.join(' | ')}`)
    }
  }

  // Garantia
  if (itemData.warranty) {
    parts.push(`🛡️ GARANTIA: ${itemData.warranty}`)
  } else if (itemData.sale_terms) {
    const warranty = itemData.sale_terms.find((term: any) => term.id === 'WARRANTY_TIME')
    const warrantyType = itemData.sale_terms.find((term: any) => term.id === 'WARRANTY_TYPE')
    if (warranty || warrantyType) {
      const warrantyParts = []
      if (warrantyType) warrantyParts.push(warrantyType.value_name)
      if (warranty) warrantyParts.push(warranty.value_name)
      parts.push(`🛡️ GARANTIA: ${warrantyParts.join(' - ')}`)
    }
  }

  // Atributos importantes
  if (itemData.attributes && Array.isArray(itemData.attributes)) {
    const importantAttributes = ['BRAND', 'MODEL', 'COLOR', 'SIZE', 'MATERIAL', 'CAPACITY']
    const attrs = itemData.attributes
      .filter((attr: any) => importantAttributes.includes(attr.id) && attr.value_name)
      .map((attr: any) => {
        const nameMap: Record<string, string> = {
          'BRAND': 'Marca',
          'MODEL': 'Modelo',
          'COLOR': 'Cor',
          'SIZE': 'Tamanho',
          'MATERIAL': 'Material',
          'CAPACITY': 'Capacidade'
        }
        return `${nameMap[attr.id] || attr.name}: ${attr.value_name}`
      })

    if (attrs.length > 0) {
      parts.push(`📝 CARACTERÍSTICAS: ${attrs.join(' | ')}`)
    }
  }

  // Variações detalhadas
  if (itemData.variations && itemData.variations.length > 0) {
    parts.push(`\n🎨 VARIAÇÕES DISPONÍVEIS (${itemData.variations.length} opções):`)

    itemData.variations.forEach((v: any, index: number) => {
      const attrs = v.attribute_combinations
        ?.map((a: any) => `${a.name}: ${a.value_name}`)
        .join(', ')

      const varPrice = v.price || itemData.price
      const varStock = v.available_quantity || 0
      const varSold = v.sold_quantity || 0

      parts.push(`   [${index + 1}] ${attrs || 'Variação'}`)
      if (v.price && v.price !== itemData.price) {
        parts.push(`       Preço: ${formatPrice ? formatPrice(varPrice) : `R$ ${varPrice.toFixed(2).replace('.', ',')}`}`)
      }
      parts.push(`       Estoque: ${varStock} | Vendidos: ${varSold}`)
    })
  }

  // Categoria e tipo de anúncio
  if (itemData.category_id) {
    parts.push(`📂 CATEGORIA: ${itemData.category_id}`)
  }

  if (itemData.listing_type_id) {
    const listingTypes: Record<string, string> = {
      'gold_special': 'Clássico',
      'gold_pro': 'Premium',
      'gold_premium': 'Premium',
      'free': 'Gratuito'
    }
    parts.push(`⭐ TIPO DE ANÚNCIO: ${listingTypes[itemData.listing_type_id] || itemData.listing_type_id}`)
  }

  // Tags especiais
  if (itemData.tags && Array.isArray(itemData.tags)) {
    const importantTags = []
    if (itemData.tags.includes('good_quality_picture')) importantTags.push('Fotos de Qualidade')
    if (itemData.tags.includes('immediate_payment')) importantTags.push('Pagamento Imediato')
    if (itemData.tags.includes('cart_eligible')) importantTags.push('Carrinho Disponível')
    if (itemData.tags.includes('best_seller_candidate')) importantTags.push('Mais Vendido')

    if (importantTags.length > 0) {
      parts.push(`🏷️ DESTAQUES: ${importantTags.join(' | ')}`)
    }
  }

  // Descrição completa (aumentada para 1000 chars)
  const desc = itemData.description || descriptionData
  if (desc?.plain_text || desc?.text) {
    const description = desc.plain_text || desc.text
    const cleanDescription = description
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000)

    if (cleanDescription) {
      parts.push(`\n📄 DESCRIÇÃO COMPLETA:\n${cleanDescription}${description.length > 1000 ? '...' : ''}`)
    }
  }

  // Fotos disponíveis
  if (itemData.pictures && itemData.pictures.length > 0) {
    parts.push(`\n📸 FOTOS: ${itemData.pictures.length} imagens disponíveis`)
  }

  // Link do produto
  if (itemData.permalink) {
    parts.push(`🔗 LINK: ${itemData.permalink}`)
  }

  return parts.join('\n')
}

/**
 * Formata o histórico das ÚLTIMAS 10 perguntas do comprador
 * Formato limpo e simplificado para prompt do N8N
 */
export function formatBuyerQuestionsHistory(questions: any[]): string {
  if (!questions || questions.length === 0) {
    return 'Histórico do comprador: Primeira interação deste cliente.'
  }

  const formattedQuestions = questions.map((q, index) => {
    const date = new Date(q.dateCreated)
    const dateStr = `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

    let text = `\nPergunta ${index + 1} (${dateStr}):\n`
    text += `Cliente perguntou: "${q.text || 'Texto não disponível'}"\n`

    if (q.answer && q.answer.trim()) {
      text += `Nossa resposta: "${q.answer}"`
    } else {
      text += `Status: Não respondida`
    }

    return text
  }).join('\n')

  const totalQuestions = questions.length
  const answeredQuestions = questions.filter(q => q.answer && q.answer.trim()).length

  const header = `Histórico de ${totalQuestions} perguntas anteriores do comprador:\n`
  const summary = `\n\nResumo: Cliente fez ${totalQuestions} perguntas, ${answeredQuestions} foram respondidas.`

  return header + formattedQuestions + summary
}

/**
 * Busca as últimas 10 perguntas do comprador direto da API do Mercado Livre
 * Segue a documentação oficial do ML para buscar perguntas
 */
export async function fetchBuyerQuestionsHistory(
  customerId: string,
  organizationId: string,
  currentQuestionId: string,
  prisma: any,
  decryptToken: (data: any) => string
): Promise<any[]> {
  try {
    if (!customerId || !organizationId) {
      return []
    }

    // Buscar uma conta ativa da organização para usar o token
    const mlAccount = await prisma.mLAccount.findFirst({
      where: {
        organizationId: organizationId,
        isActive: true
      },
      select: {
        accessToken: true,
        accessTokenIV: true,
        accessTokenTag: true,
        mlUserId: true,
        nickname: true
      }
    })

    if (!mlAccount || !mlAccount.accessToken) {
      logger.warn('[PayloadBuilder] No active ML account with token found')
      return []
    }

    // Descriptografar token
    const accessToken = decryptToken({
      encrypted: mlAccount.accessToken,
      iv: mlAccount.accessTokenIV!,
      authTag: mlAccount.accessTokenTag!
    })

    // Buscar perguntas direto da API do ML (documentação oficial)
    // https://developers.mercadolivre.com.br/pt_br/gestao-de-perguntas
    logger.info(`[PayloadBuilder] Fetching buyer ${customerId} questions from ML API`)

    try {
      // Buscar perguntas recebidas do vendedor (sem filtro por from pois retorna 400)
      const questionsUrl = `https://api.mercadolibre.com/questions/search?seller_id=${mlAccount.mlUserId}&limit=50&api_version=4&sort_fields=date_created&sort_types=DESC`

      const response = await fetch(questionsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn('[PayloadBuilder] Rate limited by ML API')
        } else {
          logger.warn(`[PayloadBuilder] ML API error: ${response.status}`)
        }
        return []
      }

      const data = await response.json()

      if (!data.questions || !Array.isArray(data.questions)) {
        return []
      }

      // Filtrar apenas perguntas do mesmo comprador e excluir a pergunta atual
      const filteredQuestions = data.questions
        .filter((q: any) =>
          q.from?.id === parseInt(customerId) &&
          q.id !== parseInt(currentQuestionId)
        )
        .slice(0, 10) // Pegar apenas as 10 últimas

      logger.info(`[PayloadBuilder] Found ${filteredQuestions.length} questions from ML API`)

      // Retornar no formato simples e limpo
      return filteredQuestions.map((q: any) => ({
        id: q.id,
        text: q.text || '',
        answer: q.answer?.text || '',
        status: q.status || 'UNANSWERED',
        dateCreated: q.date_created || new Date(),
        itemId: q.item_id || ''
      }))

    } catch (apiError) {
      logger.warn('[PayloadBuilder] Failed to fetch from ML API:', { error: apiError })
      return []
    }

  } catch (error) {
    logger.error('[PayloadBuilder] Error fetching buyer questions history:', { error })
    return []
  }
}

/**
 * Constrói payload unificado para N8N com dados COMPLETOS do produto
 */
export async function buildN8NPayload(
  questionData: any,
  itemData: any,
  descriptionData: any,
  buyerQuestions: any[],
  options?: {
    originalResponse?: string
    revisionFeedback?: string
    sellerNickname?: string
  }
): Promise<N8NUnifiedPayload> {
  // Se itemData for um MLCompleteProduct, usar direto
  // Senão, combinar itemData com descriptionData
  const productInfo = itemData?.description
    ? formatProductInfo(itemData) // Já é um produto completo
    : formatProductInfo(itemData, descriptionData) // Formato antigo

  return {
    ml_question_id: questionData.mlQuestionId || questionData.id || '',
    ml_item_id: questionData.item_id || itemData?.id || '',
    seller_nickname: options?.sellerNickname || questionData.sellerNickname || 'Vendedor',
    product_info_formatted: productInfo,
    buyer_questions_history_formatted: formatBuyerQuestionsHistory(buyerQuestions),
    current_question_text: questionData.text || '',
    original_response: options?.originalResponse || undefined,
    revision_feedback: options?.revisionFeedback || undefined
  }
}