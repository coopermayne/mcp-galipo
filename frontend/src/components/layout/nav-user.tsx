import { useState } from "react"
import { getAvatarStyleById } from "@/lib/badge-colors"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UnfoldMoreIcon,
  Settings05Icon,
  Moon02Icon,
  Sun01Icon,
  Logout01Icon,
  Alert01Icon,
} from "@hugeicons/core-free-icons"
import { useTheme } from "@/hooks/use-theme"
import { useAuth } from "@/hooks/use-auth"
import { SettingsDialog } from "@/components/common/settings-dialog"

export function NavUser() {
  const { isMobile } = useSidebar()
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const displayName = user
    ? `${user.firstName} ${user.lastName}`
    : "User"
  const displayEmail = user?.email ?? ""
  const initials = user?.initials ?? "U"

  return (
    <SidebarMenu>
      {user?.mustChangePassword && (
        <SidebarMenuItem>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="You're using a default password. Click to change it."
            className="flex w-full animate-bounce items-center gap-2 border border-warning/40 bg-warning/15 px-2 py-1.5 text-left text-xs font-medium text-warning transition-colors hover:bg-warning/25 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <HugeiconsIcon icon={Alert01Icon} size={16} strokeWidth={2} className="shrink-0" />
            <span className="truncate group-data-[collapsible=icon]:hidden">
              Change your password
            </span>
          </button>
        </SidebarMenuItem>
      )}
      <SidebarMenuItem>
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg" style={user ? getAvatarStyleById(user.id) : undefined}>{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs">{displayEmail}</span>
              </div>
              <HugeiconsIcon icon={UnfoldMoreIcon} strokeWidth={2} className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg" style={user ? getAvatarStyleById(user.id) : undefined}>{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs">{displayEmail}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <HugeiconsIcon icon={Settings05Icon} strokeWidth={2} />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme}>
                <HugeiconsIcon
                  icon={theme === "dark" ? Sun01Icon : Moon02Icon}
                  strokeWidth={2}
                />
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
