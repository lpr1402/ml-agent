import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verify } from "jsonwebtoken"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("authjs.session-token")?.value
    
    if (!sessionToken) {
      return NextResponse.json(null, { status: 401 })
    }
    
    const secret = process.env.AUTH_SECRET || process.env.AUTH_MERCADOLIBRE_SECRET || "jy9KhpXPASCMVsmUuZ2LBtZEhIhsqWha"
    
    try {
      const decoded = verify(sessionToken, secret) as any
      return NextResponse.json(decoded)
    } catch {
      return NextResponse.json(null, { status: 401 })
    }
  } catch (error) {
    return NextResponse.json(null, { status: 500 })
  }
}