import {
  InboxDownloadIcon,
  Task01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

export type NavItem = {
  title: string
  url: string
  icon: typeof InboxDownloadIcon
  featureKey?: string
  positions?: string[]
  items?: { title: string; url: string; separatorBefore?: boolean; disabled?: boolean }[]
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: "Manage",
    items: [
      {
        title: "Intakes",
        url: "/intakes",
        icon: InboxDownloadIcon,
        featureKey: "intakes",
      },
      {
        title: "Your Tasks",
        url: "/your-tasks",
        icon: Task01Icon,
        featureKey: "tasks",
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        title: "Users",
        url: "/users",
        icon: UserGroupIcon,
      },
    ],
  },
]
