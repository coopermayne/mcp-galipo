import { Navigate, Outlet } from "react-router"
import { useAuth } from "@/hooks/use-auth"
import { useSSE } from "@/hooks/use-sse"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

export function RootLayout() {
  const { user, isLoading } = useAuth()
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
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex h-10 items-center px-4 md:hidden">
            <SidebarTrigger />
          </div>
          <div className="mx-auto w-full max-w-[1600px] flex-1 overflow-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
