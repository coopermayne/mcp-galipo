import type { Table } from "@tanstack/react-table"
import type { Intake } from "@/types/intake"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, RefreshIcon, SparklesIcon, MoreHorizontalIcon, NoteEditIcon, Archive01Icon, PrinterIcon, CheckListIcon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"

interface IntakeToolbarProps {
  table: Table<Intake>
  onSync: () => void
  isSyncing: boolean
  onNewIntake: () => void
  onNewIntakeChat: () => void
  onBulkArchiveRejected: () => void
  isBulkArchiving: boolean
  selectedStatus: string | null
  selectionMode: boolean
  onToggleSelectionMode: () => void
  onPrintSelected: () => void
  isPrintingBatch: boolean
}

export function IntakeToolbar({
  table,
  onSync,
  isSyncing,
  onNewIntake,
  onNewIntakeChat,
  onBulkArchiveRejected,
  isBulkArchiving,
  selectedStatus,
  selectionMode,
  onToggleSelectionMode,
  onPrintSelected,
  isPrintingBatch,
}: IntakeToolbarProps) {
  const selectedCount = Object.keys(table.getState().rowSelection).length

  const handlePrint = async () => {
    const params = new URLSearchParams()
    if (selectedStatus) params.set("status", selectedStatus)
    const url = `/api/v1/intakes/export${params.toString() ? `?${params}` : ""}`
    const res = await apiFetch(url)
    if (!res.ok) return
    const blob = await res.blob()
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "intakes.pdf"
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (selectionMode) {
    return (
      <div className="flex items-center gap-2 bg-muted/50 border px-3 py-2">
        <span className="text-sm font-medium">
          {selectedCount > 0
            ? `${selectedCount} intake${selectedCount === 1 ? "" : 's'} selected`
            : 'Select intakes to print'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            className="h-8"
            onClick={onPrintSelected}
            disabled={selectedCount === 0 || isPrintingBatch}
          >
            <HugeiconsIcon icon={PrinterIcon} className="mr-2 size-4" />
            {isPrintingBatch ? "Generating..." : `Print ${selectedCount > 0 ? selectedCount : ''}`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onToggleSelectionMode}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="mr-2 size-4" />
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-40">
        <HugeiconsIcon
          icon={Search01Icon}
          className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          placeholder="Search intakes..."
          value={(table.getState().globalFilter as string) ?? ""}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
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
          className={cn("sm:mr-2 size-4", isSyncing && "animate-spin")}
        />
        <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync"}</span>
      </Button>
      <Button size="sm" className="h-8" onClick={onNewIntakeChat}>
        <HugeiconsIcon icon={SparklesIcon} className="sm:mr-2 size-4" />
        <span className="hidden sm:inline">New Intake</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" className="h-8 w-8" title="Print">
            <HugeiconsIcon icon={PrinterIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePrint}>
            <HugeiconsIcon icon={PrinterIcon} className="mr-2 size-4" />
            Print Intake List
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleSelectionMode}>
            <HugeiconsIcon icon={CheckListIcon} className="mr-2 size-4" />
            Print Selection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
          <DropdownMenuItem onClick={onBulkArchiveRejected} disabled={isBulkArchiving}>
            <HugeiconsIcon icon={Archive01Icon} className="mr-2 size-4" />
            Archive All Rejected
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
