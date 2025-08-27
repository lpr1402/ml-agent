import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { storeUserSession } from "@/lib/session-store"
import { storeUserTokens } from "@/lib/token-manager"

const APP_ID = process.env.AUTH_MERCADOLIBRE_ID!
const SECRET = process.env.AUTH_MERCADOLIBRE_SECRET!
const REDIRECT_URI = process.env.AUTH_MERCADOLIBRE_REDIRECT_URI!

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  
  console.log("OAuth callback received - code:", code, "error:", error)
  
  if (error) {
    return NextResponse.redirect(new URL(`/auth/error?error=${error}`, request.url))
  }
  
  if (!code) {
    return NextResponse.redirect(new URL("/auth/error?error=NoCode", request.url))
  }
  
  try {
    // Get code_verifier from cookie
    const cookieStore = await cookies()
    const codeVerifierCookie = cookieStore.get("code_verifier")
    const codeVerifier = codeVerifierCookie?.value || ""
    
    // Exchange code for token - EXACTLY as documented by Mercado Livre
    const tokenParams: Record<string, string> = {
      grant_type: "authorization_code",
      client_id: APP_ID,
      client_secret: SECRET,
      code: code,
      redirect_uri: REDIRECT_URI,
    }
    
    // Add code_verifier if present (PKCE flow)
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier
    }
    
    console.log("Exchanging code for token...")
    
    const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(tokenParams),
    })
    
    const tokens = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", tokens)
      return NextResponse.redirect(
        new URL(`/auth/error?error=TokenExchange&message=${encodeURIComponent(tokens.message || tokens.error || "Unknown error")}`, request.url)
      )
    }
    
    console.log("Token exchange successful, getting user info...")
    console.log("ACCESS_TOKEN:", tokens.access_token)
    
    // Get user info
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })
    
    const user = await userResponse.json()
    
    if (!userResponse.ok) {
      console.error("User info fetch failed:", user)
      return NextResponse.redirect(new URL("/auth/error?error=UserInfo", request.url))
    }
    
    console.log("User authenticated:", user.nickname)
    
    // Store session in server memory for immediate access
    storeUserSession({
      userId: user.id.toString(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      nickname: user.nickname
    })
    
    // Store tokens in database for 24/7 operation
    try {
      await storeUserTokens({
        userId: user.id.toString(),
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in
      })
      console.log(`[Auth] Tokens stored in database for user ${user.id}`)
    } catch (dbError) {
      console.error(`[Auth] Failed to store tokens in database:`, dbError)
      // Continue - session is already in memory
    }
    
    // Redirect to success page with all needed data as query params
    // Following ML documentation - redirect_uri must match exactly
    const tunnelUrl = "https://arabic-breeding-greatly-citizens.trycloudflare.com"
    const successUrl = new URL("/auth/success", tunnelUrl)
    
    // Pass essential data via URL params (they will be immediately stored and removed from URL)
    successUrl.searchParams.set("access_token", tokens.access_token)
    successUrl.searchParams.set("refresh_token", tokens.refresh_token)
    successUrl.searchParams.set("user_id", user.id.toString())
    successUrl.searchParams.set("user_name", user.nickname)
    successUrl.searchParams.set("user_email", user.email || "")
    successUrl.searchParams.set("expires_in", tokens.expires_in.toString())
    
    return NextResponse.redirect(successUrl)
    
  } catch (error) {
    console.error("OAuth callback error:", error)
    return NextResponse.redirect(
      new URL(`/auth/error?error=Unknown&message=${encodeURIComponent(String(error))}`, request.url)
    )
  }
}