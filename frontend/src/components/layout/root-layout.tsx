import { Navigate, Outlet } from "react-router"
import { useAuth } from "@/hooks/use-auth"
import { useSSE } from "@/hooks/use-sse"
import {
  BreadcrumbLabelContext,
  useBreadcrumbLabelProvider,
} from "@/hooks/use-breadcrumb-label"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Header } from "@/components/layout/header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

export function RootLayout() {
  const { user, isLoading } = useAuth()
  const breadcrumbLabel = useBreadcrumbLabelProvider()
  useSSE()

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <TooltipProvider>
      <BreadcrumbLabelContext.Provider value={breadcrumbLabel}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <Header />
            <main className="w-full max-w-[1600px] flex-1 overflow-auto">
              <Outlet />
            </main>
          </SidebarInset>
        </SidebarProvider>
      </BreadcrumbLabelContext.Provider>
    </TooltipProvider>
  )
}
