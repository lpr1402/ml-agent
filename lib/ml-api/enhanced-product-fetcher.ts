import { logger } from '@/lib/logger'
import { ensureHttps } from '@/lib/utils/ensure-https'

/**
 * Enhanced Product Fetcher - September 2025 Version
 * Fetches COMPLETE product information from Mercado Livre API
 * Including: base item data, description, variations, pictures, shipping details
 */

export interface MLCompleteProduct {
  // Base item data
  id: string
  title: string
  price: number
  original_price?: number
  condition: string
  available_quantity: number
  sold_quantity: number
  permalink: string
  thumbnail?: string
  category_id: string
  listing_type_id: string
  warranty?: string

  // Description
  description?: {
    plain_text?: string
    text?: string
    last_updated?: string
  }

  // Variations
  variations?: Array<{
    id: number
    price: number
    attribute_combinations: Array<{
      id: string
      name: string
      value_id?: string
      value_name: string
    }>
    available_quantity: number
    sold_quantity: number
    picture_ids?: string[]
  }>

  // Pictures
  pictures?: Array<{
    id: string
    url: string
    secure_url: string
    size: string
    max_size: string
    quality?: string
  }>

  // Shipping
  shipping?: {
    mode?: string
    free_shipping: boolean
    tags?: string[]
    logistic_type?: string
    store_pick_up?: boolean
    methods?: any[]
  }

  // Attributes
  attributes?: Array<{
    id: string
    name: string
    value_id?: string | null
    value_name?: string | null
    value_struct?: any
    values?: any[]
    attribute_group_id?: string
    attribute_group_name?: string
  }>

  // Sale terms (warranty, etc)
  sale_terms?: Array<{
    id: string
    name: string
    value_id?: string | null
    value_name?: string | null
    value_struct?: any
    values?: any[]
  }>

  // Tags
  tags?: string[]

  // Status
  status: string
  buying_mode?: string

  // Seller info
  seller_id?: number
  seller_address?: any
}

/**
 * Fetches complete product information from ML API
 * Includes: item data, description, variations
 */
export async function fetchCompleteProductData(
  itemId: string,
  accessToken?: string | null
): Promise<MLCompleteProduct | null> {
  try {
    if (!itemId) {
      logger.warn('[ProductFetcher] No item ID provided')
      return null
    }

    logger.info(`[ProductFetcher] Fetching complete data for item ${itemId}`)

    // Headers for API calls
    const headers: any = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    // 1. Fetch base item data with all includes
    const itemUrl = `https://api.mercadolibre.com/items/${itemId}?include_attributes=all`

    const itemResponse = await fetch(itemUrl, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })

    if (!itemResponse.ok) {
      logger.error(`[ProductFetcher] Failed to fetch item ${itemId}: ${itemResponse.status}`)
      return null
    }

    const itemData = await itemResponse.json()

    // Initialize complete product object (cast to bypass exactOptionalPropertyTypes strictness)
    const thumbnailUrl = itemData.thumbnail || itemData.pictures?.[0]?.secure_url || itemData.pictures?.[0]?.url
    const completeProduct: MLCompleteProduct = {
      id: itemData.id,
      title: itemData.title || 'Produto sem título',
      price: itemData.price || 0,
      original_price: itemData.original_price,
      condition: itemData.condition || 'not_specified',
      available_quantity: itemData.available_quantity || 0,
      sold_quantity: itemData.sold_quantity || 0,
      permalink: itemData.permalink || '',
      ...(thumbnailUrl ? { thumbnail: ensureHttps(thumbnailUrl)! } : {}),
      category_id: itemData.category_id || '',
      listing_type_id: itemData.listing_type_id || '',
      warranty: itemData.warranty,
      status: itemData.status || '',
      buying_mode: itemData.buying_mode,
      seller_id: itemData.seller_id,
      seller_address: itemData.seller_address,

      // Include all data from base response
      variations: itemData.variations,
      pictures: itemData.pictures,
      shipping: itemData.shipping,
      attributes: itemData.attributes,
      sale_terms: itemData.sale_terms,
      tags: itemData.tags
    }

    // 2. Fetch description separately (often requires auth)
    try {
      const descUrl = `https://api.mercadolibre.com/items/${itemId}/description`
      const descResponse = await fetch(descUrl, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(3000)
      })

      if (descResponse.ok) {
        const descData = await descResponse.json()
        completeProduct.description = {
          plain_text: descData.plain_text || '',
          text: descData.text || descData.plain_text || '',
          last_updated: descData.last_updated
        }
        logger.info(`[ProductFetcher] Description fetched for item ${itemId}`)
      } else {
        logger.warn(`[ProductFetcher] Could not fetch description for ${itemId}: ${descResponse.status}`)
      }
    } catch (error) {
      logger.warn(`[ProductFetcher] Error fetching description:`, { error })
    }

    // 3. If variations exist, ensure we have complete data
    if (itemData.variations && itemData.variations.length > 0) {
      logger.info(`[ProductFetcher] Item ${itemId} has ${itemData.variations.length} variations`)

      // Variations are already included in the base item response
      // Just ensure they're properly formatted
      completeProduct.variations = itemData.variations.map((v: any) => ({
        id: v.id,
        price: v.price || itemData.price,
        attribute_combinations: v.attribute_combinations || [],
        available_quantity: v.available_quantity || 0,
        sold_quantity: v.sold_quantity || 0,
        picture_ids: v.picture_ids || []
      }))
    }

    logger.info(`[ProductFetcher] Complete product data fetched successfully for ${itemId}`)
    return completeProduct

  } catch (error) {
    logger.error(`[ProductFetcher] Error fetching complete product data:`, { error, itemId })
    return null
  }
}

/**
 * Helper to format price in Brazilian format
 */
export function formatPrice(price: number): string {
  return `R$ ${price.toFixed(2).replace('.', ',')}`
}

/**
 * Helper to get product condition in Portuguese
 */
export function getConditionText(condition: string): string {
  const conditionMap: Record<string, string> = {
    'new': 'Novo',
    'used': 'Usado',
    'refurbished': 'Recondicionado',
    'not_specified': 'Não especificado'
  }
  return conditionMap[condition] || condition
}