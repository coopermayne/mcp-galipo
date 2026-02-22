import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeContext, useThemeProvider } from "@/hooks/use-theme"
import { RootLayout } from "@/components/layout/root-layout"
import { Toaster } from "@/components/ui/sonner"

import "./index.css"

function lazy(importFn: () => Promise<{ default: React.ComponentType }>) {
  return () => importFn().then((m) => ({ Component: m.default }))
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
  {
    element: <RootLayout />,
    children: [
      { index: true, lazy: lazy(() => import("@/pages/dashboard")) },
      { path: "intakes", lazy: lazy(() => import("@/pages/intakes")) },
      { path: "cases", lazy: lazy(() => import("@/pages/cases")) },
      { path: "tasks", lazy: lazy(() => import("@/pages/tasks")) },
      { path: "calendar", lazy: lazy(() => import("@/pages/calendar")) },
      { path: "contacts/*", lazy: lazy(() => import("@/pages/contacts")) },
      { path: "templates/*", lazy: lazy(() => import("@/pages/templates")) },
      { path: "court-listener", lazy: lazy(() => import("@/pages/court-listener")) },
      { path: "users", lazy: lazy(() => import("@/pages/users")) },
    ],
  },
])

function App() {
  const themeValue = useThemeProvider()

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContext.Provider value={themeValue}>
        <RouterProvider router={router} />
        <Toaster />
      </ThemeContext.Provider>
    </QueryClientProvider>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
