import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "../base"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request)
    
    if (!auth?.accessToken) {
      console.log("No access token found in request headers")
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    console.log("Fetching user data with token...")
    const response = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      console.error(`Mercado Libre API error: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error("Error details:", errorText)
      
      // If ML API returns 401, the token is invalid/expired
      if (response.status === 401) {
        return NextResponse.json({ error: "Token expired" }, { status: 401 })
      }
      
      throw new Error(`Failed to fetch user: ${response.statusText}`)
    }

    const userData = await response.json()
    console.log("User data fetched successfully:", userData.nickname)
    
    return NextResponse.json(userData)
  } catch (error) {
    console.error("Error fetching user data:", error)
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    )
  }
}