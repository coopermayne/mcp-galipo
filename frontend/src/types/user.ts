export type UserPosition = "attorney" | "paralegal" | "manager" | "admin"

export type FeatureKey =
  | "dashboard"
  | "intakes"
  | "cases"
  | "case-detail"
  | "case-health"
  | "financials"
  | "invoices"
  | "tasks"
  | "calendar"
  | "trial-calendar"
  | "contacts"
  | "templates"
  | "court-listener"
  | "ai-chat"
  | "log-my-day"

export const FEATURE_OPTIONS: { value: FeatureKey; label: string }[] = [
  { value: "dashboard", label: "Dashboard" },
  { value: "intakes", label: "Intakes" },
  { value: "cases", label: "Cases" },
  { value: "case-detail", label: "Case Detail Page" },
  { value: "case-health", label: "Case Health" },
  { value: "financials", label: "Financials" },
  { value: "invoices", label: "Invoices" },
  { value: "tasks", label: "Tasks" },
  { value: "calendar", label: "Calendar" },
  { value: "trial-calendar", label: "Trial Calendar" },
  { value: "contacts", label: "Contacts" },
  { value: "templates", label: "Templates" },
  { value: "court-listener", label: "CourtListener" },
  { value: "ai-chat", label: "AI Chat" },
  { value: "log-my-day", label: "Log My Day" },
]

/**
 * Opt-in features are hidden unless explicitly enabled for a user — even when
 * visibleFeatures is null (full access). They are excluded from DEFAULT_FEATURES.
 */
export const OPT_IN_FEATURES: FeatureKey[] = ["ai-chat", "case-health", "log-my-day"]

/** Features enabled when visibleFeatures is null (full access). Opt-in features excluded. */
export const DEFAULT_FEATURES: FeatureKey[] = FEATURE_OPTIONS
  .filter((f) => !OPT_IN_FEATURES.includes(f.value))
  .map((f) => f.value)

export interface User {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  initials: string | null
  position: UserPosition | null
  barNumber: string | null
  isAdmin: boolean
  mustChangePassword: boolean
  isActive: boolean
  paralegalId: number | null
  visibleFeatures: FeatureKey[] | null
  createdAt: string | null
  updatedAt: string | null
  lastActiveAt: string | null
  paralegal: {
    id: number
    firstName: string | null
    lastName: string | null
    initials: string | null
  } | null
}

export interface UsersResponse {
  success: boolean
  data: User[]
}

export interface UserResponse {
  success: boolean
  data: User
}
