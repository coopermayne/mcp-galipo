import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon } from "@hugeicons/core-free-icons"
import type { Invoice } from "@/services/invoices"

const LABELS: Record<string, string> = {
  payee: "No payee assigned",
  pay_to: "Payee missing pay-to name",
  address: "Payee missing address",
  w9: "No W-9 on file",
  amount: "No amount",
  file: "No invoice file attached",
}

interface PerfectionBadgeProps {
  invoice: Invoice
}

export function PerfectionBadge({ invoice }: PerfectionBadgeProps) {
  if (invoice.is_perfected) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-warning hover:text-warning/80"
          onClick={(e) => e.stopPropagation()}
        >
          <HugeiconsIcon icon={Alert02Icon} className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 text-xs space-y-1.5">
        <p className="font-semibold text-warning">Not ready for payment</p>
        <ul className="space-y-0.5 text-muted-foreground">
          {invoice.perfection_missing.map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <span className="size-1 bg-warning shrink-0" />
              {LABELS[key] ?? key}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
