import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

export async function GET(_request: Request) {
  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    
    // Verificar todos os cookies
    const cookiesInfo = allCookies.map(c => ({
      name: c.name,
      valueLength: c.value?.length || 0,
      hasValue: !!c.value
    }))
    
    // Buscar sessão com cookie padronizado
    const sessionToken = cookieStore.get("ml-agent-session")?.value
    
    // Contar sessões ativas no banco
    const activeSessions = await prisma.session.count({
      where: {
        expiresAt: {
          gt: new Date()
        }
      }
    })
    
    // Contar organizações
    const organizations = await prisma.organization.count()
    
    // Contar contas ML
    const mlAccounts = await prisma.mLAccount.count({
      where: { isActive: true }
    })
    
    return NextResponse.json({
      debug: true,
      cookies: cookiesInfo,
      hasSessionToken: !!sessionToken,
      sessionTokenLength: sessionToken?.length || 0,
      database: {
        activeSessions,
        organizations,
        activeMLAccounts: mlAccounts
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error('[Debug] Error:', { error })
    return NextResponse.json({
      error: String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}