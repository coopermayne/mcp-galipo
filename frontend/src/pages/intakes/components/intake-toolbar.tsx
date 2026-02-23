import type { Table } from "@tanstack/react-table"
import type { Intake } from "@/types/intake"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, RefreshIcon, Add01Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTableViewOptions } from "@/components/common/data-table-view-options"
import { cn } from "@/lib/utils"

interface IntakeToolbarProps {
  table: Table<Intake>
  onSync: () => void
  isSyncing: boolean
  onNewIntake: () => void
  onNewIntakeChat: () => void
}

export function IntakeToolbar({
  table,
  onSync,
  isSyncing,
  onNewIntake,
  onNewIntakeChat,
}: IntakeToolbarProps) {
  const nameColumn = table.getColumn("name")

  return (
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
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={onSync}
        disabled={isSyncing}
      >
        <HugeiconsIcon
          icon={RefreshIcon}
          className={cn("mr-2 size-4", isSyncing && "animate-spin")}
        />
        {isSyncing ? "Syncing..." : "Sync"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={onNewIntakeChat}
      >
        <HugeiconsIcon icon={SparklesIcon} className="mr-2 size-4" />
        AI Intake
      </Button>
      <Button size="sm" className="h-8" onClick={onNewIntake}>
        <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" />
        New Intake
      </Button>
      <DataTableViewOptions table={table} />
    </div>
  )
}
