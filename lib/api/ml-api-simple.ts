import { getAuthenticatedAccount } from "./session-auth"

// SIMPLE API CALL - NO BULLSHIT
export async function callMLApi(endpoint: string) {
  const auth = await getAuthenticatedAccount()
  
  if (!auth?.accessToken) {
    throw new Error("No access token")
  }

  const response = await fetch(`https://api.mercadolibre.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: "application/json",
    },
  })

  if (response.status === 429) {
    // ML is rate limiting us - wait a bit and try once more
    await new Promise(resolve => setTimeout(resolve, 2000))
    const retryResponse = await fetch(`https://api.mercadolibre.com${endpoint}`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        Accept: "application/json",
      },
    })
    if (retryResponse.ok) {
      return await retryResponse.json()
    }
    throw new Error(`ML API rate limited: ${endpoint}`)
  }

  if (!response.ok) {
    throw new Error(`ML API error ${response.status}: ${endpoint}`)
  }

  return await response.json()
}