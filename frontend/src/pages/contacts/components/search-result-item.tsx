import { HugeiconsIcon } from "@hugeicons/react"
import {
  SmartPhone01Icon,
  Mail01Icon,
  Building06Icon,
  Location01Icon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getAvatarStyleById } from "@/lib/badge-colors"
import type { UnifiedSearchResult } from "@/services/contacts"

interface SearchResultItemProps {
  result: UnifiedSearchResult
  onClick: (result: UnifiedSearchResult) => void
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function SearchResultItem({ result, onClick }: SearchResultItemProps) {
  const primaryPhone = result.phones?.[0]
  const primaryEmail = result.emails?.[0]

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5",
        "border-b border-border/50 last:border-b-0",
        "hover:bg-accent/50 transition-colors cursor-pointer"
      )}
      onClick={() => onClick(result)}
    >
      {/* Avatar */}
      <span
        className="flex size-8 shrink-0 items-center justify-center text-xs font-medium"
        style={getAvatarStyleById(result.id + (result.type === "judge" ? 1000 : 0))}
      >
        {getInitials(result.name)}
      </span>

      {/* Name + details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{result.name}</span>
          {result.type === "judge" && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 leading-none shrink-0"
            >
              Judge
            </Badge>
          )}
          {result.type === "person" && result.role_summary && (
            <span className="text-xs text-muted-foreground truncate">
              {result.role_summary}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {result.type === "person" && result.organization && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate">
              <HugeiconsIcon icon={Building06Icon} className="size-3 shrink-0" />
              {result.organization}
            </span>
          )}
          {result.type === "judge" && result.jurisdiction && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate">
              <HugeiconsIcon icon={Location01Icon} className="size-3 shrink-0" />
              {result.jurisdiction}
              {result.courtroom && ` · ${result.courtroom}`}
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
    </div>
  )
}
