import type { PersonListItem } from "@/types/person"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SmartPhone01Icon,
  Mail01Icon,
  Building06Icon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getBadgeStyle, getAvatarStyleById } from "@/lib/badge-colors"
import { formatRoleName } from "@/pages/contacts/contact-data"

interface ContactListItemProps {
  person: PersonListItem
  onClick: (person: PersonListItem) => void
  hideCategoryBadge?: boolean
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function ContactListItem({
  person,
  onClick,
  hideCategoryBadge,
}: ContactListItemProps) {
  const primaryPhone = person.phones?.[0]
  const primaryEmail = person.emails?.[0]
  const roles = person.roles ?? []

  // Unique role names for display
  const uniqueRoles = Array.from(
    new Map(roles.map((r) => [r.role.name, r])).values()
  )

  // Unique case badges
  const uniqueCases = Array.from(
    new Map(
      roles
        .filter((r) => r.short_name)
        .map((r) => [r.case_id, r])
    ).values()
  )

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5",
        "border-b border-border/50",
        "hover:bg-accent/50 transition-colors cursor-pointer"
      )}
      onClick={() => onClick(person)}
    >
      {/* Avatar */}
      <span
        className="flex size-8 shrink-0 items-center justify-center text-xs font-medium"
        style={getAvatarStyleById(person.id)}
      >
        {getInitials(person.name)}
      </span>

      {/* Name + org */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{person.name}</span>
          {!hideCategoryBadge &&
            uniqueRoles.map((r) => (
              <Badge
                key={r.role.name}
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 leading-none shrink-0"
              >
                {formatRoleName(r.role.name)}
              </Badge>
            ))}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {person.organization && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate">
              <HugeiconsIcon icon={Building06Icon} className="size-3 shrink-0" />
              {person.organization}
            </span>
          )}
          {primaryPhone && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <HugeiconsIcon icon={SmartPhone01Icon} className="size-3 shrink-0" />
              {primaryPhone.value}
            </span>
          )}
          {primaryEmail && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate">
              <HugeiconsIcon icon={Mail01Icon} className="size-3 shrink-0" />
              {primaryEmail.value}
            </span>
          )}
        </div>
      </div>

      {/* Case badges (right side) */}
      {uniqueCases.length > 0 && (
        <div className="flex items-center gap-1 shrink-0">
          {uniqueCases.slice(0, 3).map((r) => (
            <Badge
              key={r.case_id}
              className="text-[10px] px-1.5 py-0 h-4 leading-none"
              style={getBadgeStyle(r.color ?? undefined)}
            >
              {r.short_name}
            </Badge>
          ))}
          {uniqueCases.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{uniqueCases.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
