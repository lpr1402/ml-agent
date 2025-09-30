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
 * Formato otimizado para processamento por IA - sem emojis, estruturado e completo
 */
export function formatProductInfo(product: MLCompleteProduct | any, legacyDescription?: any): string {
  // Se receber formato antigo com dois parâmetros, converter
  const itemData: any = product
  let descriptionData: any = legacyDescription || null

  // Se for um produto completo, já tem tudo
  if (product && product.description) {
    descriptionData = product.description
  }

  const sections: string[] = []

  // HEADER
  sections.push('INFORMAÇÕES DO PRODUTO')
  sections.push('=' .repeat(50))
  sections.push('')

  // SEÇÃO: DADOS BÁSICOS
  sections.push('DADOS BÁSICOS')
  sections.push('-'.repeat(30))
  sections.push(`Título: ${itemData.title || 'Produto sem título'}`)
  sections.push(`ID do Produto: ${itemData.id || 'Não disponível'}`)

  // Preço e desconto
  if (itemData.price) {
    const priceFormatted = formatPrice ? formatPrice(itemData.price) : `R$ ${itemData.price.toFixed(2).replace('.', ',')}`
    sections.push(`Preço Atual: ${priceFormatted}`)

    if (itemData.original_price && itemData.original_price > itemData.price) {
      const originalFormatted = formatPrice ? formatPrice(itemData.original_price) : `R$ ${itemData.original_price.toFixed(2).replace('.', ',')}`
      const desconto = Math.round(((itemData.original_price - itemData.price) / itemData.original_price) * 100)
      sections.push(`Preço Original: ${originalFormatted}`)
      sections.push(`Desconto Aplicado: ${desconto}%`)
    }
  }

  // Condição do produto
  if (itemData.condition) {
    const conditionText = getConditionText ? getConditionText(itemData.condition) : itemData.condition
    sections.push(`Condição: ${conditionText}`)
  }
  sections.push('')

  // SEÇÃO: ESTOQUE E VENDAS
  sections.push('ESTOQUE E VENDAS')
  sections.push('-'.repeat(30))
  if (itemData.available_quantity !== undefined) {
    sections.push(`Quantidade Disponível: ${itemData.available_quantity} ${itemData.available_quantity === 1 ? 'unidade' : 'unidades'}`)
  }
  if (itemData.sold_quantity !== undefined) {
    sections.push(`Total de Vendas Realizadas: ${itemData.sold_quantity} ${itemData.sold_quantity === 1 ? 'unidade vendida' : 'unidades vendidas'}`)
  }
  sections.push('')

  // SEÇÃO: FRETE E ENTREGA
  if (itemData.shipping) {
    sections.push('FRETE E ENTREGA')
    sections.push('-'.repeat(30))

    if (itemData.shipping.free_shipping) {
      sections.push('Frete: GRÁTIS')
    } else {
      sections.push('Frete: Pago pelo comprador')
    }

    if (itemData.shipping.mode === 'me2') {
      sections.push('Tipo de Envio: Mercado Envios Full (Entrega rápida)')
    } else if (itemData.shipping.mode === 'me1') {
      sections.push('Tipo de Envio: Mercado Envios')
    } else {
      sections.push('Tipo de Envio: Combinado com o vendedor')
    }

    if (itemData.shipping.logistic_type === 'fulfillment') {
      sections.push('Logística: Fulfillment (Produto no centro de distribuição do ML)')
    }
    sections.push('')
  }

  // SEÇÃO: GARANTIA
  let hasWarranty = false
  if (itemData.warranty) {
    sections.push('GARANTIA')
    sections.push('-'.repeat(30))
    sections.push(`Garantia: ${itemData.warranty}`)
    hasWarranty = true
  } else if (itemData.sale_terms) {
    const warranty = itemData.sale_terms.find((term: any) => term.id === 'WARRANTY_TIME')
    const warrantyType = itemData.sale_terms.find((term: any) => term.id === 'WARRANTY_TYPE')
    if (warranty || warrantyType) {
      sections.push('GARANTIA')
      sections.push('-'.repeat(30))
      if (warrantyType) {
        sections.push(`Tipo de Garantia: ${warrantyType.value_name}`)
      }
      if (warranty) {
        sections.push(`Período de Garantia: ${warranty.value_name}`)
      }
      hasWarranty = true
    }
  }
  if (hasWarranty) sections.push('')

  // SEÇÃO: CARACTERÍSTICAS PRINCIPAIS
  if (itemData.attributes && Array.isArray(itemData.attributes)) {
    const importantAttributes = ['BRAND', 'MODEL', 'COLOR', 'SIZE', 'MATERIAL', 'CAPACITY', 'WEIGHT', 'HEIGHT', 'WIDTH', 'LENGTH']
    const nameMap: Record<string, string> = {
      'BRAND': 'Marca',
      'MODEL': 'Modelo',
      'COLOR': 'Cor',
      'SIZE': 'Tamanho',
      'MATERIAL': 'Material',
      'CAPACITY': 'Capacidade',
      'WEIGHT': 'Peso',
      'HEIGHT': 'Altura',
      'WIDTH': 'Largura',
      'LENGTH': 'Comprimento'
    }

    const filteredAttrs = itemData.attributes
      .filter((attr: any) => importantAttributes.includes(attr.id) && attr.value_name)
      .map((attr: any) => ({
        name: nameMap[attr.id] || attr.name,
        value: attr.value_name
      }))

    if (filteredAttrs.length > 0) {
      sections.push('CARACTERÍSTICAS PRINCIPAIS')
      sections.push('-'.repeat(30))
      filteredAttrs.forEach((attr: any) => {
        sections.push(`${attr.name}: ${attr.value}`)
      })
      sections.push('')
    }
  }

  // SEÇÃO: VARIAÇÕES DISPONÍVEIS
  if (itemData.variations && itemData.variations.length > 0) {
    sections.push(`VARIAÇÕES DISPONÍVEIS (Total: ${itemData.variations.length} opções)`)
    sections.push('-'.repeat(30))

    itemData.variations.forEach((v: any, index: number) => {
      sections.push(`\nVariação ${index + 1}:`)

      // Atributos da variação
      if (v.attribute_combinations && v.attribute_combinations.length > 0) {
        v.attribute_combinations.forEach((a: any) => {
          sections.push(`  ${a.name}: ${a.value_name}`)
        })
      }

      // Preço específico da variação
      if (v.price && v.price !== itemData.price) {
        const varPriceFormatted = formatPrice ? formatPrice(v.price) : `R$ ${v.price.toFixed(2).replace('.', ',')}`
        sections.push(`  Preço desta variação: ${varPriceFormatted}`)
      }

      // Estoque da variação
      const varStock = v.available_quantity || 0
      const varSold = v.sold_quantity || 0
      sections.push(`  Estoque: ${varStock} unidades`)
      if (varSold > 0) {
        sections.push(`  Vendidas: ${varSold} unidades`)
      }
    })
    sections.push('')
  }

  // SEÇÃO: DESCRIÇÃO COMPLETA DO ANÚNCIO
  const desc = itemData.description || descriptionData
  if (desc?.plain_text || desc?.text) {
    const description = desc.plain_text || desc.text
    const cleanDescription = description
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim()

    if (cleanDescription) {
      sections.push('DESCRIÇÃO COMPLETA DO ANÚNCIO')
      sections.push('-'.repeat(30))
      sections.push(cleanDescription)
      sections.push('')
    }
  }

  // SEÇÃO: LINK DO PRODUTO
  if (itemData.permalink) {
    sections.push('LINK DO PRODUTO')
    sections.push('-'.repeat(30))
    sections.push(itemData.permalink)
    sections.push('')
  }

  // FOOTER
  sections.push('=' .repeat(50))

  return sections.join('\n')
}

/**
 * Formata o histórico de perguntas do COMPRADOR ESPECÍFICO
 * Apenas as últimas 5 perguntas do mesmo comprador
 */
export function formatBuyerQuestionsHistory(questions: any[]): string {
  if (!questions || questions.length === 0) {
    return 'HISTÓRICO DO COMPRADOR: Primeira interação deste cliente com nossa loja.'
  }

  // Limitar para as últimas 5 perguntas
  const recentQuestions = questions.slice(0, 5)
  const sections: string[] = []

  sections.push('HISTÓRICO DE PERGUNTAS ANTERIORES DO COMPRADOR')
  sections.push('-'.repeat(50))
  sections.push('')

  recentQuestions.forEach((q, index) => {
    const date = new Date(q.dateCreated || q.date_created)
    const dateStr = `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

    sections.push(`Pergunta ${index + 1} (${dateStr}):`)
    sections.push(`Cliente: "${q.text || 'Texto não disponível'}"`)

    if (q.answer && q.answer.trim()) {
      sections.push(`Resposta: "${q.answer}"`)
    } else {
      sections.push(`Resposta: Ainda não respondida`)
    }
    sections.push('')
  })

  return sections.join('\n')
}

/**
 * Busca as últimas 5 perguntas do comprador direto da API do Mercado Livre
 * Apenas perguntas do mesmo comprador nos anúncios da conta
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

    // Buscar perguntas direto da API do ML
    logger.info(`[PayloadBuilder] Fetching buyer ${customerId} questions from ML API`)

    try {
      // Buscar perguntas recebidas do vendedor
      const questionsUrl = `https://api.mercadolibre.com/questions/search?seller_id=${mlAccount.mlUserId}&limit=30&api_version=4&sort_fields=date_created&sort_types=DESC`

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
        .slice(0, 5) // Limitar para as últimas 5 perguntas

      logger.info(`[PayloadBuilder] Found ${filteredQuestions.length} previous questions from buyer`)

      // Retornar no formato simples e limpo
      return filteredQuestions.map((q: any) => ({
        text: q.text || '',
        answer: q.answer?.text || '',
        dateCreated: q.date_created || new Date()
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