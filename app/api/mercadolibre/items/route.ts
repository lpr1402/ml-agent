import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

// GET - List all user items
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const offset = searchParams.get("offset") || "0"
    const limit = searchParams.get("limit") || "50"

    // Get user info first
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    })

    if (!userResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch user" }, { status: 401 })
    }

    const user = await userResponse.json()
    const userId = user.id

    // Get user items - only add status if it's specified and not "all"
    let itemsUrl = `https://api.mercadolibre.com/users/${userId}/items/search?offset=${offset}&limit=${limit}&orders=stop_time_desc`
    if (status && status !== "all") {
      itemsUrl += `&status=${status}`
    }
    
    const itemsResponse = await fetch(itemsUrl, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    })

    if (!itemsResponse.ok) {
      throw new Error("Failed to fetch items")
    }

    const itemsData = await itemsResponse.json()
    
    // Get detailed info for each item
    const itemPromises = itemsData.results?.map(async (itemId: string) => {
      try {
        const itemResponse = await fetch(
          `https://api.mercadolibre.com/items/${itemId}`,
          {
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
            },
          }
        )
        
        if (itemResponse.ok) {
          return await itemResponse.json()
        }
        return null
      } catch (error) {
        console.error(`Error fetching item ${itemId}:`, error)
        return null
      }
    }) || []

    const items = (await Promise.all(itemPromises)).filter(item => item !== null)

    return NextResponse.json({
      items,
      paging: itemsData.paging,
      total: itemsData.paging?.total || 0,
    })
  } catch (error) {
    console.error("Error fetching items:", error)
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    )
  }
}

// POST - Create new item
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const body = await request.json()

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

    const response = await fetch("https://api.mercadolibre.com/items", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(itemData),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("ML API Error:", data)
      
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
    console.error("Error creating item:", error)
    return NextResponse.json(
      { error: "Failed to create item" },
      { status: 500 }
    )
  }
}

// PUT - Update item
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const body = await request.json()
    const { itemId, ...updateData } = body

    if (!itemId) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 })
    }

    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
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
    console.error("Error updating item:", error)
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    )
  }
}

// PATCH - Update item status (pause/activate)
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const body = await request.json()
    const { itemId, status } = body

    if (!itemId || !status) {
      return NextResponse.json(
        { error: "Item ID and status are required" },
        { status: 400 }
      )
    }

    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
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
    console.error("Error updating item status:", error)
    return NextResponse.json(
      { error: "Failed to update item status" },
      { status: 500 }
    )
  }
}