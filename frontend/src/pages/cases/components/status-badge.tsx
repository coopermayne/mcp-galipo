import type { CaseStatus } from "@/types/case"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusColors: Record<CaseStatus, string> = {
  // Pre-lit — muted
  "Signing Up": "bg-muted text-muted-foreground",
  "Pre-Claim": "bg-muted text-muted-foreground",
  "Pre-Filing": "bg-muted text-muted-foreground",
  // Litigation — info/blue
  "Pleadings": "bg-info text-info-foreground",
  "Discovery": "bg-info text-info-foreground",
  "Expert Discovery": "bg-info text-info-foreground",
  "Pre-trial": "bg-info text-info-foreground",
  "Trial": "bg-purple text-purple-foreground",
  "Post-Trial": "bg-purple text-purple-foreground",
  "Appeal": "bg-purple text-purple-foreground",
  // Resolution
  "Settl. Pend.": "bg-warning text-warning-foreground",
  "Stayed": "bg-warning text-warning-foreground",
  "Closed": "bg-success text-success-foreground",
}

interface StatusBadgeProps {
  status: CaseStatus
  className?: string
}

export function CaseStatusBadge({ status, className }: StatusBadgeProps) {
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
