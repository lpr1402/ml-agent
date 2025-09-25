import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"

export async function simpleMLCall(endpoint: string) {
  try {
    const auth = await getAuthenticatedAccount()
    
    if (!auth?.accessToken) {
      return NextResponse.json({ error: "No token" }, { status: 401 })
    }

    const response = await fetch(`https://api.mercadolibre.com${endpoint}`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited - wait a bit and retry once
        await new Promise(resolve => setTimeout(resolve, 1000))
        const retryResponse = await fetch(`https://api.mercadolibre.com${endpoint}`, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            Accept: "application/json",
          },
        })
        if (retryResponse.ok) {
          return NextResponse.json(await retryResponse.json())
        }
      }
      
      return NextResponse.json(
        { error: `ML API error: ${response.status}` },
        { status: response.status }
      )
    }

    return NextResponse.json(await response.json())
  } catch (error) {
    logger.error(`Error calling ML API ${endpoint}:`, { error })
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    )
  }
}