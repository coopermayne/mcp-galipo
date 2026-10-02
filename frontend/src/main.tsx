import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthContext, useAuthProvider } from "@/hooks/use-auth"
import { ThemeContext, useThemeProvider } from "@/hooks/use-theme"
import { RootLayout } from "@/components/layout/root-layout"
import { Toaster } from "@/components/ui/sonner"
import { Navigate } from "react-router"
import LoginPage from "@/pages/login"

import "./index.css"

// A stale-chunk error happens when a new deploy replaces the hashed asset
// files this tab was built against, so a lazy route import 404s. The fix is
// to reload (the fresh index.html points at the new chunk names).
function isStaleChunkError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? ""
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module")
  )
}

// Reload once to pick up the new build. The sessionStorage guard prevents an
// infinite reload loop if the asset is genuinely missing (not just stale):
// if we already reloaded in the last 10s and it still fails, give up and let
// the real error surface instead of looping.
const STALE_CHUNK_KEY = "stale-chunk-reload-ts"
function recoverFromStaleChunk(): boolean {
  const last = Number(sessionStorage.getItem(STALE_CHUNK_KEY) || 0)
  if (Date.now() - last < 10_000) return false
  sessionStorage.setItem(STALE_CHUNK_KEY, String(Date.now()))
  window.location.reload()
  return true
}

// Backstop for preload (modulepreload) failures that don't flow through lazy().
window.addEventListener("vite:preloadError", (event) => {
  if (recoverFromStaleChunk()) event.preventDefault()
})

function lazy(importFn: () => Promise<{ default: React.ComponentType }>) {
  return () =>
    importFn()
      .then((m) => {
        // A stale chunk can *resolve* to undefined (or without a default export)
        // instead of rejecting. Reading m.default would throw
        // "Cannot read properties of undefined (reading 'default')", which
        // isStaleChunkError doesn't match — so normalize it into a stale error.
        if (!m?.default) {
          throw new Error("Failed to fetch dynamically imported module")
        }
        return { Component: m.default }
      })
      .catch((err) => {
        // If we can recover, return a never-resolving promise so React shows
        // the route fallback (not the error screen) while the reload happens.
        if (isStaleChunkError(err) && recoverFromStaleChunk()) {
          return new Promise<never>(() => {})
        }
        throw err
      })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createBrowserRouter([
  { path: "login", element: <LoginPage /> },
  {
    element: <RootLayout />,
    hydrateFallbackElement: <div />,
    children: [
      { index: true, element: <Navigate to="/intakes" replace /> },
      { path: "intakes", lazy: lazy(() => import("@/pages/intakes")) },
      { path: "intakes/:id", lazy: lazy(() => import("@/pages/intakes/detail")) },
      { path: "your-tasks", lazy: lazy(() => import("@/pages/tasks")) },
      { path: "tasks", element: <Navigate to="/your-tasks" replace /> },
      { path: "users", lazy: lazy(() => import("@/pages/users")) },
      { path: "*", element: <Navigate to="/intakes" replace /> },
    ],
  },
])

function App() {
  const authValue = useAuthProvider()
  const themeValue = useThemeProvider()

  return (
    <AuthContext.Provider value={authValue}>
      <QueryClientProvider client={queryClient}>
        <ThemeContext.Provider value={themeValue}>
          <RouterProvider router={router} />
          <Toaster />
        </ThemeContext.Provider>
      </QueryClientProvider>
    </AuthContext.Provider>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
