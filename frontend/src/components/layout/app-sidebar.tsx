import { useMemo } from "react"
import { AppSwitcher } from "@/components/layout/app-switcher"
import { NavMain } from "@/components/layout/nav-main"
import { NavUser } from "@/components/layout/nav-user"
import { navGroups } from "@/components/layout/nav-data"
import { useAuth } from "@/hooks/use-auth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()

  const filteredGroups = useMemo(() => {
    return navGroups
      .map((group) => {
        if (group.label === "Admin") {
          return user?.isAdmin ? group : null
        }
        if (user?.visibleFeatures === null || user?.visibleFeatures === undefined) {
          return group
        }
        const filtered = group.items.filter(
          (item) => !item.featureKey || user.visibleFeatures!.includes(item.featureKey)
        )
        return filtered.length > 0 ? { ...group, items: filtered } : null
      })
      .filter(Boolean) as typeof navGroups
  }, [user])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <AppSwitcher />
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
