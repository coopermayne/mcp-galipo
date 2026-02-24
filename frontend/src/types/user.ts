export type UserPosition = "attorney" | "paralegal" | "manager" | "admin"

export type FeatureKey =
  | "dashboard"
  | "intakes"
  | "cases"
  | "tasks"
  | "calendar"
  | "contacts"
  | "templates"
  | "court-listener"

export const FEATURE_OPTIONS: { value: FeatureKey; label: string }[] = [
  { value: "dashboard", label: "Dashboard" },
  { value: "intakes", label: "Intakes" },
  { value: "cases", label: "Cases" },
  { value: "tasks", label: "Tasks" },
  { value: "calendar", label: "Calendar" },
  { value: "contacts", label: "Contacts" },
  { value: "templates", label: "Templates" },
  { value: "court-listener", label: "CourtListener" },
]

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
