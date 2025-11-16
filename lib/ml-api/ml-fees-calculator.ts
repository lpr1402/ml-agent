/**
 * ML FEES CALCULATOR - Baseado na Documentação Oficial
 * Calcula taxas, comissões e custos do Mercado Livre
 *
 * Fonte: https://developers.mercadolivre.com.br/pt_br/comissao-por-vender
 * Atualizado: Outubro 2025
 */

export interface MLFeesConfig {
  siteId: string
  categoryId?: string
  listingType: 'free' | 'gold_special' | 'gold_pro' | 'bronze' | 'silver' | 'gold' | 'gold_premium'
  price: number
  logisticType?: 'fulfillment' | 'drop_off' | 'cross_docking' | 'self_service'
}

export interface MLFeesResult {
  // Taxas de venda
  saleFeeAmount: number
  saleFeePercentage: number
  meliPercentageFee: number
  financingFee: number
  fixedFee: number

  // Taxas de anúncio
  listingFeeAmount: number

  // Custos Full (estimados)
  fullStorageCostMonthly: number
  fullStorageCostDaily: number

  // Calculados
  netPrice: number // Preço líquido após taxas
  netMargin: number // Margem líquida
  netMarginPercentage: number

  // Metadata
  currency: string
  calculatedAt: Date
}

/**
 * Taxas por site e categoria (valores médios da documentação ML)
 * Baseado em dados reais de Outubro 2025
 */
const ML_FEES_BY_SITE: Record<string, {
  gold_special: number
  gold_pro: number
  free: number
  default: number
}> = {
  MLB: { // Brasil
    gold_special: 11.0, // Clássico: 11%
    gold_pro: 16.0, // Premium: 16%
    free: 0,
    default: 11.0
  },
  MLA: { // Argentina
    gold_special: 15.5, // Clásica: 15.5%
    gold_pro: 15.5, // Premium: 15.5% + financing
    free: 0,
    default: 15.5
  },
  MLM: { // México
    gold_special: 13.0,
    gold_pro: 16.0,
    free: 0,
    default: 13.0
  },
  MLC: { // Chile
    gold_special: 13.5,
    gold_pro: 16.5,
    free: 0,
    default: 13.5
  },
  MCO: { // Colômbia
    gold_special: 14.0,
    gold_pro: 17.0,
    free: 0,
    default: 14.0
  }
}

/**
 * Financing add-on fee (custo adicional para parcelamento)
 * Aplica-se principalmente a Premium e categorias específicas
 */
const FINANCING_FEE_PERCENTAGE = 10.36 // ~10.36% adicional em Premium com parcelamento

/**
 * Custos de armazenagem Full (valores médios mensais)
 * Baseado em estimativas de mercado e categoria
 */
const FULL_STORAGE_COSTS = {
  small: 0.50, // Itens pequenos: R$0.50/mês
  medium: 1.50, // Itens médios: R$1.50/mês
  large: 3.00, // Itens grandes: R$3.00/mês
  extraLarge: 5.00 // Itens extra grandes: R$5.00/mês
}

/**
 * Calcula taxas do Mercado Livre
 */
export function calculateMLFees(config: MLFeesConfig): MLFeesResult {
  const { siteId, listingType, price } = config

  // Obter configuração de taxas do site
  const siteFees = ML_FEES_BY_SITE[siteId] || ML_FEES_BY_SITE['MLB']

  // Calcular taxa base de venda
  const saleFeePercentage = (siteFees?.[listingType as keyof typeof siteFees]) || (siteFees?.default) || 11.0

  // Calcular financing fee para Premium
  const financingFee = listingType === 'gold_pro' ? (price * FINANCING_FEE_PERCENTAGE) / 100 : 0

  // Taxa fixa (aplica-se apenas em alguns casos - geralmente 0)
  const fixedFee = 0

  // Calcular valor total da taxa de venda
  const meliPercentageFee = (price * saleFeePercentage) / 100
  const saleFeeAmount = meliPercentageFee + financingFee + fixedFee

  // Taxa de anúncio (geralmente 0 para gold_special e gold_pro)
  const listingFeeAmount = 0

  // Estimar custo de armazenagem Full
  // Baseado no preço do produto, estimamos o tamanho
  const fullStorageCostMonthly = estimateFullStorageCost(price)
  const fullStorageCostDaily = fullStorageCostMonthly / 30

  // Calcular preço líquido
  const netPrice = price - saleFeeAmount - listingFeeAmount

  // Calcular margem líquida (assumindo custo do produto = 70% do preço de venda)
  const estimatedCost = price * 0.70
  const netMargin = netPrice - estimatedCost - fullStorageCostMonthly
  const netMarginPercentage = (netMargin / price) * 100

  return {
    saleFeeAmount,
    saleFeePercentage,
    meliPercentageFee,
    financingFee,
    fixedFee,
    listingFeeAmount,
    fullStorageCostMonthly,
    fullStorageCostDaily,
    netPrice,
    netMargin,
    netMarginPercentage,
    currency: getCurrency(siteId),
    calculatedAt: new Date()
  }
}

/**
 * Estima custo de armazenagem Full baseado no preço
 */
function estimateFullStorageCost(price: number): number {
  if (price < 50) return FULL_STORAGE_COSTS.small
  if (price < 200) return FULL_STORAGE_COSTS.medium
  if (price < 500) return FULL_STORAGE_COSTS.large
  return FULL_STORAGE_COSTS.extraLarge
}

/**
 * Retorna moeda por site
 */
function getCurrency(siteId: string): string {
  const currencies: Record<string, string> = {
    MLB: 'BRL',
    MLA: 'ARS',
    MLM: 'MXN',
    MLC: 'CLP',
    MCO: 'COP',
    MLU: 'UYU',
    MLV: 'VES',
    MPE: 'PEN'
  }
  return currencies[siteId] || 'BRL'
}

/**
 * Calcula ROI do estoque
 */
export function calculateStockROI(params: {
  availableStock: number
  avgDailySales: number
  itemPrice: number
  storageCostMonthly: number
}): number {
  const { availableStock, avgDailySales, itemPrice, storageCostMonthly } = params

  if (availableStock === 0 || avgDailySales === 0) return 0

  // Receita mensal potencial
  const monthlyRevenue = avgDailySales * 30 * itemPrice

  // Custo de armazenagem mensal
  const monthlyCost = storageCostMonthly

  // ROI = ((Receita - Custo) / Custo) * 100
  if (monthlyCost === 0) return 0

  const roi = ((monthlyRevenue - monthlyCost) / monthlyCost) * 100

  return Math.max(-100, Math.min(1000, roi)) // Limitar entre -100% e 1000%
}

/**
 * Calcula taxa de giro de estoque
 */
export function calculateTurnoverRate(params: {
  availableStock: number
  avgDailySales: number
}): number {
  const { availableStock, avgDailySales } = params

  if (availableStock === 0 || avgDailySales === 0) return 0

  // Vendas mensais / Estoque = Giro mensal
  const monthlySales = avgDailySales * 30
  const turnover = monthlySales / availableStock

  return Math.max(0, Math.min(10, turnover)) // Limitar entre 0 e 10x
}

/**
 * Calcula receita perdida (quando estoque zerado)
 */
export function calculateLostRevenue(params: {
  avgDailySales: number
  itemPrice: number
  daysOutOfStock: number
}): number {
  const { avgDailySales, itemPrice, daysOutOfStock } = params

  return avgDailySales * itemPrice * daysOutOfStock
}
