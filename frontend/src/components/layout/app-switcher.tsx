import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import { UnfoldMoreIcon, Briefcase01Icon, MicroscopeIcon } from "@hugeicons/core-free-icons"

const apps = [
  {
    name: "Case Manager",
    icon: Briefcase01Icon,
    description: "Active",
    disabled: false,
  },
  {
    name: "Research",
    icon: MicroscopeIcon,
    description: "Coming Soon",
    disabled: true,
  },
]

export function AppSwitcher() {
  const { isMobile } = useSidebar()
  const activeApp = apps[0]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <HugeiconsIcon icon={activeApp.icon} strokeWidth={2} size={18} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeApp.name}</span>
                <span className="truncate text-xs">{activeApp.description}</span>
              </div>
              <HugeiconsIcon icon={UnfoldMoreIcon} strokeWidth={2} className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Applications
            </DropdownMenuLabel>
            {apps.map((app) => (
              <DropdownMenuItem
                key={app.name}
                disabled={app.disabled}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <HugeiconsIcon icon={app.icon} strokeWidth={2} size={14} />
                </div>
                <span>{app.name}</span>
                {app.disabled && (
                  <span className="text-muted-foreground ml-auto text-xs">
                    Coming Soon
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
