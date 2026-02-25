export const ROLE_CATEGORIES = [
  { value: "client", label: "Clients", urlSegment: "clients" },
  { value: "counsel", label: "Counsel", urlSegment: "counsel" },
  { value: "defendant", label: "Defendants", urlSegment: "defendants" },
  { value: "expert", label: "Experts", urlSegment: "experts" },
  { value: "mediator", label: "Mediators", urlSegment: "mediators" },
  { value: "other", label: "Other", urlSegment: "other" },
] as const

export type RoleCategoryValue = (typeof ROLE_CATEGORIES)[number]["value"]

export function categoryFromSegment(segment: string | undefined): string | undefined {
  if (!segment) return undefined
  return ROLE_CATEGORIES.find((c) => c.urlSegment === segment)?.value
}

export function categoryLabel(category: string): string {
  return ROLE_CATEGORIES.find((c) => c.value === category)?.label ?? category
}

export function formatRoleName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatPhone(phone: { value: string; type?: string }): string {
  return phone.value
}

export function formatEmail(email: { value: string; type?: string }): string {
  return email.value
}
