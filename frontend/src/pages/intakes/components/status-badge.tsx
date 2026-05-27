import type { IntakeStatus } from "@/types/intake"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getIntakeStatusStyle } from "@/pages/intakes/status-colors"

interface StatusBadgeProps {
  status: IntakeStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      className={cn("font-medium", className)}
      style={getIntakeStatusStyle(status)}
    >
      {status}
    </Badge>
  )
}
