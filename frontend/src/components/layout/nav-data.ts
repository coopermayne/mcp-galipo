import {
  DashboardBrowsingIcon,
  InboxDownloadIcon,
  Briefcase01Icon,
  Task01Icon,
  Calendar03Icon,
  ContactBookIcon,
  LegalDocument01Icon,
  JusticeScale01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

export type NavItem = {
  title: string
  url: string
  icon: typeof DashboardBrowsingIcon
  featureKey?: string
  items?: { title: string; url: string }[]
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: "Main",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: DashboardBrowsingIcon,
        featureKey: "dashboard",
      },
      {
        title: "Intakes",
        url: "/intakes",
        icon: InboxDownloadIcon,
        featureKey: "intakes",
      },
      {
        title: "Cases",
        url: "/cases",
        icon: Briefcase01Icon,
        featureKey: "cases",
      },
      {
        title: "Tasks",
        url: "/tasks",
        icon: Task01Icon,
        featureKey: "tasks",
      },
      {
        title: "Events",
        url: "/events",
        icon: Calendar03Icon,
        featureKey: "events",
      },
      {
        title: "Contacts",
        url: "/contacts",
        icon: ContactBookIcon,
        featureKey: "contacts",
        items: [
          { title: "Clients", url: "/contacts/clients" },
          { title: "Counsel", url: "/contacts/counsel" },
          { title: "Experts", url: "/contacts/experts" },
          { title: "Defendants", url: "/contacts/defendants" },
          { title: "Mediators", url: "/contacts/mediators" },
          { title: "Judges", url: "/contacts/judges" },
          { title: "Other", url: "/contacts/other" },
        ],
      },
      {
        title: "Templates",
        url: "/templates",
        icon: LegalDocument01Icon,
        featureKey: "templates",
        items: [
          { title: "Pleadings", url: "/templates/pleadings" },
          { title: "RFP", url: "/templates/rfp" },
          { title: "Case List", url: "/templates/case-list" },
          { title: "Retainer", url: "/templates/retainer" },
          { title: "Disbursement", url: "/templates/disbursement" },
        ],
      },
      {
        title: "CourtListener",
        url: "/court-listener",
        icon: JusticeScale01Icon,
        featureKey: "court-listener",
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
