import type { IntakeStatus } from "@/types/intake"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusColors: Record<IntakeStatus, string> = {
  "New": "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "Dave Review": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "Needs Follow-Up": "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  "Atty Review": "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  "Needs Rejection Letter": "bg-red-500/15 text-red-700 dark:text-red-400",
  "Rejection Letter Sent": "bg-red-500/10 text-red-600 dark:text-red-500",
  "Needs Retainer": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "Retainer Sent": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500",
  "Retainer Signed": "bg-green-500/15 text-green-700 dark:text-green-400",
  "Archived": "bg-neutral-500/15 text-neutral-600 dark:text-neutral-400",
}

interface StatusBadgeProps {
  status: IntakeStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-0 font-medium",
        statusColors[status],
        className
      )}
    >
      {status}
    </Badge>
  )
}
