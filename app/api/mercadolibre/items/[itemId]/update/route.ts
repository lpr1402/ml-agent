import { NextRequest, NextResponse } from "next/server"
import { extractAuthHeader } from "@/lib/auth-server"

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
    const body = await request.json()

    // Build the update payload
    const updatePayload: any = {}

    // Basic fields that can be updated
    if (body.title !== undefined) updatePayload.title = body.title
    if (body.price !== undefined) updatePayload.price = body.price
    if (body.available_quantity !== undefined) updatePayload.available_quantity = body.available_quantity
    if (body.condition !== undefined) updatePayload.condition = body.condition
    if (body.video_id !== undefined) updatePayload.video_id = body.video_id
    if (body.warranty !== undefined) updatePayload.warranty = body.warranty
    
    // Description is updated separately
    if (body.description !== undefined) {
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
            plain_text: body.description
          }),
        }
      )
    }

    // Pictures
    if (body.pictures !== undefined) {
      updatePayload.pictures = body.pictures
    }

    // Attributes
    if (body.attributes !== undefined) {
      updatePayload.attributes = body.attributes
    }

    // Shipping
    if (body.shipping !== undefined) {
      updatePayload.shipping = body.shipping
    }

    // Sale terms
    if (body.sale_terms !== undefined) {
      updatePayload.sale_terms = body.sale_terms
    }

    // Variations
    if (body.variations !== undefined) {
      updatePayload.variations = body.variations
    }

    // Channels
    if (body.channels !== undefined) {
      updatePayload.channels = body.channels
    }

    // Listing type
    if (body.listing_type_id !== undefined) {
      updatePayload.listing_type_id = body.listing_type_id
    }

    // Buying mode
    if (body.buying_mode !== undefined) {
      updatePayload.buying_mode = body.buying_mode
    }

    // Category (cannot be changed after creation in most cases)
    if (body.category_id !== undefined) {
      updatePayload.category_id = body.category_id
    }

    // Accept Mercadopago
    if (body.accepts_mercadopago !== undefined) {
      updatePayload.accepts_mercadopago = body.accepts_mercadopago
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
    console.error("Error updating item:", error)
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    )
  }
}