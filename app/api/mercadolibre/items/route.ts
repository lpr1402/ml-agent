import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
// import { getAuthFromRequest } from "../base" // Using session auth instead
import { getCurrentSession } from "@/lib/auth/ml-auth"
import { prisma } from "@/lib/prisma"
import { decryptToken } from "@/lib/security/encryption"

// GET - List all user items usando tokens criptografados
export async function GET(_request: Request) {
  try {
    // Usar sessão do sistema de autenticação novo
    const session = await getCurrentSession()
    
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    // Buscar conta ML ativa
    const mlAccount = await prisma.mLAccount.findFirst({
      where: {
        id: session.activeMLAccountId,
        isActive: true
      }
    })
    
    if (!mlAccount) {
      return NextResponse.json({ error: "No ML account found" }, { status: 401 })
    }
    
    // Descriptografar token
    const accessToken = decryptToken({
      encrypted: mlAccount.accessToken,
      iv: mlAccount.accessTokenIV!,
      authTag: mlAccount.accessTokenTag!
    })

    const { searchParams } = new URL(_request.url)
    const status = searchParams.get("status")
    const offset = searchParams.get("offset") || "0"
    const limit = searchParams.get("limit") || "50"
    const search = searchParams.get("search") || ""
    
    logger.info('[Items API] Fetching items', { 
      status, 
      offset, 
      limit 
    })

    // Usar mlUserId da conta diretamente (já temos isso na conta)
    const userId = mlAccount.mlUserId

    // Montar URL do endpoint oficial
    let itemsUrl = `https://api.mercadolibre.com/users/${userId}/items/search?offset=${offset}&limit=${limit}&orders=stop_time_desc`
    
    if (status && status !== "all") {
      itemsUrl += `&status=${status}`
    }
    
    if (search) {
      itemsUrl += `&q=${encodeURIComponent(search)}`
    }
    
    logger.info('[Items API] URL:', { error: { error: itemsUrl } })
    
    const itemsResponse = await fetch(itemsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
    })

    if (!itemsResponse.ok) {
      const errorText = await itemsResponse.text()
      logger.error('[Items API] Error:', { data: itemsResponse.status, error: errorText })
      
      if (itemsResponse.status === 401) {
        return NextResponse.json({ error: "Token expired or invalid" }, { status: 401 })
      }
      
      return NextResponse.json({ 
        error: "Failed to fetch items",
        details: errorText,
        status: itemsResponse.status
      }, { status: itemsResponse.status })
    }

    const itemsData = await itemsResponse.json()
    logger.info('[Items API] Found items', { count: itemsData.results?.length || 0 })
    
    // Buscar dados detalhados para cada item (em lotes para melhor performance)
    const batchSize = 10 // Processar 10 items por vez
    const results = itemsData.results || []
    const items = []
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (itemId: string) => {
        try {
          const itemResponse = await fetch(
            `https://api.mercadolibre.com/items/${itemId}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Accept': 'application/json'
              },
            }
          )
          
          if (itemResponse.ok) {
            const itemData = await itemResponse.json()
            
            // Buscar vis tas se possível
            let visits = null
            try {
              const visitsResponse = await fetch(
                `https://api.mercadolibre.com/visits/items?ids=${itemId}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                  },
                }
              )
              if (visitsResponse.ok) {
                const visitsData = await visitsResponse.json()
                visits = visitsData[itemId] || null
              }
            } catch {
              // Ignora erros de visitas
            }
            
            return {
              ...itemData,
              visits
            }
          }
          return null
        } catch (error) {
          logger.error(`[Items API] Error fetching item ${itemId}:`, { error })
          return null
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      items.push(...batchResults.filter(item => item !== null))
    }

    logger.info('[Items API] Returning enriched items', { count: items.length })
    
    return NextResponse.json({
      items,
      paging: itemsData.paging,
      total: itemsData.paging?.total || 0,
      query: itemsData.query || {},
      sort: itemsData.sort || {},
      filters: itemsData.filters || {},
    })
  } catch (error) {
    logger.error("Error fetching items:", { error })
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    )
  }
}

// POST - Create new item
export async function POST(_request: Request) {
  try {
    // Usar sessão do sistema de autenticação novo
    const session = await getCurrentSession()
    
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    // Buscar conta ML ativa
    const mlAccount = await prisma.mLAccount.findFirst({
      where: {
        id: session.activeMLAccountId,
        isActive: true
      }
    })
    
    if (!mlAccount) {
      return NextResponse.json({ error: "No ML account found" }, { status: 401 })
    }
    
    // Descriptografar token
    const accessToken = decryptToken({
      encrypted: mlAccount.accessToken,
      iv: mlAccount.accessTokenIV!,
      authTag: mlAccount.accessTokenTag!
    })

    const body = await _request.json()

    // Validate required fields
    if (!body.title || !body.category_id || !body.price || !body.available_quantity) {
      return NextResponse.json(
        { 
          error: "Missing required fields", 
          message: "Título, categoria, preço e quantidade são obrigatórios" 
        },
        { status: 400 }
      )
    }

    // Prepare the item data for ML API
    const itemData = {
      title: body.title,
      category_id: body.category_id,
      price: Number(body.price),
      currency_id: body.currency_id || "BRL",
      available_quantity: Number(body.available_quantity),
      condition: body.condition || "new",
      listing_type_id: body.listing_type_id || "gold_special",
      buying_mode: "buy_it_now",
      pictures: body.pictures || [],
      attributes: body.attributes || [],
      sale_terms: body.sale_terms || [],
      shipping: body.shipping || {
        mode: "me2",
        free_shipping: false,
      },
    }

    logger.info('[Items API] Creating item:', { data: itemData.title })
    
    const response = await fetch("https://api.mercadolibre.com/items", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(itemData),
    })

    const data = await response.json()

    if (!response.ok) {
      logger.error("ML API Error:", { error: { error: data } })
      
      // Provide more helpful error messages
      let errorMessage = "Erro ao criar anúncio"
      if (data.message) {
        errorMessage = data.message
      } else if (data.cause && Array.isArray(data.cause)) {
        errorMessage = data.cause.map((c: any) => c.message).join(", ")
      }
      
      return NextResponse.json(
        { 
          error: "Failed to create item", 
          message: errorMessage,
          details: data 
        },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    logger.error("Error creating item:", { error })
    return NextResponse.json(
      { error: "Failed to create item" },
      { status: 500 }
    )
  }
}

// PUT - Update item
export async function PUT(_request: Request) {
  try {
    // Usar sessão do sistema de autenticação novo
    const session = await getCurrentSession()
    
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    // Buscar conta ML ativa
    const mlAccount = await prisma.mLAccount.findFirst({
      where: {
        id: session.activeMLAccountId,
        isActive: true
      }
    })
    
    if (!mlAccount) {
      return NextResponse.json({ error: "No ML account found" }, { status: 401 })
    }
    
    // Descriptografar token
    const accessToken = decryptToken({
      encrypted: mlAccount.accessToken,
      iv: mlAccount.accessTokenIV!,
      authTag: mlAccount.accessTokenTag!
    })

    const body = await _request.json()
    const { itemId, ...updateData } = body

    if (!itemId) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 })
    }

    logger.info('[Items API] Updating item:', { error: { error: itemId } })
    
    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(updateData),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Failed to update item", details: data },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    logger.error("Error updating item:", { error })
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    )
  }
}

// PATCH - Update item status (pause/activate)
export async function PATCH(_request: Request) {
  try {
    // Usar sessão do sistema de autenticação novo
    const session = await getCurrentSession()
    
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    // Buscar conta ML ativa
    const mlAccount = await prisma.mLAccount.findFirst({
      where: {
        id: session.activeMLAccountId,
        isActive: true
      }
    })
    
    if (!mlAccount) {
      return NextResponse.json({ error: "No ML account found" }, { status: 401 })
    }
    
    // Descriptografar token
    const accessToken = decryptToken({
      encrypted: mlAccount.accessToken,
      iv: mlAccount.accessTokenIV!,
      authTag: mlAccount.accessTokenTag!
    })

    const body = await _request.json()
    const { itemId, status } = body

    if (!itemId || !status) {
      return NextResponse.json(
        { error: "Item ID and status are required" },
        { status: 400 }
      )
    }

    logger.info('[Items API] Updating status for item:', { data: itemId, to: status })
    
    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ status }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Failed to update status", details: data },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    logger.error("Error updating item status:", { error })
    return NextResponse.json(
      { error: "Failed to update item status" },
      { status: 500 }
    )
  }
}