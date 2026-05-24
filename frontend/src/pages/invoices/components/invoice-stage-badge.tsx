import type { InvoiceStage } from "@/services/invoices"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const stageColors: Record<InvoiceStage, string> = {
  "Received": "bg-info text-info-foreground",
  "In Review": "bg-warning text-warning-foreground",
  "Needs Payment": "bg-purple text-purple-foreground",
  "Paid": "bg-success text-success-foreground",
}

interface InvoiceStageBadgeProps {
  stage: InvoiceStage
  className?: string
}

export function InvoiceStageBadge({ stage, className }: InvoiceStageBadgeProps) {
  return (
    <Badge className={cn("border-0 font-medium", stageColors[stage], className)}>
      {stage}
    </Badge>
  )
}
