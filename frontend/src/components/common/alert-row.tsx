import { HugeiconsIcon } from "@hugeicons/react"
import { ViewOffSlashIcon, ViewIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { severityMeta } from "@/lib/alert-severity"
import type { CaseAlert } from "@/types/alert"

export function AlertRow({
  alert,
  onDismiss,
  onRestore,
  busy,
}: {
  alert: CaseAlert
  onDismiss?: (a: CaseAlert) => void
  onRestore?: (a: CaseAlert) => void
  busy?: boolean
}) {
  const meta = severityMeta[alert.severity]
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2 text-sm",
        meta.accentClass,
        alert.dismissed && "opacity-60"
      )}
    >
      <HugeiconsIcon icon={meta.icon} className={cn("mt-0.5 size-4 shrink-0", meta.iconClass)} />
      <span className={cn("min-w-0 flex-1", alert.dismissed && "line-through")}>
        {alert.message}
      </span>
      {alert.dismissible && !alert.dismissed && onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
          disabled={busy}
          onClick={() => onDismiss(alert)}
        >
          <HugeiconsIcon icon={ViewOffSlashIcon} className="mr-1 size-3.5" />
          Dismiss
        </Button>
      )}
      {alert.dismissed && onRestore && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
          disabled={busy}
          onClick={() => onRestore(alert)}
        >
          <HugeiconsIcon icon={ViewIcon} className="mr-1 size-3.5" />
          Restore
        </Button>
      )}
    </div>
  )
}
