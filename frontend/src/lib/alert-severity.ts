import { Alert02Icon, AlertCircleIcon, InformationCircleIcon } from "@hugeicons/core-free-icons"
import type { AlertSeverity } from "@/types/alert"

export const severityMeta: Record<
  AlertSeverity,
  { label: string; icon: typeof Alert02Icon; iconClass: string; accentClass: string }
> = {
  error: {
    label: "Must fix",
    icon: Alert02Icon,
    iconClass: "text-destructive",
    accentClass: "border-l-2 border-l-destructive",
  },
  warning: {
    label: "Review",
    icon: AlertCircleIcon,
    iconClass: "text-warning",
    accentClass: "border-l-2 border-l-warning",
  },
  info: {
    label: "Info",
    icon: InformationCircleIcon,
    iconClass: "text-info",
    accentClass: "border-l-2 border-l-info",
  },
}

export const severityRank: Record<AlertSeverity, number> = { error: 0, warning: 1, info: 2 }
