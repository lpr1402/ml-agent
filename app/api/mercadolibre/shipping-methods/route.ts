import { NextRequest, NextResponse } from "next/server"
import { extractAuthHeader } from "@/lib/auth-server"

export async function GET(request: NextRequest) {
  try {
    const auth = await extractAuthHeader(request)
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    // Get user data first to get site_id
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    })

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: userResponse.status }
      )
    }

    const userData = await userResponse.json()
    const siteId = userData.site_id || "MLB"

    // Fetch shipping methods for the site
    const response = await fetch(
      `https://api.mercadolibre.com/sites/${siteId}/shipping_methods`,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch shipping methods" },
        { status: response.status }
      )
    }

    const methods = await response.json()

    // Create a map for easy lookup
    const methodsMap: Record<string, string> = {}
    methods.forEach((method: any) => {
      methodsMap[method.id] = method.name
    })

    return NextResponse.json({
      methods: methods,
      map: methodsMap
    })
  } catch (error) {
    console.error("Error fetching shipping methods:", error)
    return NextResponse.json(
      { error: "Failed to fetch shipping methods" },
      { status: 500 }
    )
  }
}