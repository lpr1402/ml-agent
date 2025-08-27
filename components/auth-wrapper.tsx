"use client"

import { useTokenRefresh } from "@/hooks/use-token-refresh"
import { ReactNode } from "react"

export function AuthWrapper({ children }: { children: ReactNode }) {
  // This hook manages automatic token refresh
  useTokenRefresh()
  
  return <>{children}</>
}