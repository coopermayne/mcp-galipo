import { useMemo } from "react"
import { Link } from "react-router"
import { NavMain } from "@/components/layout/nav-main"
import { NavUser } from "@/components/layout/nav-user"
import { navGroups } from "@/components/layout/nav-data"
import { OPT_IN_FEATURES } from "@/types/user"
import { useAuth } from "@/hooks/use-auth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()

  const filteredGroups = useMemo(() => {
    return navGroups
      .map((group) => {
        if (group.label === "Admin") {
          return user?.isAdmin ? group : null
        }
        const filtered = group.items.filter((item) => {
          if (item.positions && !(user?.position && item.positions.includes(user.position))) {
            return false
          }
          // Opt-in features are hidden unless explicitly enabled for the user,
          // even when visibleFeatures is null (full access).
          if (item.featureKey && (OPT_IN_FEATURES as string[]).includes(item.featureKey)) {
            const enabled = user?.visibleFeatures as readonly string[] | null | undefined
            return Boolean(enabled?.includes(item.featureKey))
          }
          if (user?.visibleFeatures === null || user?.visibleFeatures === undefined) {
            return true
          }
          return !item.featureKey || user.visibleFeatures.includes(item.featureKey)
        })
        return filtered.length > 0 ? { ...group, items: filtered } : null
      })
      .filter(Boolean) as typeof navGroups
  }, [user])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <Link to="/" className="truncate text-base font-semibold group-data-[collapsible=icon]:hidden hover:opacity-70 transition-opacity">Galipo</Link>
              <SidebarTrigger className="ml-auto group-data-[collapsible=icon]:ml-0" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={filteredGroups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
