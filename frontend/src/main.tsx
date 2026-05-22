import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthContext, useAuthProvider } from "@/hooks/use-auth"
import { ThemeContext, useThemeProvider } from "@/hooks/use-theme"
import { RootLayout } from "@/components/layout/root-layout"
import { Toaster } from "@/components/ui/sonner"
import LoginPage from "@/pages/login"

import "./index.css"

function lazy(importFn: () => Promise<{ default: React.ComponentType }>) {
  return () =>
    importFn()
      .then((m) => ({ Component: m.default }))
      .catch((err) => {
        if (
          err.message?.includes("Failed to fetch dynamically imported module") ||
          err.message?.includes("Importing a module script failed")
        ) {
          window.location.reload()
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
      { index: true, lazy: lazy(() => import("@/pages/dashboard")) },
      { path: "intakes", lazy: lazy(() => import("@/pages/intakes")) },
      { path: "intakes/:id", lazy: lazy(() => import("@/pages/intakes/detail")) },
      { path: "cases", lazy: lazy(() => import("@/pages/cases")) },
      { path: "cases/all", lazy: lazy(() => import("@/pages/cases/all")) },
      { path: "financials", lazy: lazy(() => import("@/pages/financials")) },
      { path: "invoices", lazy: lazy(() => import("@/pages/invoices")) },
      { path: "payees", lazy: lazy(() => import("@/pages/payees")) },
      { path: "cases/:id", lazy: lazy(() => import("@/pages/cases/detail")) },
      { path: "cases/:id/costs", lazy: lazy(() => import("@/pages/cases/costs")) },
      { path: "tasks", lazy: lazy(() => import("@/pages/tasks")) },
      { path: "events", lazy: lazy(() => import("@/pages/events")) },
      { path: "trial-calendar", lazy: lazy(() => import("@/pages/trial-calendar")) },
      { path: "contacts/*", lazy: lazy(() => import("@/pages/contacts")) },
      { path: "judges", lazy: lazy(() => import("@/pages/judges")) },
      { path: "templates/*", lazy: lazy(() => import("@/pages/templates")) },
      { path: "court-listener", lazy: lazy(() => import("@/pages/court-listener")) },
      { path: "sms", lazy: lazy(() => import("@/pages/sms")) },
      { path: "sms/:id", lazy: lazy(() => import("@/pages/sms/detail")) },
      { path: "users", lazy: lazy(() => import("@/pages/users")) },
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
