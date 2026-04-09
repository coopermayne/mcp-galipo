import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { AuthUser } from "@/types/auth"
import * as authService from "@/services/auth"

type AuthContextValue = {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuthProvider(): AuthContextValue {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const clearSession = useCallback(() => {
    localStorage.removeItem("token")
    setUser(null)
  }, [])

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      setIsLoading(false)
      return
    }

    authService
      .verifyToken()
      .then((res) => {
        if (res.success && res.valid) {
          setUser(res.user)
          // Store refreshed token to extend session
          if (res.token) {
            localStorage.setItem("token", res.token)
          }
        } else {
          clearSession()
        }
      })
      .catch(() => {
        // Network error (e.g. server restarting during deploy) —
        // keep the token so the user isn't logged out. The 401
        // handler in apiFetch will clear the session if the token
        // is actually invalid once the server comes back.
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [clearSession])

  // Listen for 401 logout events from apiFetch
  useEffect(() => {
    const handler = () => clearSession()
    window.addEventListener("auth:logout", handler)
    return () => window.removeEventListener("auth:logout", handler)
  }, [clearSession])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authService.login(email, password)
    if (res.success) {
      localStorage.setItem("token", res.token)
      setUser(res.user)
      return {}
    }
    return { error: res.error?.message ?? "Invalid credentials" }
  }, [])

  const logout = useCallback(() => {
    authService.logout().catch(() => {})
    clearSession()
  }, [clearSession])

  return { user, isLoading, login, logout }
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
