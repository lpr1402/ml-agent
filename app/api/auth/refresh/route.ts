import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { oauthTokenExchange } from '@/lib/api/oauth-rate-limiter'

const APP_ID = process.env['ML_CLIENT_ID']!
const SECRET = process.env['ML_CLIENT_SECRET']!

export async function POST(_request: Request) {
  try {
    const body = await _request.json()
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
    
    // Usar oauthTokenExchange com rate limiting global para evitar erro 429
    const tokenResponse = await oauthTokenExchange(
      "https://api.mercadolibre.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams,
      }
    )
    
    const tokens = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      logger.error("Token refresh failed:", { error: { error: tokens } })
      return NextResponse.json(
        { error: "Token refresh failed", details: tokens },
        { status: tokenResponse.status }
      )
    }
    
    logger.info("Token refreshed successfully")
    
    return NextResponse.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
    })
  } catch (error) {
    logger.error("Refresh token error:", { error })
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}