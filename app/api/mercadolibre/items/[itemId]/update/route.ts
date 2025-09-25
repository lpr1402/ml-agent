import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import { extractAuthHeader } from "@/lib/auth-server"
import { ItemUpdateSchema, validateMLRequest, ValidationError } from "@/lib/validators/ml-validators"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await extractAuthHeader(request)
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const { itemId } = await params
    
    // Validar ID do item
    if (!/^ML[A-Z]\d+$/.test(itemId)) {
      return NextResponse.json(
        { error: "Invalid item ID format" },
        { status: 400 }
      )
    }
    
    // Parse e validar body com Zod
    let validatedData
    try {
      const rawBody = await request.json()
      validatedData = validateMLRequest(ItemUpdateSchema, rawBody)
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.warn('[ItemUpdate] Validation failed', { 
          itemId,
          errors: error.errors 
        })
        return NextResponse.json(
          { 
            error: 'Validation failed',
            details: error.errors 
          },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Build the update payload com dados validados
    const updatePayload: any = {}

    // Basic fields that can be updated (agora validados)
    if (validatedData.title !== undefined) updatePayload.title = validatedData.title
    if (validatedData.price !== undefined) updatePayload.price = validatedData.price
    if (validatedData.available_quantity !== undefined) updatePayload.available_quantity = validatedData.available_quantity
    if (validatedData.condition !== undefined) updatePayload.condition = validatedData.condition
    if (validatedData.video_id !== undefined) updatePayload.video_id = validatedData.video_id
    if (validatedData.warranty !== undefined) updatePayload.warranty = validatedData.warranty
    
    // Description is updated separately
    if (validatedData.description !== undefined) {
      // Update description via separate endpoint
      await fetch(
        `https://api.mercadolibre.com/items/${itemId}/description`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            plain_text: validatedData.description.plain_text || validatedData.description.text
          }),
        }
      )
    }

    // Pictures
    if (validatedData.pictures !== undefined) {
      updatePayload.pictures = validatedData.pictures
    }

    // Attributes
    if (validatedData.attributes !== undefined) {
      updatePayload.attributes = validatedData.attributes
    }

    // Shipping
    if (validatedData.shipping !== undefined) {
      updatePayload.shipping = validatedData.shipping
    }

    // Sale terms
    if (validatedData.sale_terms !== undefined) {
      updatePayload.sale_terms = validatedData.sale_terms
    }

    // Variations
    if (validatedData.variations !== undefined) {
      updatePayload.variations = validatedData.variations
    }

    // Channels
    if (validatedData.channels !== undefined) {
      updatePayload.channels = validatedData.channels
    }

    // Listing type
    if (validatedData.listing_type_id !== undefined) {
      updatePayload.listing_type_id = validatedData.listing_type_id
    }

    // Buying mode
    if (validatedData.buying_mode !== undefined) {
      updatePayload.buying_mode = validatedData.buying_mode
    }

    // Category (cannot be changed after creation in most cases)
    if (validatedData.category_id !== undefined) {
      updatePayload.category_id = validatedData.category_id
    }

    // Accept Mercadopago
    if (validatedData.accepts_mercadopago !== undefined) {
      updatePayload.accepts_mercadopago = validatedData.accepts_mercadopago
    }

    // Update the item
    const response = await fetch(
      `https://api.mercadolibre.com/items/${itemId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.message || "Failed to update item" },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      item: data,
      message: "Item updated successfully"
    })
  } catch (error) {
    logger.error("Error updating item:", { error })
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    )
  }
}