import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../../base"

// PATCH - Update item status
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const params = await context.params
    const itemId = params.itemId
    const body = await request.json()
    const { status } = body

    if (!status || !['active', 'paused', 'closed'].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // Update item status
    const updateResponse = await fetch(
      `https://api.mercadolibre.com/items/${itemId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      }
    )

    if (!updateResponse.ok) {
      const error = await updateResponse.text()
      console.error("Error updating item:", error)
      return NextResponse.json(
        { error: "Failed to update item" },
        { status: updateResponse.status }
      )
    }

    const updatedItem = await updateResponse.json()
    
    return NextResponse.json({
      success: true,
      item: {
        id: updatedItem.id,
        status: updatedItem.status,
        title: updatedItem.title,
      }
    })
    
  } catch (error) {
    console.error("Error updating item:", error)
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    )
  }
}