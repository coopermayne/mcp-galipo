import { HugeiconsIcon } from "@hugeicons/react"
import {
  SmartPhone01Icon,
  Mail01Icon,
  Location01Icon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getAvatarStyleById } from "@/lib/badge-colors"
import type { JudgeListItem as JudgeListItemType } from "@/services/judges"

interface JudgeListItemProps {
  judge: JudgeListItemType
  onClick: (judge: JudgeListItemType) => void
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function JudgeListItem({ judge, onClick }: JudgeListItemProps) {
  const primaryPhone = judge.phones?.[0]
  const primaryEmail = judge.emails?.[0]

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5",
        "border-b border-border/50",
        "hover:bg-accent/50 transition-colors cursor-pointer"
      )}
      onClick={() => onClick(judge)}
    >
      {/* Avatar */}
      <span
        className="flex size-8 shrink-0 items-center justify-center text-xs font-medium"
        style={getAvatarStyleById(judge.id)}
      >
        {getInitials(judge.name)}
      </span>

      {/* Name + title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{judge.name}</span>
          {judge.title && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 leading-none shrink-0"
            >
              {judge.title}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {judge.jurisdiction_name && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate">
              <HugeiconsIcon icon={Location01Icon} className="size-3 shrink-0" />
              {judge.jurisdiction_name}
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

      {/* Status badge (right side, only if not Active) */}
      {judge.status && judge.status !== "Active" && (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-4 leading-none shrink-0 text-muted-foreground"
        >
          {judge.status}
        </Badge>
      )}
    </div>
  )
}
