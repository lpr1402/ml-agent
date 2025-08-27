export class APIClient {
  private getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ml_access_token")
    }
    return null
  }

  private getHeaders(): HeadersInit {
    const token = this.getToken()
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    }
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
    
    return headers
  }

  async get(url: string) {
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    })
    
    if (!response.ok) {
      console.error(`API call failed: ${url} - Status: ${response.status}`)
      
      if (response.status === 401) {
        // Only clear tokens and redirect if it's a real auth failure
        // Not on initial load or temporary network issues
        console.warn("401 Unauthorized - Token may be expired")
        
        // Give it a moment to ensure it's not a race condition
        setTimeout(() => {
          const currentToken = localStorage.getItem("ml_access_token")
          if (!currentToken) {
            // Already logged out, don't redirect again
            return
          }
          
          // Clear auth and redirect
          localStorage.removeItem("ml_access_token")
          localStorage.removeItem("ml_refresh_token")
          localStorage.removeItem("ml_user_id")
          localStorage.removeItem("ml_user_name")
          localStorage.removeItem("ml_user_email")
          localStorage.removeItem("ml_expires_at")
          window.location.href = "/login"
        }, 1000)
        
        throw new Error("Unauthorized")
      }
      throw new Error(`API call failed: ${response.statusText}`)
    }
    
    return response.json()
  }

  async post(url: string, data?: any) {
    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    })
    
    if (!response.ok) {
      console.error(`API POST failed: ${url} - Status: ${response.status}`)
      
      // Try to get error details from response
      let errorDetails = response.statusText
      try {
        const errorBody = await response.json()
        if (errorBody.error) {
          errorDetails = errorBody.error
        }
        console.error("Error details:", errorBody)
      } catch (e) {
        // Response might not be JSON
      }
      
      if (response.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("ml_access_token")
          localStorage.removeItem("ml_refresh_token")
          localStorage.removeItem("ml_user_id")
          localStorage.removeItem("ml_user_name")
          localStorage.removeItem("ml_user_email")
          localStorage.removeItem("ml_expires_at")
          window.location.href = "/login"
        }
        throw new Error("Unauthorized")
      }
      throw new Error(`API call failed: ${errorDetails}`)
    }
    
    return response.json()
  }

  async put(url: string, data?: any) {
    const response = await fetch(url, {
      method: "PUT",
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    })
    
    if (!response.ok) {
      if (response.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("ml_access_token")
          localStorage.removeItem("ml_refresh_token")
          localStorage.removeItem("ml_user_id")
          localStorage.removeItem("ml_user_name")
          localStorage.removeItem("ml_user_email")
          localStorage.removeItem("ml_expires_at")
          window.location.href = "/login"
        }
        throw new Error("Unauthorized")
      }
      throw new Error(`API call failed: ${response.statusText}`)
    }
    
    return response.json()
  }

  async patch(url: string, data?: any) {
    const response = await fetch(url, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    })
    
    if (!response.ok) {
      if (response.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("ml_access_token")
          localStorage.removeItem("ml_refresh_token")
          localStorage.removeItem("ml_user_id")
          localStorage.removeItem("ml_user_name")
          localStorage.removeItem("ml_user_email")
          localStorage.removeItem("ml_expires_at")
          window.location.href = "/login"
        }
        throw new Error("Unauthorized")
      }
      throw new Error(`API call failed: ${response.statusText}`)
    }
    
    return response.json()
  }
}

export const apiClient = new APIClient()