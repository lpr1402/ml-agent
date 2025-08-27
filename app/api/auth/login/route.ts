import { NextResponse } from "next/server"
import crypto from "crypto"
import { cookies } from "next/headers"

function base64URLEncode(str: Buffer) {
  return str.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

function sha256(buffer: string) {
  return crypto.createHash("sha256").update(buffer).digest()
}

export async function GET() {
  // Generate PKCE code_verifier and code_challenge
  const codeVerifier = base64URLEncode(crypto.randomBytes(32))
  const codeChallenge = base64URLEncode(sha256(codeVerifier))
  
  // Store code_verifier in cookie
  const cookieStore = await cookies()
  const isProduction = process.env.NODE_ENV === "production"
  cookieStore.set("code_verifier", codeVerifier, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15, // 15 minutes
  })
  
  // Build OAuth URL with PKCE
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.AUTH_MERCADOLIBRE_ID!,
    redirect_uri: process.env.AUTH_MERCADOLIBRE_REDIRECT_URI!,
    scope: "offline_access read write",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })
  
  const authUrl = `https://auth.mercadolivre.com.br/authorization?${params.toString()}`
  
  return NextResponse.redirect(authUrl)
}