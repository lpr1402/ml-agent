import { NextRequest, NextResponse } from "next/server"

const APP_ID = process.env.AUTH_MERCADOLIBRE_ID!
const SECRET = process.env.AUTH_MERCADOLIBRE_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refresh_token } = body
    
    if (!refresh_token) {
      return NextResponse.json({ error: "No refresh token provided" }, { status: 400 })
    }
    
    // Exchange refresh token for new access token
    const tokenParams = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: APP_ID,
      client_secret: SECRET,
      refresh_token: refresh_token,
    })
    
    const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams,
    })
    
    const tokens = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      console.error("Token refresh failed:", tokens)
      return NextResponse.json(
        { error: "Token refresh failed", details: tokens },
        { status: tokenResponse.status }
      )
    }
    
    console.log("Token refreshed successfully")
    
    return NextResponse.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
    })
  } catch (error) {
    console.error("Refresh token error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}