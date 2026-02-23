import type { Table } from "@tanstack/react-table"
import type { CaseListItem } from "@/types/case"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Add01Icon } from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTableViewOptions } from "@/components/common/data-table-view-options"

interface CaseToolbarProps {
  table: Table<CaseListItem>
  onNewCase: () => void
}

export function CaseToolbar({ table, onNewCase }: CaseToolbarProps) {
  const nameColumn = table.getColumn("case_name")

  return (
    <div className="flex items-center gap-2">
      <div className="relative max-w-sm flex-1">
        <HugeiconsIcon
          icon={Search01Icon}
          className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          placeholder="Filter by case name..."
          value={(nameColumn?.getFilterValue() as string) ?? ""}
          onChange={(e) => nameColumn?.setFilterValue(e.target.value)}
          className="h-8 pl-8"
        />
      </div>
      <Button size="sm" className="h-8" onClick={onNewCase}>
        <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" />
        New Case
      </Button>
      <DataTableViewOptions table={table} />
    </div>
  )
}
