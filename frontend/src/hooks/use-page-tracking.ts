import { useEffect, useRef } from "react"
import { useLocation } from "react-router"
import { apiFetch } from "@/lib/api"

/**
 * Tracks page views by sending the current path to the backend
 * whenever the route changes. Debounced to avoid duplicate fires.
 */
export function usePageTracking() {
  const location = useLocation()
  const lastPath = useRef<string>("")

  useEffect(() => {
    const path = location.pathname
    if (path === lastPath.current) return
    lastPath.current = path

    // Fire and forget — don't block rendering
    apiFetch("/api/v1/tracking/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }).catch(() => {
      // Silently ignore tracking failures
    })
  }, [location.pathname])
}
