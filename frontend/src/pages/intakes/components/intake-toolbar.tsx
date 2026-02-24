import type { Table } from "@tanstack/react-table"
import type { Intake } from "@/types/intake"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, RefreshIcon, SparklesIcon, MoreHorizontalIcon, NoteEditIcon } from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
      <Button size="sm" className="h-8" onClick={onNewIntakeChat}>
        <HugeiconsIcon icon={SparklesIcon} className="mr-2 size-4" />
        New Intake
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" className="h-8 w-8">
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onNewIntake}>
            <HugeiconsIcon icon={NoteEditIcon} className="mr-2 size-4" />
            Manual Intake Form
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
