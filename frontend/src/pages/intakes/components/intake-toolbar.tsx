import type { Table } from "@tanstack/react-table"
import type { Intake, IntakeCountsResponse, IntakeStatus } from "@/types/intake"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTableViewOptions } from "@/components/common/data-table-view-options"
import { cn } from "@/lib/utils"

const FILTER_STATUSES: IntakeStatus[] = [
  "New",
  "Dave Review",
  "Needs Follow-Up",
  "Atty Review",
  "Needs Rejection Letter",
  "Rejection Letter Sent",
  "Needs Retainer",
  "Retainer Sent",
  "Retainer Signed",
]

interface IntakeToolbarProps {
  table: Table<Intake>
  counts: IntakeCountsResponse | undefined
  selectedStatus: string | null
  onStatusChange: (status: string | null) => void
}

export function IntakeToolbar({
  table,
  counts,
  selectedStatus,
  onStatusChange,
}: IntakeToolbarProps) {
  const nameColumn = table.getColumn("name")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        <Button
          variant={selectedStatus === null ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onStatusChange(null)}
        >
          All
          {counts && (
            <span className="ml-1 text-[10px] opacity-70">
              ({Object.values(counts).reduce((a, b) => a + b, 0)})
            </span>
          )}
        </Button>
        {FILTER_STATUSES.map((status) => (
          <Button
            key={status}
            variant={selectedStatus === status ? "default" : "ghost"}
            size="sm"
            className={cn("h-7 text-xs", selectedStatus === status && "shadow-sm")}
            onClick={() => onStatusChange(status)}
          >
            {status}
            {counts && counts[status] != null && (
              <span className="ml-1 text-[10px] opacity-70">
                ({counts[status]})
              </span>
            )}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            placeholder="Filter by name..."
            value={(nameColumn?.getFilterValue() as string) ?? ""}
            onChange={(e) => nameColumn?.setFilterValue(e.target.value)}
            className="h-8 pl-8"
          />
        </div>
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
}
