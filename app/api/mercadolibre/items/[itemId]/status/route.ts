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
    const { status } = body

    // Validate status
    if (!["active", "paused", "closed"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'active', 'paused', or 'closed'" },
        { status: 400 }
      )
    }

    // Update item status in Mercado Livre
    const response = await fetch(
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

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.message || "Failed to update item status" },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      id: data.id,
      status: data.status,
      message: `Item ${status === 'active' ? 'activated' : status === 'paused' ? 'paused' : 'closed'} successfully`
    })
  } catch (error) {
    console.error("Error updating item status:", error)
    return NextResponse.json(
      { error: "Failed to update item status" },
      { status: 500 }
    )
  }
}