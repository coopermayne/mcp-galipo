import type { Table } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import type { Invoice, InvoiceStatus } from "@/services/invoices"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface InvoiceToolbarProps {
  table: Table<Invoice>
  statusFilter: InvoiceStatus
  onStatusChange: (status: InvoiceStatus) => void
}

export function InvoiceToolbar({
  table,
  statusFilter,
  onStatusChange,
}: InvoiceToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-40">
        <HugeiconsIcon
          icon={Search01Icon}
          className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          placeholder="Search invoices..."
          value={(table.getState().globalFilter as string) ?? ""}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
          className="h-8 pl-8"
        />
      </div>
      <div className="flex items-center border">
        <Button
          variant={statusFilter === "unpaid" ? "default" : "ghost"}
          size="sm"
          className="h-8"
          onClick={() => onStatusChange("unpaid")}
        >
          Unpaid
        </Button>
        <Button
          variant={statusFilter === "paid" ? "default" : "ghost"}
          size="sm"
          className="h-8"
          onClick={() => onStatusChange("paid")}
        >
          Paid
        </Button>
      </div>
    </div>
  )
}
