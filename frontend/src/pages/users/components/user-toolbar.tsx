import type { Table } from "@tanstack/react-table"
import type { User } from "@/types/user"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { DataTableViewOptions } from "@/components/common/data-table-view-options"

interface UserToolbarProps {
  table: Table<User>
  showInactive: boolean
  onShowInactiveChange: (value: boolean) => void
  onAddUser: () => void
}

export function UserToolbar({
  table,
  showInactive,
  onShowInactiveChange,
  onAddUser,
}: UserToolbarProps) {
  const nameColumn = table.getColumn("lastName")

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
      <div className="flex items-center gap-2">
        <Checkbox
          id="show-inactive"
          checked={showInactive}
          onCheckedChange={(checked) => onShowInactiveChange(checked === true)}
        />
        <Label htmlFor="show-inactive" className="text-xs whitespace-nowrap">
          Show inactive
        </Label>
      </div>
      <Button size="sm" className="h-8" onClick={onAddUser}>
        <HugeiconsIcon icon={UserAdd01Icon} className="mr-2 size-4" />
        Add User
      </Button>
      <DataTableViewOptions table={table} />
    </div>
  )
}
