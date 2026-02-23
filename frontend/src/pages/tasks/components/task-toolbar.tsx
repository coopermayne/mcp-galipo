import type { Table } from "@tanstack/react-table"
import type { TaskListItem } from "@/types/task"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "@/components/common/data-table-faceted-filter"

import { statuses, urgencies } from "@/pages/tasks/task-data"
import { cn } from "@/lib/utils"

export type TaskScope = "mine" | "assigned"

interface TaskToolbarProps {
  table: Table<TaskListItem>
  scope: TaskScope
  onScopeChange: (scope: TaskScope) => void
}

export function TaskToolbar({
  table,
  scope,
  onScopeChange,
}: TaskToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center gap-2">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            placeholder="Filter tasks..."
            value={
              (table.getColumn("description")?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table.getColumn("description")?.setFilterValue(event.target.value)
            }
            className="h-8 pl-8"
          />
        </div>

        {/* Faceted filters */}
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={statuses}
          />
        )}
        {table.getColumn("urgency") && (
          <DataTableFacetedFilter
            column={table.getColumn("urgency")}
            title="Urgency"
            options={urgencies}
          />
        )}

        {/* Reset */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <HugeiconsIcon icon={Cancel01Icon} className="ml-2 size-4" />
          </Button>
        )}
      </div>

      {/* Scope toggle */}
      <div className="flex items-center border h-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onScopeChange("mine")}
          className={cn(
            "h-full px-2.5 border-0",
            scope === "mine"
              ? "bg-foreground text-background hover:bg-foreground hover:text-background"
              : "text-muted-foreground"
          )}
        >
          Your Cases
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onScopeChange("assigned")}
          className={cn(
            "h-full px-2.5 border-0",
            scope === "assigned"
              ? "bg-foreground text-background hover:bg-foreground hover:text-background"
              : "text-muted-foreground"
          )}
        >
          Assigned
        </Button>
      </div>
    </div>
  )
}
