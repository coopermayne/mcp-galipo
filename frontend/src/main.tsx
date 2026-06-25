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
      .then((m) => ({ Component: m.default }))
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
  { path: "admin/dale-link", lazy: lazy(() => import("@/pages/dale-link")) },
  { path: "dale/auth/:token", lazy: lazy(() => import("@/pages/dale/auth")) },
  {
    path: "dale",
    lazy: lazy(() => import("@/pages/dale/layout")),
    children: [
      { index: true, lazy: lazy(() => import("@/pages/dale/cases-list")) },
      { path: "cases/:caseId", lazy: lazy(() => import("@/pages/dale/case-detail")) },
      { path: "calendar", lazy: lazy(() => import("@/pages/dale/calendar")) },
    ],
  },
  {
    element: <RootLayout />,
    hydrateFallbackElement: <div />,
    children: [
      { index: true, lazy: lazy(() => import("@/pages/dashboard")) },
      { path: "intakes", lazy: lazy(() => import("@/pages/intakes")) },
      { path: "intakes/:id", lazy: lazy(() => import("@/pages/intakes/detail")) },
      { path: "cases", lazy: lazy(() => import("@/pages/cases/all")) },
      { path: "cases/all", element: <Navigate to="/cases" replace /> },
      { path: "your-cases", lazy: lazy(() => import("@/pages/cases")) },
      { path: "financials", lazy: lazy(() => import("@/pages/financials")) },
      { path: "invoices", lazy: lazy(() => import("@/pages/invoices")) },
      { path: "payees", lazy: lazy(() => import("@/pages/payees")) },
      { path: "cases/:id", lazy: lazy(() => import("@/pages/cases/detail")) },
      { path: "cases/:id/costs", lazy: lazy(() => import("@/pages/cases/costs")) },
      { path: "your-tasks", lazy: lazy(() => import("@/pages/tasks")) },
      { path: "tasks", element: <Navigate to="/your-tasks" replace /> },
      { path: "log", lazy: lazy(() => import("@/pages/worklog")) },
      { path: "your-events", lazy: lazy(() => import("@/pages/events")) },
      { path: "events", element: <Navigate to="/your-events" replace /> },
      { path: "trial-calendar", lazy: lazy(() => import("@/pages/trial-calendar")) },
      { path: "case-health", lazy: lazy(() => import("@/pages/case-health")) },
      { path: "contacts/*", lazy: lazy(() => import("@/pages/contacts")) },
      { path: "judges", lazy: lazy(() => import("@/pages/judges")) },
      { path: "jurisdictions", lazy: lazy(() => import("@/pages/jurisdictions")) },
      { path: "templates/*", lazy: lazy(() => import("@/pages/templates")) },
      { path: "court-listener", lazy: lazy(() => import("@/pages/court-listener")) },
      { path: "sms", lazy: lazy(() => import("@/pages/sms")) },
      { path: "sms/:id", lazy: lazy(() => import("@/pages/sms/detail")) },
      { path: "users", lazy: lazy(() => import("@/pages/users")) },
      { path: "people-types", lazy: lazy(() => import("@/pages/people-types")) },
      { path: "activity", lazy: lazy(() => import("@/pages/activity")) },
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
