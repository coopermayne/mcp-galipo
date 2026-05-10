import {
  DashboardBrowsingIcon,
  InboxDownloadIcon,
  Briefcase01Icon,
  Briefcase02Icon,
  MoneyBag02Icon,
  Invoice02Icon,
  Task01Icon,
  Calendar03Icon,
  ContactBookIcon,
  SmartPhone01Icon,
  LegalDocument01Icon,
  JusticeScale01Icon,
  UserGroupIcon,
  Activity01Icon,
} from "@hugeicons/core-free-icons"

export type NavItem = {
  title: string
  url: string
  icon: typeof DashboardBrowsingIcon
  featureKey?: string
  items?: { title: string; url: string; separatorBefore?: boolean }[]
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
        title: "My Cases",
        url: "/cases",
        icon: Briefcase01Icon,
        featureKey: "cases",
      },
      {
        title: "All Cases",
        url: "/cases/all",
        icon: Briefcase02Icon,
        featureKey: "cases",
      },
      {
        title: "Financials",
        url: "/financials",
        icon: MoneyBag02Icon,
        featureKey: "financials",
      },
      {
        title: "Invoices",
        url: "/invoices",
        icon: Invoice02Icon,
        featureKey: "invoices",
        items: [
          { title: "All Invoices", url: "/invoices" },
          { title: "Payees", url: "/payees" },
        ],
      },
      {
        title: "Tasks",
        url: "/tasks",
        icon: Task01Icon,
        featureKey: "tasks",
      },
      {
        title: "Calendar",
        url: "/events",
        icon: Calendar03Icon,
        featureKey: "calendar",
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
          { title: "Other", url: "/contacts/other" },
          { title: "Judges", url: "/contacts/judges" },
        ],
      },
      {
        title: "SMS",
        url: "/sms",
        icon: SmartPhone01Icon,
        featureKey: "sms",
      },
    ],
  },
  {
    label: "Tools",
    items: [
      {
        title: "Templates",
        url: "/templates",
        icon: LegalDocument01Icon,
        featureKey: "templates",
        items: [
          { title: "Pleadings", url: "/templates/pleadings" },
          { title: "TOA Generator", url: "/templates/toa" },
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
      {
        title: "Activity",
        url: "/activity",
        icon: Activity01Icon,
      },
    ],
  },
]
