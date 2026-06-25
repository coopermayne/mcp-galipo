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
