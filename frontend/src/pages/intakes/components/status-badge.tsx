import type { IntakeStatus } from "@/types/intake"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusColors: Record<IntakeStatus, string> = {
  "New": "bg-info text-info-foreground",
  "Dave Review": "bg-warning text-warning-foreground",
  "Needs Follow-Up": "bg-warning text-warning-foreground",
  "Atty Review": "bg-purple text-purple-foreground",
  "Needs Rejection Letter": "bg-destructive text-white",
  "Rejection Letter Sent": "bg-destructive text-white",
  "Needs Retainer": "bg-success text-success-foreground",
  "Retainer Sent": "bg-success text-success-foreground",
  "Retainer Signed": "bg-success text-success-foreground",
  "Archived": "bg-muted text-muted-foreground",
}

interface StatusBadgeProps {
  status: IntakeStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
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
